import { useEffect, useState, type FormEvent } from 'react'
import { FileText, Plus } from 'lucide-react'
import { DOCUMENTS_API_URL as API_URL } from './config'
import { TEMPLATES } from './templates'

export type DocSummary = {
  id: string
  title: string
  created_at: string
  updated_at: string
  role: 'owner' | 'editor' | 'viewer'
}

const roleBadgeClass: Record<DocSummary['role'], string> = {
  owner: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  editor: 'bg-[var(--surface-2)] text-[var(--text-muted)]',
  viewer: 'bg-[var(--surface-2)] text-[var(--text-muted)]',
}

export default function DocumentList({
  token,
  onOpen,
}: {
  token: string
  // templateHtml is only ever passed for a document JUST created here, with
  // a non-blank template selected - see templates.ts. Opening an existing
  // document from the list below always omits it.
  onOpen: (doc: DocSummary, templateHtml?: string) => void
}) {
  const [docs, setDocs] = useState<DocSummary[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id)
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
    const template = TEMPLATES.find((t) => t.id === templateId)
    setNewTitle('')
    setTemplateId(TEMPLATES[0].id)
    await loadDocs()
    onOpen(doc, template?.html)
  }

  return (
    <div className="animate-in">
      <h2 className="mb-4 text-lg font-semibold text-[var(--text)]">Your documents</h2>

      {error && (
        <p className="mb-4 rounded-lg bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">{error}</p>
      )}

      <form onSubmit={createDoc} className="mb-6">
        <div className="flex gap-2">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New document title"
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[15px]
              text-[var(--text)] outline-none transition-shadow duration-200 placeholder:text-[var(--text-muted)]
              focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
          />
          <button
            type="submit"
            className="ease-smooth flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-[15px]
              font-medium text-[var(--accent-contrast)] transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
          >
            <Plus size={16} />
            Create
          </button>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              type="button"
              title={template.description}
              onClick={() => setTemplateId(template.id)}
              className={`ease-smooth rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 ${
                templateId === template.id
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--text)]'
              }`}
            >
              {template.name}
            </button>
          ))}
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-10 text-center text-sm text-[var(--text-muted)]">
          No documents yet — create one above.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {docs.map((doc) => (
            <li key={doc.id}>
              <button
                onClick={() => onOpen(doc)}
                className="ease-smooth group flex w-full items-center gap-3 rounded-xl border border-[var(--border)]
                  bg-[var(--surface)] px-4 py-3 text-left transition-all duration-150 hover:border-[var(--accent)]
                  hover:shadow-sm active:scale-[0.995]"
              >
                <FileText size={18} className="shrink-0 text-[var(--text-muted)] group-hover:text-[var(--accent)]" />
                <span className="flex-1 truncate text-[15px] text-[var(--text)]">{doc.title}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${roleBadgeClass[doc.role]}`}
                >
                  {doc.role}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
