import styles from './Footer.module.css'

const PRODUCT = [
  { label: 'Features',             href: '#features'     },
  { label: 'Pricing',              href: '#pricing'       },
  { label: 'Launcher Compatibility', href: '#launchers'  },
  { label: 'How It Works',         href: '#how-it-works'  },
]
const SUPPORT = [
  { label: 'Email Support', href: 'mailto:zozimustechnologies@outlook.com' },
  { label: 'FAQ',           href: '#faq' },
]
const LEGAL = [
  { label: 'Terms of Service', href: '#' },
  { label: 'Privacy Policy',   href: '#' },
]

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.top}>
          <div className={styles.brand}>
            <img src={`${import.meta.env.BASE_URL}logo-wordmark.svg`} alt="VoxelHost" className={styles.logoImg} />
            <p>Professional Minecraft server hosting. Paper only. Reliable, fast, and simple.</p>
          </div>
          <div className={styles.cols}>
            <FooterCol title="Product" links={PRODUCT} />
            <FooterCol title="Support" links={SUPPORT} />
            <FooterCol title="Legal"   links={LEGAL}   />
          </div>
        </div>
        <div className={styles.bottom}>
          <span>&copy; {new Date().getFullYear()} VoxelHost. All rights reserved.</span>
          <span>Not affiliated with Mojang or Microsoft.</span>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, links }) {
  return (
    <div className={styles.col}>
      <h4>{title}</h4>
      <ul>
        {links.map(l => (
          <li key={l.label}><a href={l.href}>{l.label}</a></li>
        ))}
      </ul>
    </div>
  )
}
