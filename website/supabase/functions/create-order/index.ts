// Edge Function: create-order
// Creates a Razorpay Order for the authenticated user.
//
// Required env vars:
//   RAZORPAY_KEY_ID     — Razorpay key ID
//   RAZORPAY_KEY_SECRET — Razorpay key secret

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RAZORPAY_API = 'https://api.razorpay.com/v1'
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

function razorpayAuth() {
  const key    = Deno.env.get('RAZORPAY_KEY_ID')     ?? ''
  const secret = Deno.env.get('RAZORPAY_KEY_SECRET') ?? ''
  return 'Basic ' + btoa(`${key}:${secret}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // ── Auth ──────────────────────────────────────────────────
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const authHeader = req.headers.get('Authorization') ?? ''
  const { data: { user }, error: authError } =
    await supabase.auth.getUser(authHeader.replace('Bearer ', ''))

  if (authError || !user) return json({ error: 'Unauthorized' }, 401)

  // ── Body ──────────────────────────────────────────────────
  const { plan_id, coupon_code } = await req.json()
  if (!plan_id) return json({ error: 'plan_id is required' }, 400)

  // ── Fetch plan ────────────────────────────────────────────
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('*')
    .eq('id', plan_id)
    .single()

  if (planError || !plan) return json({ error: 'Plan not found' }, 404)

  // ── Coupon validation ─────────────────────────────────────
  let discountPercent = 0
  if (coupon_code) {
    const { data: coupon } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', coupon_code.toUpperCase())
      .eq('active', true)
      .single()

    if (coupon) {
      const withinLimit = coupon.max_uses === null || coupon.uses_count < coupon.max_uses
      const notExpired  = coupon.expires_at === null || new Date(coupon.expires_at) > new Date()
      if (withinLimit && notExpired) discountPercent = coupon.discount_percent
    }
  }

  // ── Calculate amount ──────────────────────────────────────
  const baseAmount   = plan.price_inr_paise as number
  const finalAmount  = Math.round(baseAmount * (1 - discountPercent / 100))

  // ── Create Razorpay Order ─────────────────────────────────
  const rzRes = await fetch(`${RAZORPAY_API}/orders`, {
    method: 'POST',
    headers: { 'Authorization': razorpayAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount:   finalAmount,
      currency: 'INR',
      notes: {
        user_id:    user.id,
        plan_id:    plan.id,
        plan_name:  plan.name,
        coupon_code: coupon_code ?? '',
      },
    }),
  })

  const rzData = await rzRes.json()
  if (!rzRes.ok) return json({ error: rzData.error?.description ?? 'Razorpay error' }, 502)

  return json({
    order_id:       rzData.id,
    amount:         rzData.amount,
    currency:       rzData.currency,
    razorpay_key_id: Deno.env.get('RAZORPAY_KEY_ID'),
    plan_name:      plan.name,
  })
})
