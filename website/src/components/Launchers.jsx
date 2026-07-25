import styles from './Launchers.module.css'

const LAUNCHERS = [
  { icon: '🎮', name: 'Official Launcher', status: 'Tested',  ok: true  },
  { icon: '🔵', name: 'TLauncher',         status: 'Tested',  ok: true  },
  { icon: '�', name: 'SKLauncher',        status: 'Tested',  ok: true  },
  { icon: '🔷', name: 'Prism Launcher',    status: 'Testing', ok: false },
  { icon: '🟠', name: 'CurseForge',        status: 'Testing', ok: false },
  { icon: '🟣', name: 'Modrinth',          status: 'Testing', ok: false },
  { icon: '🔶', name: 'MultiMC',           status: 'Testing', ok: false },
  { icon: '🔴', name: 'HMCL',              status: 'Testing', ok: false },
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
        <div className={styles.note}>
          <span className={styles.noteIcon}>⚠️</span>
          <p>
            <strong>Online vs Offline mode:</strong> A server can only run in one mode at a time.
            If your server is set to offline mode (for cracked launchers), players with a paid
            Minecraft account cannot join — and vice versa. Choose one mode per server.
          </p>
        </div>
      </div>
    </section>
  )
}
