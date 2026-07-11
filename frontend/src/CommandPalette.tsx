import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { FileText, Moon, Sun, LogOut, ArrowLeft, Search } from 'lucide-react'
import { DOCUMENTS_API_URL as API_URL } from './config'
import type { DocSummary } from './DocumentList'
import { useTheme } from './theme'

type Entry = {
  key: string
  label: string
  sub?: string
  icon: typeof FileText
  onSelect: () => void
}

// A Cmd/Ctrl+K overlay for jumping straight to a document or firing a
// quick account action, without hunting through the UI - the kind of thing
// that reads as "considered" on a portfolio project even though the
// building blocks (a filtered list + keyboard nav) are pretty simple.
// Deliberately scoped to navigation + account actions only; it does NOT
// reach into SharesManager/VersionHistory's own open/closed state (those
// manage that internally, not via props from DocumentEditor), so it can't
// deep-link into "open the Share panel" without a larger refactor of those
// two components. Worth revisiting later if that's wanted.
export default function CommandPalette({
  token,
  hasOpenDoc,
  onOpenDoc,
  onBackToList,
  onLogout,
}: {
  token: string | null
  hasOpenDoc: boolean
  onOpenDoc: (doc: DocSummary) => void
  onBackToList: () => void
  onLogout: () => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [docs, setDocs] = useState<DocSummary[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { theme, toggleTheme } = useTheme()

  // Global shortcut: Cmd+K (mac) / Ctrl+K (windows/linux) toggles the
  // palette from anywhere, Escape closes it. Attached to `window` rather
  // than a specific element since it needs to fire regardless of what has
  // focus.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // A plain DOM CustomEvent so a visible header button (see App.tsx) can
  // also open the palette, without lifting `open` state up into App just
  // for that one wiring - the keyboard shortcut stays the "real" API,
  // this is just an alternate trigger for people who don't know it exists.
  useEffect(() => {
    function handleOpenEvent() {
      setOpen(true)
    }
    window.addEventListener('open-command-palette', handleOpenEvent)
    return () => window.removeEventListener('open-command-palette', handleOpenEvent)
  }, [])

  // Fetch a fresh document list each time the palette opens, rather than
  // trying to share DocumentList's fetch/state - simpler, and "fresh every
  // open" is exactly the staleness behavior you'd want from a jump-to tool.
  useEffect(() => {
    if (!open || !token) return
    fetch(API_URL, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : []))
      .then((data: DocSummary[]) => setDocs(data))
      .catch(() => setDocs([]))
  }, [open, token])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
    // Focus after this render commits (the input isn't mounted yet during
    // the same tick that flips `open` to true).
    const id = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  function close() {
    setOpen(false)
  }

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = q ? docs.filter((d) => d.title.toLowerCase().includes(q)) : docs
    return matches.slice(0, 6)
  }, [docs, query])

  // Flattened into one list (docs first, then actions) so arrow-key
  // navigation and Enter don't need to know which "section" they're in.
  const entries = useMemo<Entry[]>(() => {
    const docEntries: Entry[] = filteredDocs.map((d) => ({
      key: `doc-${d.id}`,
      label: d.title,
      sub: d.role,
      icon: FileText,
      onSelect: () => {
        onOpenDoc(d)
        close()
      },
    }))

    const actionEntries: Entry[] = []
    if (hasOpenDoc) {
      actionEntries.push({
        key: 'back',
        label: 'Back to documents',
        icon: ArrowLeft,
        onSelect: () => {
          onBackToList()
          close()
        },
      })
    }
    actionEntries.push({
      key: 'theme',
      label: theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
      icon: theme === 'dark' ? Sun : Moon,
      onSelect: () => {
        toggleTheme()
        close()
      },
    })
    actionEntries.push({
      key: 'logout',
      label: 'Log out',
      icon: LogOut,
      onSelect: () => {
        onLogout()
        close()
      },
    })

    const q = query.trim().toLowerCase()
    const filteredActions = q ? actionEntries.filter((a) => a.label.toLowerCase().includes(q)) : actionEntries

    return [...docEntries, ...filteredActions]
  }, [filteredDocs, hasOpenDoc, theme, query, onOpenDoc, onBackToList, onLogout, toggleTheme])

  function handleInputKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, entries.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      entries[activeIndex]?.onSelect()
    }
  }

  if (!open) return null

  return (
    <div className="modal-backdrop command-palette-backdrop" onClick={close}>
      <div
        className="modal command-palette-modal w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-[var(--border)] px-5 py-4">
          <Search size={19} className="shrink-0 text-[var(--text-muted)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Jump to a document, toggle theme, log out…"
            className="flex-1 bg-transparent text-lg text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
          />
          <kbd className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-muted)]">
            Esc
          </kbd>
        </div>

        <div className="max-h-[28rem] overflow-y-auto p-2.5">
          {entries.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">No matches.</p>
          ) : (
            entries.map((entry, i) => (
              <button
                key={entry.key}
                type="button"
                onClick={entry.onSelect}
                onMouseEnter={() => setActiveIndex(i)}
                className={`ease-smooth flex w-full items-center gap-3 rounded-lg px-3.5 py-3 text-left text-[15px]
                  transition-colors duration-100 ${
                    i === activeIndex ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text)]'
                  }`}
              >
                <entry.icon size={18} className="shrink-0" />
                <span className="flex-1 truncate">{entry.label}</span>
                {entry.sub && <span className="shrink-0 text-xs opacity-60">{entry.sub}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
