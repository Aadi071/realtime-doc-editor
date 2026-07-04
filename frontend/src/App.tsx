import { useState } from 'react'
import DocumentList, { type DocSummary } from './DocumentList'
import DocumentEditor from './DocumentEditor'
import Login, { type AuthedUser } from './Login'

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
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Real-Time Collaborative Document Editor</h1>
        {user && (
          <div style={{ fontSize: 14, color: '#666' }}>
            {user.email} — <button onClick={logOut}>Log out</button>
          </div>
        )}
      </div>

      {!token || !user ? (
        <Login onAuthed={handleAuthed} />
      ) : openDoc ? (
        <>
          <button onClick={() => setOpenDoc(null)}>&larr; Back to documents</button>
          <div className="editor-shell-wrap" style={{ marginTop: 16 }}>
            <DocumentEditor
              key={openDoc.id}
              docId={openDoc.id}
              title={openDoc.title}
              token={token}
              userEmail={user.email}
            />
          </div>
        </>
      ) : (
        <DocumentList token={token} onOpen={setOpenDoc} />
      )}
    </div>
  )
}
