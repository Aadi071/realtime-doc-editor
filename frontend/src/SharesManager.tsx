import { useEffect, useState, type FormEvent } from 'react'
import { DOCUMENTS_API_URL as API_URL } from './config'

type Share = { email: string; role: 'viewer' | 'editor' }

export default function SharesManager({ docId, token }: { docId: string; token: string }) {
  const [shares, setShares] = useState<Share[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'viewer' | 'editor'>('editor')
  const [message, setMessage] = useState<string | null>(null)
  const authHeaders = { Authorization: `Bearer ${token}` }

  async function loadShares() {
    const res = await fetch(`${API_URL}/${docId}/shares`, { headers: authHeaders })
    if (res.ok) setShares(await res.json())
  }

  useEffect(() => {
    loadShares()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])

  async function addShare(e: FormEvent) {
    e.preventDefault()
    setMessage(null)
    const res = await fetch(`${API_URL}/${docId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ email, role }),
    })
    const data = await res.json()
    if (res.ok) {
      setMessage(`Shared with ${email} as ${role}`)
      setEmail('')
      loadShares()
    } else {
      setMessage(data.error || 'failed to share')
    }
  }

  // Changing an existing collaborator's role reuses the exact same
  // POST /share endpoint (it's an upsert) - the only thing that changes is
  // where the email comes from (an existing row, not a fresh input). The
  // person whose role changed will pick this up automatically within a few
  // seconds via DocumentEditor's polling, without needing a page refresh.
  async function changeRole(targetEmail: string, newRole: 'viewer' | 'editor') {
    await fetch(`${API_URL}/${docId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ email: targetEmail, role: newRole }),
    })
    loadShares()
  }

  // Revoking is a hard, immediate cutoff - the server forcibly closes that
  // person's live connection to this document the moment this call
  // succeeds (see server's DELETE /shares/:email handler), rather than
  // relying on them to notice on their own.
  async function revoke(targetEmail: string) {
    await fetch(`${API_URL}/${docId}/shares/${encodeURIComponent(targetEmail)}`, {
      method: 'DELETE',
      headers: authHeaders,
    })
    loadShares()
  }

  return (
    <div style={{ margin: '12px 0' }}>
      <form onSubmit={addShare} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="email"
          placeholder="Share with email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <select value={role} onChange={(e) => setRole(e.target.value as 'viewer' | 'editor')}>
          <option value="editor">Can edit</option>
          <option value="viewer">Can view</option>
        </select>
        <button type="submit">Share</button>
        {message && <span style={{ fontSize: 13, color: '#666' }}>{message}</span>}
      </form>

      {shares.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 10 }}>
          {shares.map((s) => (
            <li
              key={s.email}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 0',
                fontSize: 13,
              }}
            >
              <span style={{ flex: 1 }}>{s.email}</span>
              <select
                value={s.role}
                onChange={(e) => changeRole(s.email, e.target.value as 'viewer' | 'editor')}
              >
                <option value="editor">Can edit</option>
                <option value="viewer">Can view</option>
              </select>
              <button onClick={() => revoke(s.email)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
