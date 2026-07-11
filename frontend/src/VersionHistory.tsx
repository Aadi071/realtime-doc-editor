import { useEffect, useState } from 'react'
import { History, RotateCcw } from 'lucide-react'
import * as Y from 'yjs'
import { yDocToProsemirrorJSON } from 'y-prosemirror'
import type { Editor } from '@tiptap/react'
import { DOCUMENTS_API_URL as API_URL } from './config'
import { useToast } from './toast'
import ConfirmModal from './ConfirmModal'

type VersionSummary = { id: string; created_at: string; created_by: string | null }

// Browsers don't have a built-in Uint8Array <-> base64 helper, so we
// piggyback on atob/btoa (which work on "binary strings") by converting
// byte-by-byte.
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export default function VersionHistory({
  docId,
  token,
  role,
  ydoc,
  editor,
}: {
  docId: string
  token: string
  role: 'owner' | 'editor' | 'viewer' | null | undefined
  ydoc: Y.Doc
  editor: Editor | null
}) {
  const [versions, setVersions] = useState<VersionSummary[]>([])
  const [open, setOpen] = useState(false)
  // The id of the version awaiting a confirm/cancel decision in the modal -
  // null means no confirmation is currently showing.
  const [pendingRestoreId, setPendingRestoreId] = useState<string | null>(null)
  const toast = useToast()
  const authHeaders = { Authorization: `Bearer ${token}` }

  async function loadVersions() {
    const res = await fetch(`${API_URL}/${docId}/versions`, { headers: authHeaders })
    if (res.ok) setVersions(await res.json())
  }

  useEffect(() => {
    if (open) loadVersions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function saveVersion() {
    // encodeStateAsUpdate() captures the ENTIRE current document state, not
    // just the latest edit - the same technique the server's autosave
    // uses, just triggered on demand instead of on a debounce timer.
    const bytes = Y.encodeStateAsUpdate(ydoc)
    const res = await fetch(`${API_URL}/${docId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ content: uint8ToBase64(bytes) }),
    })
    if (res.ok) {
      toast.success('Version saved.')
      loadVersions()
    } else {
      toast.error('Failed to save version.')
    }
  }

  // Split into "ask" (opens the modal) and "run" (does the actual work,
  // called once the modal is confirmed) - window.confirm() used to make
  // this synchronous, a themed modal makes it inherently async since it
  // waits for a button click on a later render.
  function askRestoreVersion(versionId: string) {
    setPendingRestoreId(versionId)
  }

  async function runRestoreVersion(versionId: string) {
    setPendingRestoreId(null)
    if (!editor) return

    const res = await fetch(`${API_URL}/${docId}/versions/${versionId}`, {
      headers: authHeaders,
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error || 'Failed to load version')
      return
    }

    // Decode the OLD snapshot into a throwaway Y.Doc - never connected to
    // any network, just used locally to read its content back out as
    // normal ProseMirror JSON. We then apply that as a FRESH edit via
    // Tiptap's own command, so it flows through the same live, synced
    // `ydoc` as any other keystroke would. This is the key idea from
    // earlier: we are not rewinding the CRDT's history, we're making a new
    // edit that happens to match an old state.
    const tempDoc = new Y.Doc()
    Y.applyUpdate(tempDoc, base64ToUint8(data.content))
    const json = yDocToProsemirrorJSON(tempDoc, 'default')
    editor.commands.setContent(json)
    toast.success('Restored — this is now a new edit on the live document.')
  }

  const canManage = role === 'owner' || role === 'editor'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`ease-smooth flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium
          transition-colors duration-150 ${
            open
              ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
              : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--bg)]'
          }`}
      >
        <History size={14} />
        History
      </button>

      {open && (
        <div className="animate-in absolute left-0 top-full z-20 mt-2 w-80 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-lg">
          {canManage && (
            <button
              onClick={saveVersion}
              className="ease-smooth mb-3 w-full rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium
                text-[var(--accent-contrast)] transition-opacity duration-150 hover:opacity-90"
            >
              Save current version
            </button>
          )}

          {versions.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No saved versions yet.</p>
          ) : (
            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-2 border-b border-[var(--border)] py-2 text-xs last:border-0"
                >
                  <span className="text-[var(--text-muted)]">
                    {new Date(v.created_at).toLocaleString()}
                    {v.created_by ? ` — ${v.created_by}` : ''}
                  </span>
                  {canManage && (
                    <button
                      onClick={() => askRestoreVersion(v.id)}
                      className="ease-smooth flex shrink-0 items-center gap-1 rounded-md px-2 py-1 font-medium
                        text-[var(--accent)] transition-colors duration-150 hover:bg-[var(--accent-soft)]"
                    >
                      <RotateCcw size={12} />
                      Restore
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {pendingRestoreId && (
        <ConfirmModal
          title="Restore this version?"
          message="Replace the current document content with this version? This creates a new edit - it does not erase anything anyone else has written since (Yjs history only ever grows, it never gets deleted)."
          confirmLabel="Restore"
          onConfirm={() => runRestoreVersion(pendingRestoreId)}
          onCancel={() => setPendingRestoreId(null)}
        />
      )}
    </div>
  )
}
