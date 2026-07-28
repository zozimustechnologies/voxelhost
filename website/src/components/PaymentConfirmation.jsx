import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth }  from '../context/AuthContext'
import styles from './PaymentConfirmation.module.css'

export default function PaymentConfirmation({ onDone, containerId: initialContainerId, expiresAt }) {
  const { user } = useAuth()
  const [profile, setProfile]           = useState(null)
  const [serverConfig, setServerConfig] = useState(null)
  const [mcUsername, setMcUsername]     = useState('')
  const [launcherMode, setLauncherMode] = useState('offline')
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const [error, setError]               = useState(null)

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
          const cid = data.container_id ?? initialContainerId
          if (cid) {
            supabase.from('server_configs')
              .select('*').eq('container_id', cid).single()
              .then(({ data: sc }) => { if (sc) setServerConfig(sc) })
          }
        }
      })
  }, [user, initialContainerId])

  async function handleSave(e) {
    e.preventDefault()
    if (!mcUsername.trim()) { setError('Minecraft username is required'); return }
    setSaving(true); setError(null)
    const { error: err } = await supabase.from('profiles').update({
      minecraft_username: mcUsername.trim(),
      launcher_mode: launcherMode,
    }).eq('id', user.id)

    if (err) { setError(err.message); setSaving(false); return }

    const { error: jobErr } = await supabase.rpc('request_whitelist', { p_username: mcUsername.trim() })
    if (jobErr) console.warn('Whitelist job error:', jobErr.message)
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
            <div className={styles.serverNote}>Default port: 25565 · {serverConfig.online_mode ? 'Premium (online mode)' : 'All launchers (offline mode)'}</div>
            {expiresAt && (
              <div className={styles.serverNote} style={{color:'#4ade80', marginTop:'0.25rem'}}>
                Access expires: {new Date(expiresAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}
              </div>
            )}
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
                placeholder="Your Minecraft username"
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
            <p>✓ <strong>{mcUsername || 'You'}</strong> added to whitelist. Join now!</p>
            <button className={styles.submit} onClick={onDone}>Back to Home</button>
          </div>
        )}
      </div>
    </div>
  )
}
