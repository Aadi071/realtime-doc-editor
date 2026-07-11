import { useEffect, useState, type FormEvent } from 'react'
import { Share2, X } from 'lucide-react'
import { DOCUMENTS_API_URL as API_URL } from './config'
import { useToast } from './toast'

type Share = { email: string; role: 'viewer' | 'editor' }

const selectClass =
  'rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-xs text-[var(--text)] ' +
  'outline-none transition-colors duration-150 focus:border-[var(--accent)]'

const triggerClass = (open: boolean) =>
  `ease-smooth flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ` +
  `transition-colors duration-150 ${
    open
      ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
      : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--bg)]'
  }`

export default function SharesManager({ docId, token }: { docId: string; token: string }) {
  const [open, setOpen] = useState(false)
  const [shares, setShares] = useState<Share[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'viewer' | 'editor'>('editor')
  const toast = useToast()
  const authHeaders = { Authorization: `Bearer ${token}` }

  async function loadShares() {
    const res = await fetch(`${API_URL}/${docId}/shares`, { headers: authHeaders })
    if (res.ok) setShares(await res.json())
  }

  useEffect(() => {
    if (open) loadShares()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, open])

  async function addShare(e: FormEvent) {
    e.preventDefault()
    const res = await fetch(`${API_URL}/${docId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ email, role }),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success(`Shared with ${email} as ${role}`)
      setEmail('')
      loadShares()
    } else {
      toast.error(data.error || 'Failed to share')
    }
  }

  // Changing an existing collaborator's role reuses the exact same
  // POST /share endpoint (it's an upsert) - the only thing that changes is
  // where the email comes from (an existing row, not a fresh input). The
  // person whose role changed will pick this up automatically within a few
  // seconds via DocumentEditor's polling, without needing a page refresh.
  async function changeRole(targetEmail: string, newRole: 'viewer' | 'editor') {
    const res = await fetch(`${API_URL}/${docId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ email: targetEmail, role: newRole }),
    })
    if (res.ok) {
      toast.success(`${targetEmail} can now ${newRole === 'editor' ? 'edit' : 'view'}`)
    } else {
      toast.error('Failed to change role')
    }
    loadShares()
  }

  // Revoking is a hard, immediate cutoff - the server forcibly closes that
  // person's live connection to this document the moment this call
  // succeeds (see server's DELETE /shares/:email handler), rather than
  // relying on them to notice on their own.
  async function revoke(targetEmail: string) {
    const res = await fetch(`${API_URL}/${docId}/shares/${encodeURIComponent(targetEmail)}`, {
      method: 'DELETE',
      headers: authHeaders,
    })
    if (res.ok) {
      toast.info(`Removed ${targetEmail}`)
    } else {
      toast.error('Failed to remove access')
    }
    loadShares()
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className={triggerClass(open)}>
        <Share2 size={14} />
        Share
      </button>

      {open && (
        <div className="animate-in absolute left-0 top-full z-20 mt-2 w-80 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
          <form onSubmit={addShare} className="flex items-center gap-1.5">
            <input
              type="email"
              placeholder="Share with email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5
                text-sm text-[var(--text)] outline-none transition-colors duration-150 focus:border-[var(--accent)]"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'viewer' | 'editor')}
              className={selectClass}
            >
              <option value="editor">Can edit</option>
              <option value="viewer">Can view</option>
            </select>
            <button
              type="submit"
              className="ease-smooth shrink-0 rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium
                text-[var(--accent-contrast)] transition-opacity duration-150 hover:opacity-90"
            >
              Share
            </button>
          </form>

          {shares.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5 border-t border-[var(--border)] pt-3">
              {shares.map((s) => (
                <li key={s.email} className="flex items-center gap-2">
                  <span className="flex-1 truncate text-sm text-[var(--text)]">{s.email}</span>
                  <select
                    value={s.role}
                    onChange={(e) => changeRole(s.email, e.target.value as 'viewer' | 'editor')}
                    className={selectClass}
                  >
                    <option value="editor">Can edit</option>
                    <option value="viewer">Can view</option>
                  </select>
                  <button
                    onClick={() => revoke(s.email)}
                    aria-label={`Remove ${s.email}`}
                    className="ease-smooth flex h-6 w-6 shrink-0 items-center justify-center rounded-md
                      text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                  >
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
