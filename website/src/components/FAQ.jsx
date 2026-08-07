import { useState } from 'react'
import { Plus } from 'lucide-react'
import styles from './FAQ.module.css'

const FAQS = [
  {
    q: 'What Minecraft server software do you use?',
    a: 'We use Paper exclusively — the most optimised and stable server software for Minecraft Java Edition. We do not support Fabric, Forge, NeoForge, BungeeCord, Velocity, or modpacks.',
  },
  {
    q: 'How long does it take to get my server?',
    a: 'After payment confirmation, we will set up your server and send your IP address, join instructions, and a support link by email as quickly as possible.',
  },
  {
    q: 'Can I install my own plugins?',
    a: 'Yes. You have full file access to your server. Upload any Paper-compatible plugin to the plugins folder. Contact support if you need help.',
  },
  {
    q: 'How do backups work?',
    a: 'Backup details are provided when your server is set up. Contact support for backup or restoration requests.',
  },
  {
    q: 'Which Minecraft versions are supported?',
    a: 'We run the latest stable Paper build by default. If you need a specific version for plugin compatibility, contact support before ordering.',
  },
  {
    q: 'Can offline mode clients connect?',
    a: 'Servers run in online mode (Mojang authentication) by default. Offline mode can be enabled on request, but we recommend keeping it enabled for security.',
  },
  {
    q: 'How do I pay and cancel?',
    a: 'Payment details are provided when you contact us to order. No long-term contracts — cancel any time by emailing support before your next billing period.',
  },
]

export default function FAQ() {
  const [open, setOpen] = useState(null)

  const toggle = i => setOpen(open === i ? null : i)

  return (
    <section id="faq" className={styles.section}>
      <div className="container">
        <div className={styles.header}>
          <h2>Frequently Asked Questions</h2>
        </div>
        <div className={styles.list}>
          {FAQS.map((item, i) => (
            <div className={styles.item} key={i}>
              <button
                className={`${styles.btn} ${open === i ? styles.open : ''}`}
                onClick={() => toggle(i)}
              >
                {item.q}
                <Plus className={styles.icon} size={18} />
              </button>
              <div
                className={styles.answer}
                style={{ maxHeight: open === i ? '300px' : '0' }}
              >
                <div className={styles.answerInner}>{item.a}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
