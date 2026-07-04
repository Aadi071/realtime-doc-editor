import { useEffect, useState } from 'react'
import * as Y from 'yjs'
import { yDocToProsemirrorJSON } from 'y-prosemirror'
import type { Editor } from '@tiptap/react'
import { DOCUMENTS_API_URL as API_URL } from './config'

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
  const [message, setMessage] = useState<string | null>(null)
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
    setMessage(null)
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
      setMessage('Version saved.')
      loadVersions()
    } else {
      setMessage('Failed to save version.')
    }
  }

  async function restoreVersion(versionId: string) {
    if (!editor) return
    const confirmed = window.confirm(
      'Replace the current document content with this version? This creates ' +
        'a new edit - it does not erase anything anyone else has written ' +
        'since (Yjs history only ever grows, it never gets deleted).',
    )
    if (!confirmed) return

    const res = await fetch(`${API_URL}/${docId}/versions/${versionId}`, {
      headers: authHeaders,
    })
    const data = await res.json()
    if (!res.ok) {
      setMessage(data.error || 'failed to load version')
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
    setMessage('Restored — this is now a new edit on the live document.')
  }

  const canManage = role === 'owner' || role === 'editor'

  return (
    <div style={{ margin: '12px 0' }}>
      <button onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide version history' : 'Version history'}
      </button>

      {open && (
        <div
          style={{
            border: '1px solid #e2e2e2',
            borderRadius: 6,
            padding: 12,
            marginTop: 8,
            background: '#fafafa',
          }}
        >
          {canManage && (
            <button onClick={saveVersion} style={{ marginBottom: 10 }}>
              Save current version
            </button>
          )}
          {message && <p style={{ fontSize: 13, color: '#666' }}>{message}</p>}

          {versions.length === 0 ? (
            <p style={{ fontSize: 13, color: '#999' }}>No saved versions yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {versions.map((v) => (
                <li
                  key={v.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 0',
                    borderBottom: '1px solid #eee',
                    fontSize: 13,
                  }}
                >
                  <span>
                    {new Date(v.created_at).toLocaleString()}
                    {v.created_by ? ` — ${v.created_by}` : ''}
                  </span>
                  {canManage && <button onClick={() => restoreVersion(v.id)}>Restore</button>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
