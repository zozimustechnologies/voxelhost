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

export default function Pricing({ onSignUp }) {
  const { user } = useAuth()
  const toast    = useToast()
  const [plans, setPlans]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [couponCode, setCouponCode]   = useState('')
  const [coupon, setCoupon]           = useState(null)
  const [couponError, setCouponError] = useState(null)
  const [checking, setChecking]       = useState(false)
  const [paying, setPaying]           = useState(null)
  const [trialUsed, setTrialUsed]     = useState(false)

  useEffect(() => {
    supabase.from('plans').select('*').order('sort_order')
      .then(({ data }) => { if (data) setPlans(data); setLoading(false) })
  }, [])

  useEffect(() => {
    if (!user) { setTrialUsed(false); return }
    supabase.from('profiles').select('trial_used').eq('id', user.id).single()
      .then(({ data }) => { if (data) setTrialUsed(data.trial_used) })
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
      const res = await fetch(`${EDGE_URL}/create-subscription`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: plan.id, currency: 'INR', coupon_code: coupon?.code ?? null }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 422) {
          window.location.href = `mailto:zozimustechnologies@outlook.com?subject=${plan.email_subject}${coupon ? `&body=Coupon: ${coupon.code}` : ''}`
          return
        }
        throw new Error(data.error ?? 'Failed to create subscription')
      }
      const loaded = await loadRazorpay()
      if (!loaded) throw new Error('Razorpay SDK failed to load')
      const rzp = new window.Razorpay({
        key:             data.razorpay_key_id,
        subscription_id: data.subscription_id,
        name:            'VoxelHost',
        description:     `${data.plan_name} Plan`,
        image:           `${import.meta.env.BASE_URL}logo-icon.svg`,
        prefill:         { email: user.email },
        theme:           { color: '#4ade80' },
        handler: () => toast({ message: '🎉 Subscription activated! Check your email for server details.' }),
      })
      rzp.open()
    } catch (err) {
      toast({ message: err.message, type: 'error' })
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
                    onClick={() => !trialDone && handleSubscribe(plan)}
                    disabled={isLoading || trialDone}
                  >
                    {trialDone ? 'Trial completed' : isLoading ? 'Opening…' : isTrial ? 'Try for ₹10' : user ? 'Subscribe' : 'Sign Up'}
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
