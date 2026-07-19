import { useState, type FormEvent } from 'react'
import { FileText } from 'lucide-react'
import { AUTH_API_URL as API_URL } from './config'

export type AuthedUser = { id: string; email: string }

// Email verification is disabled for now (see server/src/routes/auth.js) -
// so this only ever needs 'login' or 'signup', both of which log you in
// immediately on success.
type Mode = 'login' | 'signup'

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
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'something went wrong')
      }

      onAuthed(data.token, data.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'something went wrong')
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
            {mode === 'login' ? 'Welcome back' : 'Create an account'}
          </h2>
        </div>

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
            }}
            className={linkButtonClass}
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    </div>
  )
}
