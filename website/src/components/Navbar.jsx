import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import styles from './Navbar.module.css'

const links = [
  { label: 'Features',     href: '#features'    },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Pricing',      href: '#pricing'      },
  { label: 'Launchers',    href: '#launchers'    },
  { label: 'FAQ',          href: '#faq'          },
]

export default function Navbar({ onSignUp }) {
  const { user, signOut }       = useAuth()
  const [open, setOpen]         = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const close = () => setOpen(false)

  return (
    <nav className={`${styles.nav} ${scrolled ? styles.scrolled : ''}`}>
      <div className={styles.inner}>
<a href="#" className={styles.logo}>
          <img src={`${import.meta.env.BASE_URL}logo-icon.png`} alt="VoxelHost" className={styles.logoImg} />
        </a>

        <ul className={`${styles.links} ${open ? styles.open : ''}`}>
          {links.map(l => (
            <li key={l.href}><a href={l.href} onClick={close}>{l.label}</a></li>
          ))}
        </ul>

        <div className={styles.cta}>
          {user ? (
            <>
              <span className={styles.userEmail}>{user.email}</span>
              <button className={styles.btnOutline} onClick={signOut}>Sign out</button>
            </>
          ) : (
            <>
              <button className={styles.btnOutline} onClick={onSignUp}>Sign in</button>
              <button className={styles.btnPrimary} onClick={onSignUp}>Sign Up</button>
            </>
          )}
        </div>

        <button className={styles.hamburger} onClick={() => setOpen(o => !o)} aria-label="Toggle menu">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </nav>
  )
}
