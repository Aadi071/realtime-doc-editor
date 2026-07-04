import { useState, type FormEvent } from 'react'
import { AUTH_API_URL as API_URL } from './config'

export type AuthedUser = { id: string; email: string }

// 'verify' is a distinct step, not a third sibling of login/signup - you
// land here either right after signing up, or if you try to log in before
// verifying. It always ends the same way: a successful code check logs you
// in, exactly like a normal login would.
type Mode = 'login' | 'signup' | 'verify'

export default function Login({
  onAuthed,
}: {
  onAuthed: (token: string, user: AuthedUser) => void
}) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(`${API_URL}/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        // The server tells us specifically when the reason login failed is
        // "you never verified this account" (rather than wrong password),
        // so we can route straight to the verify step instead of just
        // showing a dead-end error.
        if (data.unverified) {
          setMode('verify')
          setError(null)
          setInfo('Please verify your email to continue - enter the code we sent you.')
          return
        }
        throw new Error(data.error || 'something went wrong')
      }

      if (mode === 'signup') {
        // Signup never returns a token - it just triggers the email. Move
        // straight to the verify step to finish the job.
        setMode('verify')
        setInfo(data.message || 'Check your email for a verification code.')
      } else {
        onAuthed(data.token, data.user)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function submitCode(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(`${API_URL}/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'invalid or expired code')
      onAuthed(data.token, data.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function resendCode() {
    setLoading(true)
    setError(null)
    setInfo(null)
    try {
      const res = await fetch(`${API_URL}/resend-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      setInfo(data.message || 'If that email needs verifying, a new code has been sent.')
    } catch {
      setError('failed to resend code')
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'verify') {
    return (
      <div style={{ maxWidth: 320 }}>
        <h2>Verify your email</h2>
        <p style={{ color: '#555' }}>
          We sent a 6-digit code to <strong>{email}</strong>.
        </p>
        <form onSubmit={submitCode} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="text"
            placeholder="6-digit code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
            maxLength={6}
            inputMode="numeric"
            pattern="[0-9]{6}"
          />
          {info && <p style={{ color: '#2b8a3e', margin: 0 }}>{info}</p>}
          {error && <p style={{ color: '#b3261e', margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? 'Please wait...' : 'Verify'}
          </button>
        </form>
        <button
          onClick={resendCode}
          disabled={loading}
          style={{
            marginTop: 12,
            background: 'none',
            border: 'none',
            color: '#3b5bdb',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Resend code
        </button>
        <br />
        <button
          onClick={() => {
            setMode('login')
            setError(null)
            setInfo(null)
          }}
          style={{
            marginTop: 8,
            background: 'none',
            border: 'none',
            color: '#666',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          Back to log in
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 320 }}>
      <h2>{mode === 'login' ? 'Log in' : 'Create an account'}</h2>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        {error && <p style={{ color: '#b3261e', margin: 0 }}>{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>
      <button
        onClick={() => {
          setMode(mode === 'login' ? 'signup' : 'login')
          setError(null)
          setInfo(null)
        }}
        style={{
          marginTop: 12,
          background: 'none',
          border: 'none',
          color: '#3b5bdb',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
      </button>
    </div>
  )
}
