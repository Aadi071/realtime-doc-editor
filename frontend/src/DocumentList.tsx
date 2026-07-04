import { useEffect, useState, type FormEvent } from 'react'
import { DOCUMENTS_API_URL as API_URL } from './config'

export type DocSummary = {
  id: string
  title: string
  created_at: string
  updated_at: string
  role: 'owner' | 'editor' | 'viewer'
}

export default function DocumentList({
  token,
  onOpen,
}: {
  token: string
  onOpen: (doc: DocSummary) => void
}) {
  const [docs, setDocs] = useState<DocSummary[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const authHeaders = { Authorization: `Bearer ${token}` }

  async function loadDocs() {
    try {
      const res = await fetch(API_URL, { headers: authHeaders })
      if (!res.ok) throw new Error(`server responded ${res.status}`)
      const data: DocSummary[] = await res.json()
      setDocs(data)
      setError(null)
    } catch {
      setError('Could not reach the API server. Is `npm run dev` running inside server/?')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function createDoc(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ title: newTitle || 'Untitled document' }),
    })
    const data = await res.json()

    // IMPORTANT: always check res.ok before trusting the response shape.
    // Without this check, a failed request (e.g. a stale/invalid token)
    // would silently be treated as if it were a real document - which is
    // exactly the bug that made the Share form seem to "disappear" earlier.
    if (!res.ok) {
      setError(data.error || 'failed to create document')
      return
    }

    const doc = data as DocSummary
    setNewTitle('')
    await loadDocs()
    onOpen(doc)
  }

  return (
    <div>
      <h2>Your documents</h2>

      {error && <p style={{ color: '#b3261e' }}>{error}</p>}

      <form onSubmit={createDoc} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New document title"
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit">Create</button>
      </form>

      {loading ? (
        <p>Loading...</p>
      ) : docs.length === 0 ? (
        <p>No documents yet — create one above.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {docs.map((doc) => (
            <li key={doc.id} style={{ marginBottom: 8 }}>
              <button onClick={() => onOpen(doc)} style={{ width: '100%', textAlign: 'left' }}>
                {doc.title} <span style={{ color: '#999', fontSize: 12 }}>({doc.role})</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
