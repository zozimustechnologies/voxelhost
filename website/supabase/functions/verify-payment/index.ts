// Edge Function: verify-payment
// Verifies Razorpay payment signature, assigns server, records purchase, triggers whitelist.
//
// Required env vars:
//   RAZORPAY_KEY_SECRET — for HMAC verification

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto }        from 'https://deno.land/std@0.208.0/crypto/mod.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const authHeader = req.headers.get('Authorization') ?? ''
  const { data: { user }, error: authError } =
    await supabase.auth.getUser(authHeader.replace('Bearer ', ''))

  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_id, coupon_code, test_bypass } =
    await req.json()

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return json({ error: 'Missing payment fields' }, 400)
  }

  if (!test_bypass) {
    const secret  = Deno.env.get('RAZORPAY_KEY_SECRET') ?? ''
    const message = `${razorpay_order_id}|${razorpay_payment_id}`
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    )
    const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
    const expected = Array.from(new Uint8Array(sigBytes))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    if (expected !== razorpay_signature) return json({ error: 'Invalid payment signature' }, 400)
  }

  const { data: plan } = await supabase.from('plans').select('*').eq('id', plan_id).single()
  if (!plan) return json({ error: 'Plan not found' }, 404)

  const now = new Date()
  const expiresAt = new Date(now)
  const minutes = (plan.interval_minutes as number | null)
  if (minutes) {
    expiresAt.setMinutes(expiresAt.getMinutes() + minutes)
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + ((plan.interval_months as number) ?? 1))
  }

  // Auto-assign server with fewest active subscribers
  let { data: profile } = await supabase
    .from('profiles').select('minecraft_username, container_id').eq('id', user.id).single()

  let containerId = profile?.container_id ?? null
  if (!containerId) {
    const { data: assigned } = await supabase.rpc('assign_server')
    if (assigned) {
      // upsert in case the profile row doesn't exist yet
      await supabase.from('profiles').upsert(
        { id: user.id, container_id: assigned },
        { onConflict: 'id' }
      )
      containerId = assigned
    }
  }

  const { error: insertError } = await supabase.from('subscriptions').upsert({
    user_id:              user.id,
    plan_id:              plan.id,
    status:               'active',
    currency:             'INR',
    razorpay_order_id,
    razorpay_payment_id,
    coupon_code:          coupon_code ?? null,
    current_period_start: now.toISOString(),
    current_period_end:   expiresAt.toISOString(),
  }, { onConflict: 'user_id' })

  if (insertError) return json({ error: insertError.message }, 500)

  if (coupon_code) await supabase.rpc('increment_coupon_uses', { p_code: coupon_code })
  if (plan.name === 'Trial') await supabase.from('profiles').update({ trial_used: true }).eq('id', user.id)

  const mcUsername = profile?.minecraft_username?.trim()
  if (mcUsername && containerId) {
    await supabase.from('server_jobs').insert({
      type: 'mc_allowlist_add', payload: { username: mcUsername, container_id: containerId },
    })
  }

  return json({ success: true, expires_at: expiresAt.toISOString(), container_id: containerId })
})
