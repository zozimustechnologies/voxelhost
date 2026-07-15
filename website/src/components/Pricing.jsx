import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth }  from '../context/AuthContext'
import styles from './Pricing.module.css'

// Detect India via timezone
function isIndia() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Calcutta'
        || Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Kolkata'
  } catch { return false }
}

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

export default function Pricing() {
  const { user } = useAuth()

  const [plans, setPlans]             = useState([])
  const [loading, setLoading]         = useState(true)
  const [currency, setCurrency]       = useState(isIndia() ? 'INR' : 'USD')
  const [couponCode, setCouponCode]   = useState('')
  const [coupon, setCoupon]           = useState(null)
  const [couponError, setCouponError] = useState(null)
  const [checking, setChecking]       = useState(false)
  const [paying, setPaying]           = useState(null) // plan id being processed

  useEffect(() => {
    supabase.from('plans').select('*').order('sort_order')
      .then(({ data }) => { if (data) setPlans(data); setLoading(false) })
  }, [])

  // ── Coupon ────────────────────────────────────────────────
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

  // ── Subscribe ─────────────────────────────────────────────
  async function handleSubscribe(plan) {
    if (!user) {
      alert('Please sign in first to subscribe.')
      return
    }
    setPaying(plan.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${EDGE_URL}/create-subscription`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          plan_id:     plan.id,
          currency,
          coupon_code: coupon?.code ?? null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Razorpay plan not yet configured — fall back to email order
        if (res.status === 422) {
          window.location.href = `mailto:zozimustechnologies@outlook.com?subject=${plan.email_subject}${coupon ? `&body=Coupon: ${coupon.code}` : ''}`
          return
        }
        throw new Error(data.error ?? 'Failed to create subscription')
      }

      // Open Razorpay checkout
      const loaded = await loadRazorpay()
      if (!loaded) throw new Error('Razorpay SDK failed to load')

      const options = {
        key:             data.razorpay_key_id,
        subscription_id: data.subscription_id,
        name:            'VoxelHost',
        description:     `${data.plan_name} Plan`,
        image:           '/favicon.svg',
        prefill:         { email: user.email },
        theme:           { color: '#4ade80' },
        handler: function () {
          alert('🎉 Subscription activated! Check your email for server details.')
        },
      }
      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      alert(err.message)
    } finally {
      setPaying(null)
    }
  }

  // ── Helpers ───────────────────────────────────────────────
  function discounted(priceCents) {
    if (!coupon) return priceCents
    return Math.round(priceCents * (1 - coupon.discount_percent / 100))
  }

  function fmt(paise, cur) {
    const amount = paise / 100
    if (cur === 'INR') return `₹${amount % 1 === 0 ? amount.toLocaleString('en-IN') : amount.toFixed(2)}`
    return `$${amount % 1 === 0 ? amount : amount.toFixed(2)}`
  }

  return (
    <section id="pricing" className={styles.section}>
      <div className="container">
        <div className={styles.header}>
          <h2>Simple, Transparent Pricing</h2>
          <p>No contracts. No hidden fees. Cancel any time.</p>

          {/* Currency toggle */}
          <div className={styles.currencyToggle}>
            <button
              className={`${styles.currBtn} ${currency === 'INR' ? styles.active : ''}`}
              onClick={() => setCurrency('INR')}
            >
              ₹ INR
            </button>
            <button
              className={`${styles.currBtn} ${currency === 'USD' ? styles.active : ''}`}
              onClick={() => setCurrency('USD')}
            >
              $ USD
            </button>
          </div>
        </div>

        {/* Coupon */}
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

        {loading ? (
          <div className={styles.loading}>Loading plans…</div>
        ) : (
          <div className={styles.grid}>
            {plans.map(plan => {
              const rawPaise  = currency === 'INR' ? plan.price_inr_paise : plan.price_cents
              const isTrial   = plan.name === 'Trial'
              const finalPaise = isTrial ? rawPaise : discounted(rawPaise)
              const hasDisc   = !isTrial && coupon && finalPaise !== rawPaise
              const features  = Array.isArray(plan.features) ? plan.features : JSON.parse(plan.features)
              const isLoading = paying === plan.id

              return (
                <div key={plan.id} className={`${styles.card} ${plan.popular ? styles.popular : ''} ${isTrial ? styles.trial : ''}`}>
                  {plan.popular && <div className={styles.badge}>Most Popular</div>}
                  {isTrial      && <div className={styles.trialBadge}>⚡ Try for ₹1</div>}

                  <div className={styles.planName}>{plan.name}</div>

                  <div className={styles.priceRow}>
                    <div className={styles.price}>{fmt(finalPaise, currency)}<span>{isTrial ? ' one-time' : '/mo'}</span></div>
                    {hasDisc && <div className={styles.original}>{fmt(rawPaise, currency)}</div>}
                  </div>

                  <div className={styles.sub}>{isTrial ? '1 minute · Test the platform' : plan.player_limit}</div>

                  <ul className={styles.features}>
                    {features.map(f => (
                      <li key={f}><span className={styles.check}>✓</span>{f}</li>
                    ))}
                  </ul>

                  <button
                    className={styles.btn}
                    onClick={() => handleSubscribe(plan)}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Opening…' : isTrial ? 'Try for ₹1' : user ? 'Subscribe' : 'Get Started'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
