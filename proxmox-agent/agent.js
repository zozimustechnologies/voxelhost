// VoxelHost Proxmox Agent
// Polls Supabase for pending server_jobs and executes them on this host.
//
// Setup:
//   1. Copy this folder to your Proxmox host
//   2. Run: npm install
//   3. Copy .env.example to .env and fill in your values
//   4. Run: node agent.js (or install as a systemd service — see voxelhost-agent.service)

import { createClient }  from '@supabase/supabase-js'
import { Rcon }          from 'rcon-client'
import { execFile }      from 'node:child_process'
import { promisify }     from 'node:util'
import { readFileSync }  from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Load .env manually (no extra deps) ───────────────────────
const __dir = dirname(fileURLToPath(import.meta.url))
try {
  const env = readFileSync(resolve(__dir, '.env'), 'utf8')
  for (const line of env.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!(key in process.env)) process.env[key] = val
  }
} catch {
  // .env not found — rely on environment variables being set externally
}

const exec = promisify(execFile)

// ── Config ────────────────────────────────────────────────────
const SUPABASE_URL     = requireEnv('SUPABASE_URL')
const SUPABASE_KEY     = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
const BACKUP_STORAGE   = process.env.BACKUP_STORAGE   ?? 'local'
const RCON_PASSWORD    = requireEnv('RCON_PASSWORD')
const RCON_PORT        = Number(process.env.RCON_PORT ?? 25575)
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 5000)

// Comma-separated list of allowed MC container IDs, e.g. "101,102,103"
const MC_CONTAINERS = new Set(
  requireEnv('MC_CONTAINERS').split(',').map(s => s.trim()).filter(Boolean)
)

// Map container ID -> LXC host IP (containers are reachable via their vmbr0 IP)
// Format: MC_CONTAINER_IPS=101:10.0.0.101,102:10.0.0.102,103:10.0.0.103
const MC_CONTAINER_IPS = Object.fromEntries(
  (process.env.MC_CONTAINER_IPS ?? '').split(',').map(s => s.trim()).filter(Boolean)
    .map(entry => entry.split(':'))
)

async function rconCommand(containerId, command) {
  const host = MC_CONTAINER_IPS[containerId]
  if (!host) throw new Error(`No IP configured for container ${containerId}. Set MC_CONTAINER_IPS in .env`)

  const rcon = new Rcon({ host, port: RCON_PORT, password: RCON_PASSWORD })
  await rcon.connect()
  try {
    const response = await rcon.send(command)
    return response
  } finally {
    await rcon.end()
  }
}

function requireEnv(key) {
  const val = process.env[key]
  if (!val) { console.error(`Missing required env var: ${key}`); process.exit(1) }
  return val
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Job handlers ──────────────────────────────────────────────

async function handleMcAllowlist(payload, action /* 'add' | 'remove' */) {
  const username    = payload.username?.trim()
  const containerId = String(payload.container_id ?? '').trim()

  if (!username)    throw new Error('payload.username is required')
  if (!containerId) throw new Error('payload.container_id is required')
  if (!MC_CONTAINERS.has(containerId)) {
    throw new Error(`container_id "${containerId}" is not in the allowed list (${[...MC_CONTAINERS].join(', ')})`)
  }

  const results = []

  // Update allowlist (uses Paper's whitelist command internally)
  results.push(await rconCommand(containerId, `whitelist ${action} ${username}`))
  // Reload so the change takes effect immediately
  results.push(await rconCommand(containerId, 'whitelist reload'))
  // On remove, kick the player; on add, send a welcome message
  if (action === 'remove') {
    results.push(await rconCommand(containerId, `kick ${username} You have been removed from the allowlist.`))
  } else {
    // Small delay then welcome — player may not be online yet, ignore error
    try { await rconCommand(containerId, `say Welcome to VoxelHost, ${username}!`) } catch {}
  }

  const result = results.filter(Boolean).join(' | ')
  console.log(`[mc_allowlist_${action}] CT${containerId} ${username}: ${result}`)
  return result
}

async function handleProxmoxBackup(payload) {
  const storage = payload.storage ?? BACKUP_STORAGE
  const mode    = payload.mode    ?? 'snapshot'  // snapshot | suspend | stop

  // If container_id provided, back up that one; otherwise back up all MC containers
  const targets = payload.container_id
    ? [String(payload.container_id)]
    : [...MC_CONTAINERS]

  // Validate any explicitly provided container_id
  if (payload.container_id && !MC_CONTAINERS.has(String(payload.container_id))) {
    throw new Error(`container_id "${payload.container_id}" is not in the allowed list`)
  }

  const results = []
  for (const vmid of targets) {
    console.log(`[proxmox_backup] Starting backup of CT${vmid} to storage "${storage}"...`)
    const { stdout, stderr } = await exec('vzdump', [
      vmid,
      '--storage', storage,
      '--compress', 'zstd',
      '--mode', mode,
    ])
    const out = (stdout + stderr).trim()
    console.log(`[proxmox_backup] CT${vmid} done`)
    results.push(`CT${vmid}: ok`)
  }

  return results.join(', ')
}

// ── Main poll loop ────────────────────────────────────────────

async function claimJob(job) {
  const { data, error } = await supabase
    .from('server_jobs')
    .update({ status: 'running' })
    .eq('id', job.id)
    .eq('status', 'pending')   // optimistic lock — only claim if still pending
    .select('id')
    .single()

  return !error && data?.id === job.id
}

async function finishJob(id, result) {
  await supabase
    .from('server_jobs')
    .update({ status: 'done', result })
    .eq('id', id)
}

async function failJob(id, err) {
  const result = err instanceof Error ? err.message : String(err)
  await supabase
    .from('server_jobs')
    .update({ status: 'failed', result })
    .eq('id', id)
}

async function processJob(job) {
  const claimed = await claimJob(job)
  if (!claimed) return  // another agent instance got it first

  console.log(`[agent] Processing job ${job.id} (${job.type})`)

  try {
    let result
    switch (job.type) {
      case 'mc_allowlist_add':
        result = await handleMcAllowlist(job.payload, 'add')
        break
      case 'mc_allowlist_remove':
        result = await handleMcAllowlist(job.payload, 'remove')
        break
      case 'proxmox_backup':
        result = await handleProxmoxBackup(job.payload)
        break
      default:
        throw new Error(`Unknown job type: ${job.type}`)
    }
    await finishJob(job.id, result)
    console.log(`[agent] Job ${job.id} done`)
  } catch (err) {
    console.error(`[agent] Job ${job.id} failed:`, err)
    await failJob(job.id, err)
  }
}

async function poll() {
  const { data: jobs, error } = await supabase
    .from('server_jobs')
    .select('id, type, payload')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(5)

  if (error) {
    console.error('[agent] Poll error:', error.message)
    return
  }

  for (const job of jobs ?? []) {
    await processJob(job)
  }
}

// ── Start ─────────────────────────────────────────────────────
console.log(`[agent] VoxelHost agent started. Polling every ${POLL_INTERVAL_MS}ms`)
console.log(`[agent] MC containers: ${[...MC_CONTAINERS].join(', ')}, RCON port: ${RCON_PORT}, backup storage: ${BACKUP_STORAGE}`)

// Periodically call the expire_subscriptions DB function as a safety net
async function runExpiryCheck() {
  const { error } = await supabase.rpc('expire_subscriptions')
  if (error) console.error('[agent] Expiry check error:', error.message)
  else console.log('[agent] Expiry check ran')
}

poll()
setInterval(poll, POLL_INTERVAL_MS)

// Run expiry check every 10 minutes
runExpiryCheck()
setInterval(runExpiryCheck, 10 * 60 * 1000)
