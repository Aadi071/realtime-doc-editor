import { useEffect, useRef, useState, type ReactNode, type ChangeEvent } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import VersionHistory from './VersionHistory'
import SharesManager from './SharesManager'
import DrawingModal from './DrawingModal'
import { DOCUMENTS_API_URL as API_URL, WS_URL } from './config'
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough,
  Code as CodeIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Eraser,
  Image as ImageIcon,
  PenLine,
  Undo2,
  Redo2,
  Check,
  Loader2,
} from 'lucide-react'

// 'owner' | 'editor' | 'viewer' = a confirmed role.
// null = we asked the server and were told we have NO access (e.g. revoked).
// undefined = we haven't heard back yet (still loading).
type Role = 'owner' | 'editor' | 'viewer' | null | undefined

// A simple deterministic "string -> color" hash, so the same person always
// gets the same cursor/badge color across reconnects and page reloads,
// without us having to store a color choice anywhere.
function colorForUser(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 65%, 45%)`
}

type ToolbarEditor = NonNullable<ReturnType<typeof useEditor>>

function ToolbarButton({
  active,
  disabled,
  title,
  onClick,
  children,
}: {
  active?: boolean
  disabled?: boolean
  title: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={active ? 'is-active' : ''}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function setLink(editor: ToolbarEditor) {
  const previousUrl = editor.getAttributes('link').href as string | undefined
  const url = window.prompt('URL', previousUrl || 'https://')
  if (url === null) return // cancelled
  if (url === '') {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
}

// Grouped like a Word/Google Docs ribbon: text style, headings, lists,
// alignment, link, then a "clear formatting" escape hatch. The toolbar's
// own CSS (see index.css: `.toolbar { position: sticky; top: 0 }`) is what
// keeps it pinned to the top of the viewport while you scroll a long
// document - the buttons here don't need to know anything about that.
function Toolbar({
  editor,
  onInsertImageClick,
  onDrawClick,
}: {
  editor: ReturnType<typeof useEditor>
  onInsertImageClick: () => void
  onDrawClick: () => void
}) {
  if (!editor) return null

  return (
    <div className="toolbar">
      {/* Collaboration extension ships its own history implementation (a
          Yjs-aware UndoManager under the hood) whenever StarterKit's own
          history is disabled - see `StarterKit.configure({ history: false })`
          below. That means editor.commands.undo()/redo() and the Ctrl+Z /
          Ctrl+Y keyboard shortcuts already work with zero extra wiring;
          these are just visible buttons for the same built-in commands. */}
      <div className="toolbar-group">
        <ToolbarButton
          title="Undo (Ctrl+Z)"
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Redo (Ctrl+Y)"
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 size={16} />
        </ToolbarButton>
      </div>

      <div className="toolbar-group">
        <ToolbarButton
          title="Bold (Ctrl+B)"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Italic (Ctrl+I)"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Underline (Ctrl+U)"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Strikethrough"
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Inline code"
          active={editor.isActive('code')}
          onClick={() => editor.chain().focus().toggleCode().run()}
        >
          <CodeIcon size={16} />
        </ToolbarButton>
      </div>

      <div className="toolbar-group">
        <ToolbarButton
          title="Heading 1"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Heading 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Heading 3"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 size={16} />
        </ToolbarButton>
      </div>

      <div className="toolbar-group">
        <ToolbarButton
          title="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Blockquote"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote size={16} />
        </ToolbarButton>
      </div>

      <div className="toolbar-group">
        <ToolbarButton
          title="Align left"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          <AlignLeft size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Align center"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          <AlignCenter size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Align right"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          <AlignRight size={16} />
        </ToolbarButton>
      </div>

      <div className="toolbar-group">
        <ToolbarButton
          title="Add/edit link"
          active={editor.isActive('link')}
          onClick={() => setLink(editor)}
        >
          <LinkIcon size={16} />
        </ToolbarButton>
        <ToolbarButton
          title="Clear formatting"
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        >
          <Eraser size={16} />
        </ToolbarButton>
      </div>

      <div className="toolbar-group">
        <ToolbarButton title="Insert image" onClick={onInsertImageClick}>
          <ImageIcon size={16} />
        </ToolbarButton>
        <ToolbarButton title="Draw" onClick={onDrawClick}>
          <PenLine size={16} />
        </ToolbarButton>
      </div>
    </div>
  )
}

type Peer = { clientId: number; name: string; color: string; isMe: boolean }

// Google-Docs-style overlapping circular avatars rather than the old text
// pills - a ring in the surface color between avatars is what creates the
// "stacked" look even though each avatar is a plain colored circle.
function PresenceBar({ peers }: { peers: Peer[] }) {
  if (peers.length === 0) return null
  return (
    <div className="flex -space-x-2">
      {peers.map((peer) => (
        <div
          key={peer.clientId}
          title={peer.name + (peer.isMe ? ' (you)' : '')}
          style={{ backgroundColor: peer.color }}
          className="ease-smooth flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2
            border-[var(--surface)] text-[11px] font-semibold text-white transition-transform duration-150
            hover:z-10 hover:scale-110"
        >
          {peer.name.charAt(0).toUpperCase()}
        </div>
      ))}
    </div>
  )
}

const statusDotClass: Record<string, string> = {
  connected: 'bg-emerald-500',
  connecting: 'bg-amber-500',
  disconnected: 'bg-[var(--danger)]',
}

const roleBadgeClass: Record<string, string> = {
  owner: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  editor: 'bg-[var(--surface-2)] text-[var(--text-muted)]',
  viewer: 'bg-[var(--surface-2)] text-[var(--text-muted)]',
}

export default function DocumentEditor({
  docId,
  title,
  token,
  userEmail,
}: {
  docId: string
  title: string
  token: string
  userEmail: string
}) {
  const [ydoc] = useState(() => new Y.Doc())
  const [provider, setProvider] = useState<WebsocketProvider | null>(null)
  const [status, setStatus] = useState('connecting')
  const [role, setRole] = useState<Role>(undefined)
  const [peers, setPeers] = useState<Peer[]>([])
  const [drawingOpen, setDrawingOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Fetch OUR role on this document, then keep polling it every few
  // seconds. This is how a role CHANGE (e.g. an owner switching someone
  // from viewer to editor, or back) reaches an already-open tab without
  // requiring a page refresh - within a few seconds, this picks up the new
  // value and the editable-state effect below reacts to it automatically.
  // (A REVOKE is handled differently and faster - see the WebSocket effect
  // below, where the server forcibly closes the connection immediately.)
  useEffect(() => {
    let cancelled = false

    async function checkRole() {
      try {
        const res = await fetch(`${API_URL}/${docId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (cancelled) return
        if (res.status === 403 || res.status === 404) {
          setRole(null) // confirmed: no access (likely revoked)
          return
        }
        if (!res.ok) return // transient error - leave the current role alone
        const data = await res.json()
        if (!cancelled) setRole(data.role ?? null)
      } catch {
        // network hiccup - don't flip role to "no access" just because one
        // poll failed to reach the server
      }
    }

    checkRole()
    const interval = setInterval(checkRole, 5000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [docId, token])

  useEffect(() => {
    // The browser's native WebSocket API can't send custom headers, so we
    // pass the JWT as a query parameter instead - y-websocket appends
    // `params` onto the connection URL for us. The server verifies this
    // token AND this user's permission on this specific document before
    // accepting the connection at all (see server.js's `upgrade` handler) -
    // so someone without access can't even open a socket to this room,
    // regardless of what the frontend UI does.
    const p = new WebsocketProvider(WS_URL, docId, ydoc, {
      params: { token },
    })

    // Awareness: tell everyone else in this room who we are. This is
    // separate, ephemeral, non-persisted state - it's automatically
    // removed from other clients' view the moment we disconnect (unlike
    // the document content itself, which is durable CRDT state).
    p.awareness.setLocalStateField('user', {
      name: userEmail,
      color: colorForUser(userEmail),
    })

    const handleStatus = (event: { status: string }) => setStatus(event.status)
    p.on('status', handleStatus)
    setProvider(p)

    return () => {
      p.off('status', handleStatus)
      p.destroy()
      setProvider(null)
    }
  }, [docId, ydoc, token, userEmail])

  // Keep a React-state list of "who's currently in this room" by reading
  // provider.awareness.getStates() every time it changes. This powers the
  // presence bar (the CollaborationCursor extension below handles the
  // in-editor cursor rendering on its own, independently of this list).
  useEffect(() => {
    if (!provider) return

    function updatePeers() {
      const states = Array.from(provider!.awareness.getStates().entries())
      setPeers(
        states
          .filter(([, state]) => state.user)
          .map(([clientId, state]) => ({
            clientId,
            name: state.user.name as string,
            color: state.user.color as string,
            isMe: clientId === provider!.awareness.clientID,
          })),
      )
    }

    provider.awareness.on('change', updatePeers)
    updatePeers()
    return () => provider.awareness.off('change', updatePeers)
  }, [provider])

  // Google-Docs-style "Saved"/"Saving…" indicator. NOTE: this is an
  // approximation, not a real save confirmation - the server (see
  // server/src/persistence.js) debounces its actual Postgres write by 2s
  // after the last edit, but never tells connected clients when that write
  // completes; there's no such message in the y-websocket protocol we're
  // using. So instead we mirror the same timing client-side: any change to
  // the document (ours or a collaborator's - it's the DOCUMENT's saved
  // state, not personal to whoever's asking) flips this to "Saving…", then
  // back to "Saved" ~300ms after the server's own debounce window would
  // have elapsed. Good enough to build user confidence; not a substitute
  // for an actual ack if that ever matters more (e.g. a "close tab" guard).
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | null>(null)
  useEffect(() => {
    const saveTimer = { current: null as number | null }
    function handleUpdate() {
      setSaveStatus('saving')
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => setSaveStatus('saved'), 2300)
    }
    ydoc.on('update', handleUpdate)
    return () => {
      ydoc.off('update', handleUpdate)
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [ydoc])

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: false }),
        Collaboration.configure({ document: ydoc }),
        Underline,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Link.configure({ openOnClick: false, autolink: true }),
        Image,
        // Only add cursor rendering once the provider exists - Tiptap
        // extensions are set once when the editor is created, so this
        // waits for `provider` to be ready via the dependency array below.
        ...(provider
          ? [
              CollaborationCursor.configure({
                provider,
                user: { name: userEmail, color: colorForUser(userEmail) },
              }),
            ]
          : []),
      ],
    },
    [ydoc, provider],
  )

  // Keep the editor's editable state in sync with our role once it's known.
  // NOTE: this only prevents the UI from letting a viewer type - it is NOT
  // a real security boundary, since the WebSocket connection itself carries
  // full read/write sync traffic once opened. A technically motivated
  // "viewer" could still craft raw Yjs update messages by hand. Enforcing
  // this properly server-side (rejecting edit operations from viewer-role
  // connections at the sync-protocol level) is real added complexity we're
  // deliberately not taking on here - worth calling out as a known
  // limitation/future improvement in the README.
  useEffect(() => {
    // Allow-list (fail CLOSED) rather than "editable unless viewer" - if
    // role is null/undefined (no confirmed access, or not loaded yet), the
    // editor stays read-only. The old check (`role !== 'viewer'`) would
    // have left a revoked user (role === null) editable, since null isn't
    // 'viewer' either - a real bug this rewrite fixes.
    editor?.setEditable(role === 'owner' || role === 'editor')
  }, [editor, role])

  // If we've been CONFIRMED to have no access (as opposed to just still
  // loading), stop the provider entirely instead of letting it retry
  // forever against a room we're not allowed into anymore.
  useEffect(() => {
    if (role === null && provider) {
      provider.destroy()
    }
  }, [role, provider])

  // Both the file-upload path and the drawing modal end up here: given a
  // data URL (base64-encoded image bytes), insert it as an <img> node.
  // NOTE / known trade-off: this embeds the full image bytes directly in
  // the Yjs document, which then syncs to Postgres via the same debounced
  // snapshot as everything else. Simple and requires no file storage
  // infrastructure, but a document with several photos in it gets
  // noticeably heavier to sync and persist. At real scale you'd upload the
  // image to object storage (S3/R2/etc.) and store just a URL instead.
  function insertImage(dataUrl: string) {
    // `createParagraphNear()` after the image matters more than it looks:
    // without it, the cursor is left as a NodeSelection ON the image you
    // just inserted. Insert a SECOND image right after (e.g. draw, then
    // immediately upload a photo) and Tiptap's `setImage` - which inserts
    // at the current selection - REPLACES that selected image instead of
    // adding a new one alongside it. Moving the cursor into a fresh
    // paragraph after each image keeps inserts additive.
    editor?.chain().focus().setImage({ src: dataUrl }).createParagraphNear().run()
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again later
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') insertImage(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const roleLabel = role ?? (role === null ? 'no access' : 'checking…')

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold text-[var(--text)]">{title}</h2>
          <div className="mt-1.5 flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass[status] ?? 'bg-[var(--text-muted)]'}`} />
              {status}
            </span>
            <span className="opacity-40">·</span>
            <span
              className={`rounded-full px-2 py-0.5 font-medium ${roleBadgeClass[roleLabel] ?? 'bg-[var(--surface-2)]'}`}
            >
              {roleLabel}
            </span>
            {saveStatus && (
              <>
                <span className="opacity-40">·</span>
                <span className="flex items-center gap-1">
                  {saveStatus === 'saving' ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : (
                    <Check size={11} />
                  )}
                  {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
                </span>
              </>
            )}
          </div>
        </div>
        <PresenceBar peers={peers} />
      </div>

      {role === null && (
        <div className="mb-4 rounded-xl bg-[var(--danger-soft)] px-4 py-2.5 text-sm text-[var(--danger)]">
          Your access to this document has been revoked or removed.
        </div>
      )}

      {role === 'viewer' && (
        <div className="mb-4 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
          You have view-only access to this document.
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {role === 'owner' && <SharesManager docId={docId} token={token} />}
        <VersionHistory docId={docId} token={token} role={role} ydoc={ydoc} editor={editor} />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {drawingOpen && (
        <DrawingModal
          onClose={() => setDrawingOpen(false)}
          onInsert={(dataUrl) => {
            insertImage(dataUrl)
            setDrawingOpen(false)
          }}
        />
      )}

      <div className="editor-shell">
        <Toolbar
          editor={editor}
          onInsertImageClick={() => fileInputRef.current?.click()}
          onDrawClick={() => setDrawingOpen(true)}
        />
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
