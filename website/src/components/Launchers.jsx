import styles from './Launchers.module.css'

const LAUNCHERS = [
  { icon: '🎮', name: 'Official Launcher', status: 'Tested',  ok: true  },
  { icon: '🔵', name: 'TLauncher',         status: 'Tested',  ok: true  },
  { icon: '🔷', name: 'Prism Launcher',    status: 'Tested',  ok: true  },
  { icon: '🟠', name: 'CurseForge',        status: 'Tested',  ok: true  },
  { icon: '🟣', name: 'Modrinth',          status: 'Tested',  ok: true  },
  { icon: '🔶', name: 'MultiMC',           status: 'Tested',  ok: true  },
  { icon: '🟡', name: 'SKLauncher',        status: 'Tested',  ok: true  },
  { icon: '🔴', name: 'HMCL',              status: 'Tested',  ok: true  },
  { icon: '📱', name: 'PojavLauncher',     status: 'Testing', ok: false },
]

export default function Launchers() {
  return (
    <section id="launchers" className={styles.section}>
      <div className="container">
        <div className={styles.header}>
          <h2>Works With Your Launcher</h2>
          <p>We test every launcher ourselves before listing it as supported.</p>
        </div>
        <div className={styles.grid}>
          {LAUNCHERS.map(l => (
            <div className={styles.pill} key={l.name}>
              <span>{l.icon}</span>
              <span>{l.name}</span>
              <span className={`${styles.tag} ${l.ok ? styles.ok : styles.soon}`}>
                {l.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
