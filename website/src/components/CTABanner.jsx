import styles from './CTABanner.module.css'

export default function CTABanner() {
  return (
    <section className={styles.banner}>
      <div className="container">
        <h2>Ready to Start Your Server?</h2>
        <p>Join VoxelHost today — get up and running in under 10 minutes.</p>
        <a
          href="#pricing"
          className={styles.btn}
        >
          Order Now →
        </a>
      </div>
    </section>
  )
}
