import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'

// A small, dependency-free stand-in for something like HeroUI's toast() —
// same idea (fire-and-forget notification, auto-dismiss, a few variants)
// without pulling in a whole component library for three call sites.
type ToastVariant = 'success' | 'error' | 'info'
type ToastItem = { id: number; message: string; variant: ToastVariant }

type ToastAPI = {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastAPI | null>(null)

const DURATION = 4000

const variantMeta: Record<ToastVariant, { icon: typeof CheckCircle2; accentClass: string }> = {
  success: { icon: CheckCircle2, accentClass: 'text-emerald-500' },
  error: { icon: XCircle, accentClass: 'text-[var(--danger)]' },
  info: { icon: Info, accentClass: 'text-[var(--accent)]' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  // A plain ref counter rather than crypto.randomUUID() - toasts are
  // ordered/ephemeral, a monotonically increasing id is all dismiss() needs
  // to find the right one.
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = nextId.current++
      setToasts((current) => [...current, { id, message, variant }])
      window.setTimeout(() => dismiss(id), DURATION)
    },
    [dismiss],
  )

  const api: ToastAPI = {
    success: (message) => push('success', message),
    error: (message) => push('error', message),
    info: (message) => push('info', message),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* Fixed top-right stack, above modals (z-100) and dropdowns (z-20).
          pointer-events-none on the wrapper + pointer-events-auto on each
          toast means empty space in the stack never blocks clicks on
          whatever's underneath it. */}
      <div className="pointer-events-none fixed right-4 top-4 z-[200] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => {
          const { icon: Icon, accentClass } = variantMeta[t.variant]
          return (
            <div
              key={t.id}
              className="toast-in pointer-events-auto flex items-start gap-2.5 rounded-xl border border-[var(--border)]
                bg-[var(--surface)] px-3.5 py-3 text-sm shadow-lg"
            >
              <Icon size={16} className={`mt-0.5 shrink-0 ${accentClass}`} />
              <p className="flex-1 text-[var(--text)]">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="ease-smooth shrink-0 rounded-md p-0.5 text-[var(--text-muted)] transition-colors
                  duration-150 hover:bg-[var(--bg)] hover:text-[var(--text)]"
              >
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside a ToastProvider')
  return ctx
}
