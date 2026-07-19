import { AlertTriangle } from 'lucide-react'

// A themed replacement for window.confirm(). Two independent reasons this
// exists rather than just calling the native dialog: (1) it looks jarring
// next to the rest of the redesigned UI, and (2) the native dialog blocks
// Chrome DevTools Protocol automation entirely - it stalled the regression
// pass earlier in this project until worked around with a JS monkey-patch.
// Reuses the same .modal-backdrop/.modal keyframe animations as DrawingModal.
export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start gap-3">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              danger ? 'bg-[var(--danger-soft)] text-[var(--danger)]' : 'bg-[var(--accent-soft)] text-[var(--accent)]'
            }`}
          >
            <AlertTriangle size={17} />
          </div>
          <h3 className="mt-1 text-base font-semibold text-[var(--text)]">{title}</h3>
        </div>

        <p className="mb-5 text-sm leading-relaxed text-[var(--text-muted)]">{message}</p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="ease-smooth rounded-lg border border-[var(--border)] px-3.5 py-1.5 text-sm font-medium
              text-[var(--text)] transition-colors duration-150 hover:bg-[var(--bg)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`ease-smooth rounded-lg px-3.5 py-1.5 text-sm font-medium transition-opacity duration-150
              hover:opacity-90 ${
                danger
                  ? 'bg-[var(--danger)] text-white'
                  : 'bg-[var(--accent)] text-[var(--accent-contrast)]'
              }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
