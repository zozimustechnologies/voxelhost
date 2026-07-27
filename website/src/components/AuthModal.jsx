import { useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import styles from './AuthModal.module.css'

export default function AuthModal({ onClose }) {
  const { signIn, signUp } = useAuth()
  const [mode, setMode]               = useState('signin')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [mcUsername, setMcUsername]   = useState('')
  const [containerId, setContainerId] = useState('102')
  const [error, setError]             = useState(null)
  const [loading, setLoading]         = useState(false)
  const [done, setDone]               = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
        onClose()
      } else {
        await signUp(email, password, mcUsername.trim(), containerId)
        setDone(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        {done ? (
          <div className={styles.done}>
            <div className={styles.doneIcon}>✓</div>
            <h3>Check your email</h3>
            <p>We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account.</p>
          </div>
        ) : (
          <>
            <h2>{mode === 'signin' ? 'Sign in' : 'Create account'}</h2>
            <p className={styles.sub}>
              {mode === 'signin' ? 'Welcome back to VoxelHost.' : 'Start your server today.'}
            </p>

            <form onSubmit={handleSubmit} className={styles.form}>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  placeholder="••••••••"
                  minLength={8}
                />
              </label>

              {mode === 'signup' && (
                <>
                  <label>
                    Minecraft Username
                    <input
                      type="text"
                      value={mcUsername}
                      onChange={e => setMcUsername(e.target.value)}
                      required
                      placeholder="e.g. chdavi"
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    Server
                    <select value={containerId} onChange={e => setContainerId(e.target.value)}>
                      <option value="102">VoxelHost SG-1</option>
                      <option value="103">VoxelHost SG-2</option>
                    </select>
                  </label>
                </>
              )}

              {error && <div className={styles.error}>{error}</div>}

              <button type="submit" className={styles.submit} disabled={loading}>
                {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <p className={styles.toggle}>
              {mode === 'signin' ? "Don't have an account? " : 'Already have one? '}
              <button
                className={styles.toggleBtn}
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
              >
                {mode === 'signin' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
