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

export default function Pricing({ onSignUp, onPaymentSuccess, onPaymentFailed, onShowStatus }) {
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

      // Trial uses one-time order; recurring plans use subscriptions
      const isTrial = plan.name === 'Trial'
      const endpoint = isTrial ? 'create-order' : 'create-subscription'
      const res = await fetch(`${EDGE_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: plan.id, coupon_code: coupon?.code ?? null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to create subscription')

      const loaded = await loadRazorpay()
      if (!loaded) throw new Error('Razorpay SDK failed to load')

      // Step 2 — open checkout (subscription mandate setup)
      await new Promise((resolve, reject) => {
        // Dev-only test bypass — never shown in production builds
        if (import.meta.env.DEV) {
          const el = document.createElement('div')
          el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;z-index:9999'
          el.innerHTML = `<div style="background:#111;border:1px solid #222;border-radius:1rem;padding:2rem;text-align:center;max-width:320px;width:90%"><div style="color:#4ade80;font-weight:700;font-size:1.1rem;margin-bottom:1rem">Test Mode — ${data.plan_name}</div><div style="display:flex;flex-direction:column;gap:.75rem"><button id="ok" style="background:#4ade80;color:#000;font-weight:700;padding:.8rem;border:none;border-radius:.75rem;cursor:pointer">✓ Simulate Success</button><button id="fail" style="background:transparent;color:#f87171;border:1px solid #f87171;padding:.7rem;border-radius:.75rem;cursor:pointer">✗ Simulate Failure</button><button id="cancel" style="background:transparent;color:#555;border:none;padding:.4rem;cursor:pointer;font-size:.85rem">Cancel</button></div></div>`
          document.body.appendChild(el)
          el.querySelector('#ok').onclick = async () => {
            document.body.removeChild(el)
            try {
              const vRes = await fetch(`${EDGE_URL}/verify-payment`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ razorpay_order_id: data.order_id ?? data.subscription_id, razorpay_payment_id: 'pay_TEST_' + Math.random().toString(36).slice(2), razorpay_signature: 'test', plan_id: plan.id, coupon_code: coupon?.code ?? null, test_bypass: true }),
              })
              const vData = await vRes.json()
              if (!vRes.ok) throw new Error(vData.error ?? 'Verification failed')
              resolve(null); onPaymentSuccess?.({ containerId: vData.container_id, expiresAt: vData.expires_at })
            } catch (err) { reject(err) }
          }
          el.querySelector('#fail').onclick = () => { document.body.removeChild(el); reject(new Error('Payment failed (test)')) }
          el.querySelector('#cancel').onclick = () => { document.body.removeChild(el); resolve(null) }
          return
        }
        // Trial: one-time order checkout; recurring plans: subscription checkout
        const rzpConfig = {
          key:   data.razorpay_key_id,
          name:  'VoxelHost',
          description: `${data.plan_name} Plan`,
          image: `${import.meta.env.BASE_URL}logo-wordmark.png`,
          prefill: { email: user.email },
          theme: { color: '#4ade80' },
          modal: { ondismiss: () => resolve(null) },
        }
        if (data.order_id) {
          // One-time order (trial)
          Object.assign(rzpConfig, { order_id: data.order_id, amount: data.amount, currency: data.currency })
          rzpConfig.handler = async (response) => {
            try {
              const vRes = await fetch(`${EDGE_URL}/verify-payment`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature, plan_id: plan.id, coupon_code: coupon?.code ?? null }),
              })
              const vData = await vRes.json()
              if (!vRes.ok) throw new Error(vData.error ?? 'Payment verification failed')
              resolve(null); onPaymentSuccess?.({ containerId: vData.container_id, expiresAt: vData.expires_at })
            } catch (err) { reject(err) }
          }
        } else {
          // Subscription (monthly/2-month)
          Object.assign(rzpConfig, { subscription_id: data.subscription_id })
          rzpConfig.handler = () => { resolve(null); onPaymentSuccess?.({}) }
        }
        const rzp = new window.Razorpay(rzpConfig)
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
                    onClick={() => !trialDone && !hasActiveSub && handleSubscribe(plan)}
                    disabled={isLoading || trialDone || (hasActiveSub && !isTrial)}
                    style={hasActiveSub && !isTrial ? {background:'#1a2a1a',color:'#4ade80',cursor:'default',border:'1px solid #4ade80'} : undefined}
                  >
                    {hasActiveSub && !isTrial ? '✓ Plan Active' : trialDone ? 'Trial completed' : isLoading ? 'Opening…' : isTrial ? 'Try for ₹99' : user ? 'Subscribe' : 'Sign Up'}
                  </button>
                  {!serverAvailable && !hasActiveSub && !isTrial && (
                    <button onClick={onShowStatus} style={{background:'none',border:'none',color:'#f87171',fontSize:'0.75rem',cursor:'pointer',marginTop:'0.4rem',textDecoration:'underline',padding:0}}>
                      Servers full — check status & join waitlist
                    </button>
                  )}
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
