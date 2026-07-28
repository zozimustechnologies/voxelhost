import styles from './PaymentConfirmation.module.css'

export default function PaymentFailed({ onRetry, onHome }) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="24" fill="#f87171" fillOpacity="0.15"/>
            <path d="M16 16l16 16M32 16L16 32" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h1>Payment Failed</h1>
        <p className={styles.sub}>Your payment could not be completed. You have not been charged.</p>
        <div className={styles.actions}>
          <button className={styles.submit} onClick={onRetry}>Try Again</button>
          <button className={styles.ghost} onClick={onHome}>Back to Home</button>
        </div>
      </div>
    </div>
  )
}
