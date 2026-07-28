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
        await signUp(email, password, mcUsername.trim(), null)
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
                  minLength={mode === 'signup' ? 8 : undefined}
                />
              </label>

              {mode === 'signup' && (
                <label>
                  Minecraft Username <span style={{color:'#555',fontWeight:400,fontSize:'0.8rem'}}>(optional)</span>
                  <input
                    type="text"
                    value={mcUsername}
                    onChange={e => setMcUsername(e.target.value)}
                    placeholder="Your Minecraft username"
                    autoComplete="off"
                  />
                  <span style={{fontSize:'0.75rem',color:'#555'}}>You can set this later — needed to join the server</span>
                </label>
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
