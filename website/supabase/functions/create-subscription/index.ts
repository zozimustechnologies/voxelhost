// Edge Function: create-subscription
// Creates a Razorpay subscription for the authenticated user and records it in Supabase.
//
// Required env vars (set in Supabase Dashboard → Settings → Edge Functions):
//   RAZORPAY_KEY_ID     — your Razorpay key ID
//   RAZORPAY_KEY_SECRET — your Razorpay key secret

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RAZORPAY_API = 'https://api.razorpay.com/v1'

function razorpayAuth() {
  const key    = Deno.env.get('RAZORPAY_KEY_ID')     ?? ''
  const secret = Deno.env.get('RAZORPAY_KEY_SECRET') ?? ''
  return 'Basic ' + btoa(`${key}:${secret}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      },
    })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // ── Auth ──────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  const supabase   = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: { user }, error: authError } =
    await supabase.auth.getUser(authHeader.replace('Bearer ', ''))

  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // ── Block duplicate active subscriptions ──────────────────
  const { data: existing } = await supabase
    .from('subscriptions').select('id').eq('user_id', user.id).eq('status', 'active').maybeSingle()
  if (existing) return json({ error: 'You already have an active subscription. Cancel it first to change plans.' }, 409)

  // ── Block if no free server available ─────────────────────
  const { data: profile } = await supabase.from('profiles').select('container_id').eq('id', user.id).single()
  if (!profile?.container_id) {
    const { data: freeExists } = await supabase.rpc('has_free_server')
    if (!freeExists) return json({ error: 'All servers are currently occupied. Please check back soon.' }, 503)
  }

  // ── Body ──────────────────────────────────────────────────
  const { plan_id, currency = 'INR', coupon_code } = await req.json()

  if (!plan_id) return json({ error: 'plan_id is required' }, 400)
  if (!['INR', 'USD'].includes(currency)) return json({ error: 'Invalid currency' }, 400)

  // ── Fetch plan ────────────────────────────────────────────
  const { data: plan, error: planError } = await supabase
    .from('plans')
    .select('*')
    .eq('id', plan_id)
    .single()

  if (planError || !plan) return json({ error: 'Plan not found' }, 404)

  if (!plan.razorpay_plan_id) {
    return json({ error: 'Razorpay plan not configured for this plan yet.' }, 422)
  }

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
      if (withinLimit && notExpired) {
        discountPercent = coupon.discount_percent
      }
    }
  }

  // ── Create Razorpay subscription ──────────────────────────
  const rzBody: Record<string, unknown> = {
    plan_id:        plan.razorpay_plan_id,
    total_count:    120, // 10 years — effectively forever
    quantity:       1,
    customer_notify: 1,
    notes: {
      user_id:      user.id,
      plan_name:    plan.name,
      currency,
    },
  }

  // Apply Razorpay offer if coupon exists and discount > 0
  // (Offer IDs must be pre-created in Razorpay dashboard; skip if not set)

  const rzRes = await fetch(`${RAZORPAY_API}/subscriptions`, {
    method:  'POST',
    headers: {
      'Authorization': razorpayAuth(),
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(rzBody),
  })

  if (!rzRes.ok) {
    const err = await rzRes.json()
    return json({ error: 'Razorpay error', detail: err }, 502)
  }

  const rzSub = await rzRes.json()

  // ── Insert subscription row ───────────────────────────────
  const { data: sub, error: insertErr } = await supabase
    .from('subscriptions')
    .insert({
      user_id:          user.id,
      plan_id:          plan.id,
      currency,
      razorpay_sub_id:  rzSub.id,
      status:           'created',
      coupon_code:      coupon_code ?? null,
      discount_percent: discountPercent,
    })
    .select()
    .single()

  if (insertErr) return json({ error: 'DB insert failed', detail: insertErr }, 500)

  return json({
    subscription_id:   rzSub.id,
    razorpay_key_id:   Deno.env.get('RAZORPAY_KEY_ID'),
    supabase_sub_id:   sub.id,
    plan_name:         plan.name,
    currency,
    discount_percent:  discountPercent,
  })
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type':                'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
