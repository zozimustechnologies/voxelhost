import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import styles from './StatusPage.module.css'

export default function StatusPage({ onBack }) {
  const { user } = useAuth()
  const [avail, setAvail]       = useState(null)
  const [servers, setServers]   = useState([])
  const [onWaitlist, setOnWaitlist] = useState(false)
  const [joining, setJoining]   = useState(false)

  useEffect(() => {
    supabase.rpc('server_availability').then(({ data }) => setAvail(data))
    supabase.from('server_configs').select('container_id, name, address').then(({ data }) => setServers(data ?? []))
    if (user) {
      supabase.from('waitlist').select('id').eq('user_id', user.id).maybeSingle()
        .then(({ data }) => setOnWaitlist(!!data))
    }
  }, [user])

  async function handleWaitlist() {
    if (!user) return
    setJoining(true)
    await supabase.rpc('join_waitlist', { p_plan_id: null })
    setOnWaitlist(true)
    setJoining(false)
  }

  const free     = avail?.free ?? 0
  const total    = avail?.total ?? 0
  const waitlist = avail?.waitlist ?? 0
  const allFull  = free === 0

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <button className={styles.back} onClick={onBack}>← Back</button>
        <h1 className={styles.title}>Server Status</h1>

        <div className={styles.summary}>
          <div className={`${styles.chip} ${allFull ? styles.chipRed : styles.chipGreen}`}>
            <span className={styles.dot} />
            {allFull ? 'All servers occupied' : `${free} of ${total} servers free`}
          </div>
          {waitlist > 0 && <div className={styles.waitCount}>{waitlist} on waitlist</div>}
        </div>

        <div className={styles.servers}>
          {servers.map(sc => {
            // We don't expose who has each server publicly — just free/occupied
            return (
              <div key={sc.container_id} className={styles.serverRow}>
                <div>
                  <div className={styles.serverName}>{sc.name}</div>
                  <div className={styles.serverAddr}>{sc.address}</div>
                </div>
                <div className={`${styles.tag} ${styles.tagUnknown}`}>
                  {/* Status loaded separately for privacy */}
                  Checking…
                </div>
              </div>
            )
          })}
        </div>

        <ServerStatuses servers={servers} />

        {allFull && user && (
          <div className={styles.waitBox}>
            {onWaitlist ? (
              <p className={styles.waitMsg}>✓ You're on the waitlist. We'll notify you when a server frees up.</p>
            ) : (
              <>
                <p className={styles.waitMsg}>All servers are currently occupied. Join the waitlist and we'll notify you when one is available.</p>
                <button className={styles.waitBtn} onClick={handleWaitlist} disabled={joining}>
                  {joining ? 'Joining…' : 'Join Waitlist'}
                </button>
              </>
            )}
          </div>
        )}

        {allFull && !user && (
          <p className={styles.waitMsg} style={{marginTop:'1rem'}}>Sign in to join the waitlist.</p>
        )}
      </div>
    </div>
  )
}

// Separate component that checks per-server availability client-side
function ServerStatuses({ servers }) {
  const [statuses, setStatuses] = useState({})

  useEffect(() => {
    if (!servers.length) return
    supabase.rpc('server_availability').then(({ data }) => {
      // Use detailed per-server check
      supabase.from('profiles')
        .select('container_id')
        .then(({ data: profiles }) => {
          // This is approximated — exact per-server status uses a separate query
        })
    })
    // Per-server status
    servers.forEach(async (sc) => {
      const { data } = await supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active')
        .in('user_id',
          (await supabase.from('profiles').select('id').eq('container_id', sc.container_id)).data?.map(p => p.id) ?? []
        )
      setStatuses(s => ({ ...s, [sc.container_id]: (data === null || (Array.isArray(data) && data.length === 0)) }))
    })
  }, [servers])

  return (
    <div className={styles.serverStatusOverlay}>
      {servers.map(sc => (
        <div key={sc.container_id} className={styles.statusDot}>
          <span className={`${styles.dot} ${statuses[sc.container_id] === undefined ? styles.dotGrey : statuses[sc.container_id] ? styles.dotGreen : styles.dotRed}`} />
          <span className={styles.serverName}>{sc.name}: {statuses[sc.container_id] === undefined ? 'Checking…' : statuses[sc.container_id] ? 'Free' : 'Occupied'}</span>
        </div>
      ))}
    </div>
  )
}
