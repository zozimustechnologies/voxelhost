import styles from './Features.module.css'

const FEATURES = [
  { icon: '⚡', title: 'Paper-Optimised',    body: 'Only Paper. Highly tuned, low-latency, stable. No mods, no experimental software — just a server that works.' },
  { icon: '💾', title: 'Daily Backups',       body: 'Automated daily snapshots of your world, plugins, and config. Restore in minutes.' },
  { icon: '🖥️', title: 'Console Access',      body: 'Full access to your server console. Run commands, check logs, troubleshoot in real time.' },
  { icon: '📁', title: 'File Access',         body: 'Browse, upload, and edit your server files. Drop in plugins, edit configs, manage your world.' },
  { icon: '🔌', title: 'Plugin Support',      body: 'Install any Paper-compatible plugin. Full Spigot / Bukkit ecosystem supported.' },
  { icon: '🔄', title: 'Start / Stop / Restart', body: 'Full server lifecycle control whenever you need it.' },
  { icon: '📊', title: 'Server Monitoring',   body: 'Track CPU, RAM, TPS, and player count in real time.' },
  { icon: '🚀', title: 'Fast Provisioning',   body: 'Pay → server created → IP delivered. Target: under 10 minutes from payment to first login.' },
  { icon: '🌐', title: 'Multi-Launcher Ready', body: 'Official Launcher, Prism, MultiMC, TLauncher, SKLauncher, HMCL, CurseForge, Modrinth & more.' },
]

export default function Features() {
  return (
    <section id="features" className={styles.section}>
      <div className="container">
        <div className={styles.header}>
          <h2>Everything You Need, Nothing You Don't</h2>
          <p>We run Paper — the fastest, most stable Minecraft server software available.</p>
        </div>
        <div className={styles.grid}>
          {FEATURES.map(f => (
            <div className={styles.card} key={f.title}>
              <div className={styles.icon}>{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
