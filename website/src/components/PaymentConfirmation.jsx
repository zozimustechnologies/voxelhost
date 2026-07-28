import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth }  from '../context/AuthContext'
import styles from './PaymentConfirmation.module.css'

export default function PaymentConfirmation({ onDone }) {
  const { user } = useAuth()
  const [profile, setProfile]         = useState(null)
  const [serverConfig, setServerConfig] = useState(null)
  const [mcUsername, setMcUsername]   = useState('')
  const [launcherMode, setLauncherMode] = useState('offline')
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [error, setError]             = useState(null)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles')
      .select('minecraft_username, container_id, launcher_mode')
      .eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setProfile(data)
          if (data.minecraft_username) setMcUsername(data.minecraft_username)
          if (data.launcher_mode) setLauncherMode(data.launcher_mode)
          if (data.container_id) {
            supabase.from('server_configs')
              .select('*').eq('container_id', data.container_id).single()
              .then(({ data: sc }) => { if (sc) setServerConfig(sc) })
          }
        }
      })
  }, [user])

  async function handleSave(e) {
    e.preventDefault()
    if (!mcUsername.trim()) { setError('Minecraft username is required'); return }
    setSaving(true); setError(null)
    const { error: err } = await supabase.from('profiles').update({
      minecraft_username: mcUsername.trim(),
      launcher_mode: launcherMode,
    }).eq('id', user.id)

    if (err) { setError(err.message); setSaving(false); return }

    // Queue whitelist add job with updated username
    if (profile?.container_id) {
      await supabase.from('server_jobs').insert({
        type:    'mc_allowlist_add',
        payload: { username: mcUsername.trim(), container_id: profile.container_id },
      })
    }
    setSaved(true)
    setSaving(false)
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="24" fill="#4ade80" fillOpacity="0.15"/>
            <path d="M14 24.5l7 7 13-13" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h1>Payment Confirmed!</h1>
        <p className={styles.sub}>Your server is being set up. Fill in the details below to get connected.</p>

        {serverConfig && (
          <div className={styles.serverBox}>
            <div className={styles.serverLabel}>{serverConfig.name}</div>
            <div className={styles.serverAddress}>{serverConfig.address}</div>
            <div className={styles.serverNote}>Default port: 25565 · Minecraft {serverConfig.online_mode ? 'Premium (online mode)' : 'All launchers (offline mode)'}</div>
            <button
              className={styles.copyBtn}
              onClick={() => navigator.clipboard.writeText(serverConfig.address)}
            >
              Copy Address
            </button>
          </div>
        )}

        {!saved ? (
          <form onSubmit={handleSave} className={styles.form}>
            <h3>Set Up Your Access</h3>

            <label>
              Minecraft Username
              <input
                type="text"
                value={mcUsername}
                onChange={e => setMcUsername(e.target.value)}
                placeholder="e.g. chdavi"
                required
                autoComplete="off"
              />
              <span className={styles.hint}>The username you use to join the server</span>
            </label>

            <label>Launcher Mode</label>
            <div className={styles.modeRow}>
              <button
                type="button"
                className={`${styles.modeBtn} ${launcherMode === 'offline' ? styles.active : ''}`}
                onClick={() => setLauncherMode('offline')}
              >
                <strong>Offline / Cracked</strong>
                <span>SKLauncher, TLauncher, any username</span>
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${launcherMode === 'premium' ? styles.active : ''}`}
                onClick={() => setLauncherMode('premium')}
              >
                <strong>Premium (Official)</strong>
                <span>Official Launcher, paid Minecraft account</span>
              </button>
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button type="submit" className={styles.submit} disabled={saving}>
              {saving ? 'Saving…' : 'Save & Get Whitelisted'}
            </button>
          </form>
        ) : (
          <div className={styles.successNote}>
            <p>✓ You've been added to the whitelist. Join <strong>{serverConfig?.address}</strong> now!</p>
            <button className={styles.submit} onClick={onDone}>Back to Home</button>
          </div>
        )}
      </div>
    </div>
  )
}
