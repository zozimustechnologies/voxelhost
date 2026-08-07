import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import styles from './Hero.module.css'

export default function Hero({ onShowStatus }) {
  const [free, setFree] = useState(null)

  useEffect(() => {
    supabase.rpc('server_availability').then(({ data }) => setFree(data?.free ?? null))
  }, [])

  const full = free === 0

  return (
    <section className={styles.hero}>
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.glow}  aria-hidden="true" />

      <div className={styles.content}>
        <button className={`${styles.badge} ${full ? styles.badgeFull : ''}`} onClick={onShowStatus} style={{background:'none',border:'none',cursor:'pointer'}}>
          <span className={styles.dot} />
          {full ? 'Servers full — click to check status & join waitlist' : 'Servers online & accepting players'}
        </button>

        <h1 className={styles.headline}>
          Minecraft Hosting<br />
          <span className={styles.green}>Built to Last.</span>
        </h1>

        <p className={styles.sub}>
          Paper-optimised servers — stable, simple, and ready when you are.
          No bloat. No gimmicks.
        </p>

        <div className={styles.actions}>
          <a href="#pricing" className={styles.btnPrimary}>View Plans ↓</a>
          <a href="#features" className={styles.btnOutline}>See Features</a>
        </div>

        <div className={styles.stats}>
          {[
            { num: 'Paper',  label: 'Server software' },
            { num: '₹10',   label: 'Trial plan'       },
            { num: '₹499',  label: 'Monthly plan'     },
          ].map(s => (
            <div className={styles.stat} key={s.label}>
              <div className={styles.statNum}>{s.num}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
