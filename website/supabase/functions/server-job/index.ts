// Edge Function: server-job
// Creates a server management job (MC allowlist, Proxmox backup, etc.)
// Protected by a static management token (MANAGEMENT_API_TOKEN env var).
//
// Required env vars:
//   SUPABASE_URL              — set automatically by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — set automatically by Supabase
//   MANAGEMENT_API_TOKEN      — a strong random secret you generate

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

const VALID_TYPES = ['mc_allowlist_add', 'mc_allowlist_remove', 'proxmox_backup'] as const
type JobType = typeof VALID_TYPES[number]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  // ── Token auth ────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  const expected   = Deno.env.get('MANAGEMENT_API_TOKEN') ?? ''

  if (!expected || token !== expected) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // ── GET /server-job?id=<uuid> — check job status ──────────
  if (req.method === 'GET') {
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return json({ error: 'id query param required' }, 400)

    const { data, error } = await supabase
      .from('server_jobs')
      .select('id, type, payload, status, result, created_at, updated_at')
      .eq('id', id)
      .single()

    if (error || !data) return json({ error: 'Job not found' }, 404)
    return json(data)
  }

  // ── POST /server-job — create a job ───────────────────────
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const body = await req.json().catch(() => null)
  if (!body) return json({ error: 'Invalid JSON body' }, 400)

  const { type, payload = {} } = body as { type: string; payload?: Record<string, unknown> }

  if (!VALID_TYPES.includes(type as JobType)) {
    return json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, 400)
  }

  // ── Validate payloads per job type ────────────────────────
  if (type === 'mc_allowlist_add' || type === 'mc_allowlist_remove') {
    if (typeof payload.username !== 'string' || !payload.username.trim()) {
      return json({ error: 'payload.username is required for MC allowlist jobs' }, 400)
    }
  }

  if (type === 'proxmox_backup') {
    // vmid is optional — defaults to the one configured in the agent
    if (payload.vmid !== undefined && typeof payload.vmid !== 'number') {
      return json({ error: 'payload.vmid must be a number' }, 400)
    }
  }

  const { data, error } = await supabase
    .from('server_jobs')
    .insert({ type, payload })
    .select('id, type, status, created_at')
    .single()

  if (error) {
    console.error('Insert error:', error)
    return json({ error: 'Failed to create job' }, 500)
  }

  return json(data, 201)
})
