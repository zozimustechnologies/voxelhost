import styles from './HowItWorks.module.css'

const STEPS = [
  { n: '1', title: 'Choose a Plan',      body: 'Pick the RAM size that fits your player count and budget.' },
  { n: '2', title: 'Pay & Confirm',      body: 'Secure payment. We receive notification and immediately start provisioning.' },
  { n: '3', title: 'Server Created',     body: 'Your Paper server is spun up, ports allocated, and backups configured.' },
  { n: '4', title: 'Credentials Delivered', body: 'You receive your IP, join instructions, backup info, and a support link.' },
  { n: '5', title: 'Play',               body: 'Connect with your favourite launcher and invite your friends.' },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className={styles.section}>
      <div className="container">
        <div className={styles.header}>
          <h2>From Payment to Playing in Minutes</h2>
          <p>Our workflow is simple by design so nothing can go wrong.</p>
        </div>
        <div className={styles.steps}>
          {STEPS.map((s, i) => (
            <div className={styles.step} key={s.n}>
              <div className={styles.num}>{s.n}</div>
              {i < STEPS.length - 1 && <div className={styles.connector} aria-hidden="true" />}
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
