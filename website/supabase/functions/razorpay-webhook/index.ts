// Edge Function: razorpay-webhook
// Handles Razorpay subscription lifecycle events and keeps Supabase in sync.
//
// Required env vars:
//   RAZORPAY_WEBHOOK_SECRET — set in Razorpay Dashboard → Webhooks

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto }        from 'https://deno.land/std@0.208.0/crypto/mod.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const rawBody  = await req.text()
  const signature = req.headers.get('x-razorpay-signature') ?? ''
  const secret    = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') ?? ''

  // ── Verify HMAC-SHA256 signature ──────────────────────────
  const key       = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBytes  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody))
  const expected  = Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  if (expected !== signature) {
    return new Response('Invalid signature', { status: 401 })
  }

  const event   = JSON.parse(rawBody)
  const payload = event.payload?.subscription?.entity

  if (!payload?.id) {
    return new Response('No subscription entity', { status: 200 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Map Razorpay event to our status
  const STATUS_MAP: Record<string, string> = {
    'subscription.authenticated': 'authenticated',
    'subscription.activated':     'active',
    'subscription.charged':       'active',
    'subscription.paused':        'paused',
    'subscription.resumed':       'active',
    'subscription.cancelled':     'cancelled',
    'subscription.completed':     'expired',
    'subscription.pending':       'created',
    'payment.failed':             'failed',
  }

  const newStatus = STATUS_MAP[event.event]
  if (!newStatus) return new Response('Event ignored', { status: 200 })

  const update: Record<string, unknown> = { status: newStatus }

  if (payload.current_start) {
    update.current_period_start = new Date(payload.current_start * 1000).toISOString()
  }
  if (payload.current_end) {
    update.current_period_end = new Date(payload.current_end * 1000).toISOString()
  }
  if (event.payload?.payment?.entity?.id) {
    update.razorpay_payment_id = event.payload.payment.entity.id
  }

  // Increment coupon uses_count when subscription becomes active for the first time
  if (newStatus === 'active') {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('coupon_code, status')
      .eq('razorpay_sub_id', payload.id)
      .single()

    if (sub?.coupon_code && sub.status !== 'active') {
      await supabase.rpc('increment_coupon_uses', { p_code: sub.coupon_code })
    }
  }

  await supabase
    .from('subscriptions')
    .update(update)
    .eq('razorpay_sub_id', payload.id)

  return new Response('OK', { status: 200 })
})
