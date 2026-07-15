import styles from './Hero.module.css'

export default function Hero() {
  return (
    <section className={styles.hero}>
      <div className={styles.grid} aria-hidden="true" />
      <div className={styles.glow}  aria-hidden="true" />

      <div className={styles.content}>
        <div className={styles.badge}>
          <span className={styles.dot} />
          Servers online &amp; accepting players
        </div>

        <h1 className={styles.headline}>
          Minecraft Hosting<br />
          <span className={styles.green}>Built to Last.</span>
        </h1>

        <p className={styles.sub}>
          Paper-optimised servers, daily backups, and a live console —
          ready in under&nbsp;10 minutes. No bloat. No gimmicks.
        </p>

        <div className={styles.actions}>
          <a href="#pricing" className={styles.btnPrimary}>View Plans ↓</a>
          <a href="#features" className={styles.btnOutline}>See Features</a>
        </div>

        <div className={styles.stats}>
          {[
            { num: '<10 min', label: 'Setup time'    },
            { num: 'Daily',   label: 'Backups'       },
            { num: '24 / 7',  label: 'Server uptime' },
            { num: '$5',      label: 'Starting price' },
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
