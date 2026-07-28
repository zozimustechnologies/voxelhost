import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth }  from '../context/AuthContext'
import { useToast } from './Toast'
import styles from './Pricing.module.css'

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload  = () => resolve(true)
    s.onerror = () => resolve(false)
    document.body.appendChild(s)
  })
}

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

function fmt(paise) {
  const amount = paise / 100
  return `₹${Number.isInteger(amount) ? amount.toLocaleString('en-IN') : amount.toFixed(2)}`
}

export default function Pricing({ onSignUp, onPaymentSuccess, onPaymentFailed }) {
  const { user } = useAuth()
  const toast    = useToast()
  const [plans, setPlans]               = useState([])
  const [loading, setLoading]           = useState(true)
  const [couponCode, setCouponCode]     = useState('')
  const [coupon, setCoupon]             = useState(null)
  const [couponError, setCouponError]   = useState(null)
  const [checking, setChecking]         = useState(false)
  const [paying, setPaying]             = useState(null)
  const [trialUsed, setTrialUsed]       = useState(false)
  const [hasActiveSub, setHasActiveSub] = useState(false)
  const [serverAvailable, setServerAvailable] = useState(true)

  useEffect(() => {
    supabase.from('plans').select('*').order('sort_order')
      .then(({ data }) => { if (data) setPlans(data); setLoading(false) })
    supabase.rpc('has_free_server').then(({ data }) => setServerAvailable(data ?? true))
  }, [])

  useEffect(() => {
    if (!user) { setTrialUsed(false); setHasActiveSub(false); return }
    supabase.from('profiles').select('trial_used').eq('id', user.id).single()
      .then(({ data }) => { if (data) setTrialUsed(data.trial_used) })
    supabase.from('subscriptions').select('id').eq('user_id', user.id).eq('status', 'active').maybeSingle()
      .then(({ data }) => setHasActiveSub(!!data))
  }, [user])

  async function applyCoupon() {
    if (!couponCode.trim()) return
    setChecking(true); setCouponError(null); setCoupon(null)
    const { data, error } = await supabase
      .from('coupons').select('*')
      .eq('code', couponCode.trim().toUpperCase()).single()
    if (error || !data) {
      setCouponError('Invalid or expired coupon code.')
    } else if (data.max_uses !== null && data.uses_count >= data.max_uses) {
      setCouponError('This coupon has reached its usage limit.')
    } else {
      setCoupon(data)
    }
    setChecking(false)
  }

  async function handleSubscribe(plan) {
    if (!user) { onSignUp?.(); return }
    setPaying(plan.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()

      // Step 1 — create order
      const res = await fetch(`${EDGE_URL}/create-order`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: plan.id, coupon_code: coupon?.code ?? null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create order')

      const loaded = await loadRazorpay()
      if (!loaded) throw new Error('Razorpay SDK failed to load')

      // Step 2 — open checkout
      await new Promise((resolve, reject) => {
        // ── DEV TEST BUTTONS ─────────────────────────────────
        if (import.meta.env.DEV) {
          const overlay = document.createElement('div')
          overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;z-index:9999;font-family:sans-serif'
          overlay.innerHTML = `
            <div style="background:#111;border:1px solid #222;border-radius:1rem;padding:2rem;text-align:center;max-width:340px;width:90%">
              <div style="color:#888;font-size:.75rem;text-transform:uppercase;letter-spacing:.1em;margin-bottom:.5rem">Test Mode</div>
              <div style="color:#fff;font-size:1.1rem;font-weight:600;margin-bottom:.25rem">VoxelHost — ${data.plan_name}</div>
              <div style="color:#4ade80;font-size:1.5rem;font-weight:700;margin-bottom:1.5rem">₹${(data.amount/100).toLocaleString('en-IN')}</div>
              <div style="display:flex;flex-direction:column;gap:.75rem">
                <button id="rzp-success" style="background:#4ade80;color:#000;font-weight:700;padding:.85rem;border:none;border-radius:.75rem;cursor:pointer;font-size:.95rem">✓ Simulate Success</button>
                <button id="rzp-fail" style="background:transparent;color:#f87171;border:1px solid #f87171;font-weight:600;padding:.75rem;border-radius:.75rem;cursor:pointer;font-size:.9rem">✗ Simulate Failure</button>
                <button id="rzp-close" style="background:transparent;color:#555;border:none;padding:.5rem;cursor:pointer;font-size:.85rem">Cancel</button>
              </div>
            </div>`
          document.body.appendChild(overlay)
          overlay.querySelector('#rzp-success').onclick = async () => {
            document.body.removeChild(overlay)
            try {
              // Call verify-payment with fake but structurally valid data
              const vRes = await fetch(`${EDGE_URL}/verify-payment`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id:   data.order_id,
                  razorpay_payment_id: 'pay_TEST_' + Math.random().toString(36).slice(2),
                  razorpay_signature:  'test_bypass',
                  plan_id:             plan.id,
                  coupon_code:         coupon?.code ?? null,
                  test_bypass:         true,
                }),
              })
              const vData = await vRes.json()
              if (!vRes.ok) throw new Error(vData.error ?? 'Verification failed')
              resolve(null)
              onPaymentSuccess?.({ containerId: vData.container_id, expiresAt: vData.expires_at })
            } catch (err) { reject(err) }
          }
          overlay.querySelector('#rzp-fail').onclick = () => {
            document.body.removeChild(overlay)
            reject(new Error('Payment failed (test)'))
          }
          overlay.querySelector('#rzp-close').onclick = () => {
            document.body.removeChild(overlay)
            resolve(null)
          }
          return
        }
        // ─────────────────────────────────────────────────────
        const rzp = new window.Razorpay({
          key:         data.razorpay_key_id,
          order_id:    data.order_id,
          amount:      data.amount,
          currency:    data.currency,
          name:        'VoxelHost',
          description: `${data.plan_name} Plan`,
          image:       `${import.meta.env.BASE_URL}logo-icon.svg`,
          prefill:     { email: user.email },
          theme:       { color: '#4ade80' },
          handler: async (response) => {
            try {
              // Step 3 — verify payment + activate whitelist
              const vRes = await fetch(`${EDGE_URL}/verify-payment`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id:   response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature:  response.razorpay_signature,
                  plan_id:             plan.id,
                  coupon_code:         coupon?.code ?? null,
                }),
              })
              const vData = await vRes.json()
              if (!vRes.ok) throw new Error(vData.error ?? 'Payment verification failed')
              resolve(null)
              onPaymentSuccess?.({ containerId: vData.container_id, expiresAt: vData.expires_at })
            } catch (err) {
              reject(err)
            }
          },
          modal: { ondismiss: () => resolve(null) },
        })
        rzp.open()
      })
    } catch (err) {
      toast({ message: err.message, type: 'error' })
      onPaymentFailed?.()
    } finally {
      setPaying(null)
    }
  }

  function discounted(paise) {
    if (!coupon) return paise
    return Math.round(paise * (1 - coupon.discount_percent / 100))
  }

  return (
    <section id="pricing" className={styles.section}>
      <div className="container">
        <div className={styles.header}>
          <h2>Simple, Transparent Pricing</h2>
          <p>No contracts. No hidden fees. Cancel any time.</p>
        </div>

        <div className={styles.couponWrap}>
          <div className={styles.couponRow}>
            <input
              type="text"
              className={styles.couponInput}
              placeholder="Coupon code (e.g. LAUNCH25)"
              value={couponCode}
              onChange={e => { setCouponCode(e.target.value); setCoupon(null); setCouponError(null) }}
              onKeyDown={e => e.key === 'Enter' && applyCoupon()}
              maxLength={32}
            />
            <button className={styles.couponBtn} onClick={applyCoupon} disabled={checking}>
              {checking ? '…' : 'Apply'}
            </button>
          </div>
          {coupon      && <div className={styles.couponSuccess}>🎉 <strong>{coupon.code}</strong> — {coupon.discount_percent}% off!</div>}
          {couponError && <div className={styles.couponError}>{couponError}</div>}
        </div>

        {loading ? <div className={styles.loading}>Loading plans…</div> : (
          <div className={styles.grid}>
            {plans.map(plan => {
              const isTrial    = plan.name === 'Trial'
              const is2Month   = plan.name === '2 Months'
              const rawPaise   = plan.price_inr_paise
              const finalPaise  = isTrial ? rawPaise : discounted(rawPaise)
              const hasDisc     = !isTrial && coupon && finalPaise !== rawPaise
              const features    = Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features)
              const isLoading   = paying === plan.id
              const trialDone   = isTrial && trialUsed

              return (
                <div key={plan.id} className={`${styles.card} ${plan.popular ? styles.popular : ''} ${isTrial ? styles.trial : ''} ${trialDone ? styles.trialDone : ''}`}>
                  {plan.popular && <div className={styles.badge}>Most Popular</div>}
                  {isTrial && !trialDone && <div className={styles.trialBadge}>⚡ Try for ₹10</div>}
                  {trialDone                && <div className={styles.usedBadge}>Trial Used</div>}

                  <div className={styles.planName}>{plan.name}</div>
                  <div className={styles.priceRow}>
                    <div className={styles.price}>{fmt(finalPaise)}<span>{isTrial ? ' one-time' : is2Month ? '/2 mo' : '/mo'}</span></div>
                    {hasDisc && <div className={styles.original}>{fmt(rawPaise)}</div>}
                  </div>
                  {isTrial && <div className={styles.sub}>30 minutes · Test the platform</div>}

                  <ul className={styles.features}>
                    {features.map(f => <li key={f}><span className={styles.check}>✓</span>{f}</li>)}
                  </ul>

                  <button
                    className={styles.btn}
                    onClick={() => !trialDone && !hasActiveSub && serverAvailable && handleSubscribe(plan)}
                    disabled={isLoading || trialDone || (hasActiveSub && !isTrial) || (!hasActiveSub && !isTrial && !serverAvailable)}
                    style={
                      hasActiveSub && !isTrial ? {background:'#1a2a1a',color:'#4ade80',cursor:'default',border:'1px solid #4ade80'} :
                      !serverAvailable && !isTrial && !hasActiveSub ? {background:'#1a1a1a',color:'#666',cursor:'not-allowed',border:'1px solid #2a2a2a'} :
                      undefined
                    }
                  >
                    {hasActiveSub && !isTrial ? '✓ Plan Active'
                      : !serverAvailable && !isTrial && !hasActiveSub ? 'No Servers Available'
                      : trialDone ? 'Trial completed'
                      : isLoading ? 'Opening…'
                      : isTrial ? 'Try for ₹10'
                      : user ? 'Subscribe' : 'Sign Up'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className={styles.addon}>
          <div className={styles.addonIcon}>💾</div>
          <div>
            <strong>Server Backups</strong> — add-on
            <span className={styles.addonPrice}>+₹50 / mo</span>
          </div>
          <p>Automated backups of your server. Available as an optional add-on on any plan. Contact us to enable.</p>
        </div>
      </div>
    </section>
  )
}
