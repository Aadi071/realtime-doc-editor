import { useState, type FormEvent } from 'react'
import { FileText } from 'lucide-react'
import { AUTH_API_URL as API_URL } from './config'

export type AuthedUser = { id: string; email: string }

// 'verify' is a distinct step, not a third sibling of login/signup - you
// land here either right after signing up, or if you try to log in before
// verifying. It always ends the same way: a successful code check logs you
// in, exactly like a normal login would.
type Mode = 'login' | 'signup' | 'verify'

const inputClass =
  'w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 text-[15px] ' +
  'text-[var(--text)] outline-none transition-shadow duration-200 placeholder:text-[var(--text-muted)] ' +
  'focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]'

const primaryButtonClass =
  'ease-smooth w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[15px] font-medium text-[var(--accent-contrast)] ' +
  'transition-all duration-200 hover:opacity-90 active:scale-[0.98] disabled:cursor-default disabled:opacity-50'

const linkButtonClass = 'ease-smooth text-sm text-[var(--accent)] transition-opacity hover:opacity-70'

export default function Login({
  onAuthed,
  initialMode = 'login',
}: {
  onAuthed: (token: string, user: AuthedUser) => void
  initialMode?: 'login' | 'signup'
}) {
  const [mode, setMode] = useState<Mode>(initialMode)
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

  return (
    <div className="animate-in flex justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-soft)]">
            <FileText size={20} className="text-[var(--accent)]" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--text)]">
            {mode === 'verify' ? 'Verify your email' : mode === 'login' ? 'Welcome back' : 'Create an account'}
          </h2>
          {mode === 'verify' && (
            <p className="mt-1.5 text-sm text-[var(--text-muted)]">
              We sent a 6-digit code to <span className="text-[var(--text)]">{email}</span>
            </p>
          )}
        </div>

        {mode === 'verify' ? (
          <>
            <form onSubmit={submitCode} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="6-digit code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]{6}"
                className={`${inputClass} text-center tracking-[0.3em]`}
                autoFocus
              />
              {info && <p className="text-sm text-emerald-600 dark:text-emerald-400">{info}</p>}
              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
              <button type="submit" disabled={loading} className={primaryButtonClass}>
                {loading ? 'Please wait…' : 'Verify'}
              </button>
            </form>
            <div className="mt-5 flex items-center justify-between">
              <button onClick={resendCode} disabled={loading} className={linkButtonClass}>
                Resend code
              </button>
              <button
                onClick={() => {
                  setMode('login')
                  setError(null)
                  setInfo(null)
                }}
                className="ease-smooth text-sm text-[var(--text-muted)] transition-opacity hover:opacity-70"
              >
                Back to log in
              </button>
            </div>
          </>
        ) : (
          <>
            <form onSubmit={submit} className="flex flex-col gap-3">
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={inputClass}
              />
              <input
                type="password"
                placeholder="Password (min 8 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className={inputClass}
              />
              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
              <button type="submit" disabled={loading} className={primaryButtonClass}>
                {loading ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
              </button>
            </form>
            <p className="mt-5 text-center text-sm text-[var(--text-muted)]">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login')
                  setError(null)
                  setInfo(null)
                }}
                className={linkButtonClass}
              >
                {mode === 'login' ? 'Sign up' : 'Log in'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
