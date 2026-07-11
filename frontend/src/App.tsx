import { useState } from 'react'
import { ArrowLeft, LogOut, Search } from 'lucide-react'
import DocumentList, { type DocSummary } from './DocumentList'
import DocumentEditor from './DocumentEditor'
import Login, { type AuthedUser } from './Login'
import LampToggle from './LampToggle'
import CommandPalette from './CommandPalette'
import Home from './Home'
import Logo from './Logo'

export default function App() {
  // Loading from localStorage means a page refresh doesn't log you out.
  // (A real production app would likely use httpOnly cookies instead of
  // localStorage, to reduce exposure if the site ever had an XSS bug -
  // localStorage is readable by any JS running on the page. Fine for a
  // learning project; worth knowing as a trade-off.)
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [user, setUser] = useState<AuthedUser | null>(() => {
    const saved = localStorage.getItem('user')
    return saved ? JSON.parse(saved) : null
  })
  const [openDoc, setOpenDoc] = useState<DocSummary | null>(null)
  // null = show the Home landing page (logged-out only). Set to 'login' or
  // 'signup' once someone picks a CTA - Login.tsx reads this once as its
  // initialMode, so switching between the two re-mounts Login fresh rather
  // than trying to reactively retarget an already-mounted form.
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null)

  function handleAuthed(newToken: string, newUser: AuthedUser) {
    localStorage.setItem('token', newToken)
    localStorage.setItem('user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  function logOut() {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setToken(null)
    setUser(null)
    setOpenDoc(null)
    setAuthMode(null) // land back on Home, not straight into the login form
  }

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-[840px] items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2 min-w-0">
            {token && user && openDoc && (
              <button
                onClick={() => setOpenDoc(null)}
                className="ease-smooth mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                  text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--bg)] hover:text-[var(--text)]"
                aria-label="Back to documents"
              >
                <ArrowLeft size={17} />
              </button>
            )}
            {(!token || !user) && authMode && (
              <button
                onClick={() => setAuthMode(null)}
                className="ease-smooth mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
                  text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--bg)] hover:text-[var(--text)]"
                aria-label="Back to home"
              >
                <ArrowLeft size={17} />
              </button>
            )}
            <Logo size={22} className="shrink-0" />
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-[var(--text)]">RTEDTR</h1>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {(!token || !user) && !authMode && (
              <button
                onClick={() => setAuthMode('login')}
                className="ease-smooth rounded-lg bg-[var(--accent)] px-3.5 py-1.5 text-sm font-medium
                  text-[var(--accent-contrast)] transition-opacity duration-150 hover:opacity-90"
              >
                Sign in
              </button>
            )}
            {token && user && (
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
                className="ease-smooth hidden items-center gap-2 rounded-lg border border-[var(--border)]
                  px-3.5 py-2 text-sm text-[var(--text-muted)] transition-colors duration-150
                  hover:bg-[var(--bg)] hover:text-[var(--text)] sm:flex"
              >
                <Search size={15} />
                <span className="hidden md:inline">Search</span>
                <kbd className="rounded border border-[var(--border)] px-1.5 py-0.5 text-xs">⌘K</kbd>
              </button>
            )}
            <LampToggle />
            {user && (
              <div className="flex items-center gap-2.5 text-sm text-[var(--text-muted)]">
                <span className="hidden sm:inline">{user.email}</span>
                <button
                  onClick={logOut}
                  className="ease-smooth flex h-8 w-8 items-center justify-center rounded-lg
                    transition-colors duration-150 hover:bg-[var(--bg)] hover:text-[var(--text)]"
                  aria-label="Log out"
                  title="Log out"
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {!token || !user ? (
        authMode ? (
          <main className="mx-auto max-w-[840px] px-5 py-8">
            <Login onAuthed={handleAuthed} initialMode={authMode} />
          </main>
        ) : (
          // Home is full-bleed (Apple-homepage style) - it manages its own
          // section widths internally, so it deliberately isn't wrapped in
          // the 840px reading-width container the rest of the app uses.
          <Home onSignIn={() => setAuthMode('login')} onSignUp={() => setAuthMode('signup')} />
        )
      ) : (
        <main className="mx-auto max-w-[840px] px-5 py-8">
          {openDoc ? (
            <div key={openDoc.id} className="animate-in">
              <DocumentEditor
                key={openDoc.id}
                docId={openDoc.id}
                title={openDoc.title}
                token={token}
                userEmail={user.email}
              />
            </div>
          ) : (
            <DocumentList token={token} onOpen={setOpenDoc} />
          )}
        </main>
      )}

      {token && user && (
        <CommandPalette
          token={token}
          hasOpenDoc={!!openDoc}
          onOpenDoc={setOpenDoc}
          onBackToList={() => setOpenDoc(null)}
          onLogout={logOut}
        />
      )}
    </div>
  )
}
