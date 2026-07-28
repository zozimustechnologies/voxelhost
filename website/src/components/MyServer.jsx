import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth }  from '../context/AuthContext'
import styles from './MyServer.module.css'

export default function MyServer({ onClose }) {
  const { user } = useAuth()
  const [data, setData]               = useState(null)
  const [loading, setLoading]         = useState(true)
  const [copied, setCopied]           = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [newName, setNewName]         = useState('')
  const [savingName, setSavingName]   = useState(false)
  const [slots, setSlots]             = useState([])
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [newPlayer, setNewPlayer]     = useState('')
  const [cancelling, setCancelling]   = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('subscriptions')
        .select('status, current_period_end, plan_id, plans(name)')
        .eq('user_id', user.id).eq('status', 'active').maybeSingle(),
      supabase.from('profiles')
        .select('minecraft_username, container_id, launcher_mode')
        .eq('id', user.id).single(),
      supabase.from('subscription_players')
        .select('id, username')
        .eq('user_id', user.id),
    ]).then(([{ data: sub }, { data: profile }, { data: slotsData, error: slotsErr }]) => {
      if (slotsErr) console.warn('slots error:', slotsErr.message)
      setSlots(slotsData ?? [])
      if (!sub) { setData(null); setLoading(false); return }
      const cid = profile?.container_id
      if (!cid) { setData({ sub, profile, server: null }); setLoading(false); return }
      supabase.from('server_configs')
        .select('*').eq('container_id', cid).single()
        .then(({ data: sc, error: scErr }) => {
          if (scErr) console.warn('server_configs error:', scErr.message)
          setData({ sub, profile, server: sc })
          setLoading(false)
        })
    })
  }, [user])

  function copy(text) {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveUsername() {
    if (!newName.trim()) return
    setSavingName(true)
    const { error } = await supabase.rpc('request_whitelist', { p_username: newName.trim() })
    if (!error) {
      setData(d => ({ ...d, profile: { ...d.profile, minecraft_username: newName.trim() } }))
      setEditingName(false)
    }
    setSavingName(false)
  }

  async function handleAddPlayer() {
    if (!newPlayer.trim()) return
    const { error } = await supabase.rpc('add_player', { p_username: newPlayer.trim() })
    if (!error) {
      setSlots(s => [...s, { id: Date.now(), username: newPlayer.trim() }])
      setNewPlayer('')
      setAddingPlayer(false)
    }
  }

  async function handleRemovePlayer(username) {
    await supabase.rpc('remove_player', { p_username: username })
    setSlots(s => s.filter(sl => sl.username !== username))
  }

  async function handleCancel() {
    if (!confirmCancel) { setConfirmCancel(true); return }
    setCancelling(true)
    await supabase.rpc('cancel_subscription')
    setData(null)
    setCancelling(false)
    setConfirmCancel(false)
  }

  const daysLeft = data?.sub?.current_period_end
    ? Math.max(0, Math.ceil((new Date(data.sub.current_period_end) - Date.now()) / 86400000))
    : null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>My Server</h2>
          <button className={styles.close} onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <p className={styles.muted}>Loading…</p>
        ) : !data ? (
          <div className={styles.empty}>
            <p>No active subscription found.</p>
            <p className={styles.muted}>Purchase a plan to get your server.</p>
          </div>
        ) : !data.server ? (
          <div className={styles.empty}>
            <p style={{color:'#4ade80'}}>✓ Payment active</p>
            <p className={styles.muted}>Server is being assigned — check back in a moment.</p>
          </div>
        ) : (
          <>
            <div className={styles.serverCard}>
              <div className={styles.row}>
                <span className={styles.label}>Server</span>
                <span className={styles.value}>{data.server?.name ?? '—'}</span>
              </div>
              <div className={styles.addressRow}>
                <span className={styles.address}>{data.server?.address}</span>
                <button className={styles.copyBtn} onClick={() => copy(data.server?.address)}>
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <div className={styles.row}>
                <span className={styles.label}>Port</span>
                <span className={styles.value}>25565 (default)</span>
              </div>
              <div className={styles.row}>
                <span className={styles.label}>Mode</span>
                <span className={styles.value}>
                  {data.profile.launcher_mode === 'premium' ? 'Premium (Official)' : 'Offline / All launchers'}
                </span>
              </div>
              <div className={styles.row}>
                <span className={styles.label}>Username</span>
                {editingName ? (
                  <span style={{display:'flex',gap:'0.4rem',alignItems:'center'}}>
                    <input
                      autoFocus
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveUsername(); if (e.key === 'Escape') setEditingName(false) }}
                      style={{background:'#0d0d0d',border:'1px solid #4ade80',borderRadius:'0.4rem',color:'#fff',padding:'0.2rem 0.5rem',fontSize:'0.85rem',width:'130px',outline:'none'}}
                    />
                    <button onClick={saveUsername} disabled={savingName} style={{background:'#4ade80',color:'#000',border:'none',borderRadius:'0.4rem',padding:'0.2rem 0.6rem',fontSize:'0.8rem',cursor:'pointer',fontWeight:600}}>{savingName ? '…' : '✓'}</button>
                    <button onClick={() => setEditingName(false)} style={{background:'none',border:'none',color:'#666',cursor:'pointer',fontSize:'0.85rem'}}>✕</button>
                  </span>
                ) : (
                  <span style={{display:'flex',gap:'0.5rem',alignItems:'center'}}>
                    <span className={styles.value}>{data.profile.minecraft_username ?? <em style={{color:'#555'}}>not set</em>}</span>
                    <button onClick={() => { setNewName(data.profile.minecraft_username ?? ''); setEditingName(true) }} style={{background:'none',border:'1px solid #333',borderRadius:'0.35rem',color:'#888',fontSize:'0.72rem',padding:'0.15rem 0.5rem',cursor:'pointer'}}>Edit</button>
                  </span>
                )}
              </div>
            </div>

            <div className={styles.planCard}>
              <div className={styles.planName}>{data.sub.plans?.name} Plan</div>
              {daysLeft !== null && (
                <div className={daysLeft <= 3 ? styles.expirySoon : styles.expiry}>
                  {daysLeft === 0 ? 'Expires today' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`}
                </div>
              )}
              <div className={styles.expiryDate}>
                Until {new Date(data.sub.current_period_end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>

            <div className={styles.howTo}>
              <div className={styles.howToTitle}>How to connect</div>
              <ol>
                <li>Open Minecraft → Multiplayer → Add Server</li>
                <li>Paste: <code>{data.server?.address}</code></li>
                <li>Join with username: <strong>{data.profile.minecraft_username ?? '(set your username above)'}</strong></li>
              </ol>
            </div>

            {/* ── Extra players ── */}
            <div className={styles.howTo}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'0.6rem'}}>
                <div className={styles.howToTitle} style={{margin:0}}>Whitelisted Players</div>
                {!addingPlayer && (
                  <button onClick={() => setAddingPlayer(true)} style={{background:'none',border:'1px solid #333',borderRadius:'0.4rem',color:'#aaa',fontSize:'0.78rem',padding:'0.2rem 0.6rem',cursor:'pointer'}}>+ Add</button>
                )}
              </div>
              {slots.length === 0 && !addingPlayer && <p style={{color:'#555',fontSize:'0.82rem',margin:0}}>No extra players added.</p>}
              {slots.map(sl => (
                <div key={sl.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'0.3rem 0',borderBottom:'1px solid #1a1a1a'}}>
                  <span style={{color:'#ccc',fontSize:'0.875rem'}}>{sl.username}</span>
                  <button onClick={() => handleRemovePlayer(sl.username)} style={{background:'none',border:'none',color:'#f87171',cursor:'pointer',fontSize:'0.8rem'}}>Remove</button>
                </div>
              ))}
              {addingPlayer && (
                <div style={{display:'flex',gap:'0.4rem',marginTop:'0.5rem'}}>
                  <input
                    autoFocus
                    value={newPlayer}
                    onChange={e => setNewPlayer(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddPlayer(); if (e.key === 'Escape') setAddingPlayer(false) }}
                    placeholder="Minecraft username"
                    style={{flex:1,background:'#0d0d0d',border:'1px solid #4ade80',borderRadius:'0.4rem',color:'#fff',padding:'0.35rem 0.6rem',fontSize:'0.875rem',outline:'none'}}
                  />
                  <button onClick={handleAddPlayer} style={{background:'#4ade80',color:'#000',border:'none',borderRadius:'0.4rem',padding:'0.35rem 0.75rem',fontWeight:700,cursor:'pointer',fontSize:'0.875rem'}}>Add</button>
                  <button onClick={() => setAddingPlayer(false)} style={{background:'none',border:'1px solid #333',borderRadius:'0.4rem',color:'#666',padding:'0.35rem 0.6rem',cursor:'pointer',fontSize:'0.875rem'}}>✕</button>
                </div>
              )}
            </div>

            {/* ── Cancel ── */}
            {confirmCancel ? (
              <div style={{background:'#1a0d0d',border:'1px solid #f87171',borderRadius:'0.75rem',padding:'0.875rem',display:'flex',flexDirection:'column',gap:'0.6rem'}}>
                <p style={{color:'#f87171',fontSize:'0.875rem',margin:0,fontWeight:600}}>Cancel subscription?</p>
                <p style={{color:'#888',fontSize:'0.8rem',margin:0}}>All whitelisted players will be removed immediately.</p>
                <div style={{display:'flex',gap:'0.5rem'}}>
                  <button onClick={handleCancel} disabled={cancelling} style={{flex:1,background:'#f87171',color:'#000',border:'none',borderRadius:'0.6rem',padding:'0.6rem',fontWeight:700,cursor:'pointer',fontSize:'0.875rem'}}>{cancelling ? 'Cancelling…' : 'Yes, cancel'}</button>
                  <button onClick={() => setConfirmCancel(false)} style={{flex:1,background:'none',border:'1px solid #333',borderRadius:'0.6rem',color:'#888',padding:'0.6rem',cursor:'pointer',fontSize:'0.875rem'}}>Keep plan</button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleCancel}
                style={{background:'transparent',border:'1px solid #3a1a1a',color:'#f87171',borderRadius:'0.75rem',padding:'0.7rem',width:'100%',cursor:'pointer',fontSize:'0.875rem',transition:'all 0.2s'}}
              >
                Cancel Subscription
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
