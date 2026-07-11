import { useEffect, useState } from 'react'
import { History, RotateCcw } from 'lucide-react'

type Stage = 'editing' | 'panelOpen' | 'restoring' | 'restored'

const SEQUENCE: { stage: Stage; duration: number }[] = [
  { stage: 'editing', duration: 1800 },
  { stage: 'panelOpen', duration: 1600 },
  { stage: 'restoring', duration: 700 },
  { stage: 'restored', duration: 1800 },
]
const TOTAL_MS = SEQUENCE.reduce((sum, s) => sum + s.duration, 0)
const TICK_MS = 100

const CURRENT_TEXT = 'Q3 roadmap: ship the mobile app.'
const OLD_TEXT = 'Q3 roadmap: ship the redesign.'

// A staged recreation of restoring a version - matches the real
// VersionHistory.tsx panel's actual layout (header, timestamped rows, a
// Restore button) closely enough to read as "this is what that feature
// looks like" without being a live capture of it. Runs on a single
// elapsed-time interval rather than a chain of setTimeouts, so cleanup on
// unmount is just one clearInterval instead of tracking several timers.
export default function VersionHistoryMockup() {
  const [stage, setStage] = useState<Stage>('editing')

  useEffect(() => {
    let elapsed = 0
    const interval = window.setInterval(() => {
      elapsed = (elapsed + TICK_MS) % TOTAL_MS
      let acc = 0
      for (const { stage: s, duration } of SEQUENCE) {
        acc += duration
        if (elapsed < acc) {
          setStage(s)
          break
        }
      }
    }, TICK_MS)
    return () => window.clearInterval(interval)
  }, [])

  const showingOld = stage === 'restoring' || stage === 'restored'

  return (
    <div className="relative flex h-full w-full flex-col gap-3 p-6">
      <div className="h-2.5 w-3/5 rounded-full bg-[var(--border)]" />
      <p className="text-[15px] leading-relaxed text-[var(--text)] transition-opacity duration-300">
        {showingOld ? OLD_TEXT : CURRENT_TEXT}
      </p>
      <div className="h-2.5 w-4/5 rounded-full bg-[var(--border)]" />

      {(stage === 'panelOpen' || stage === 'restoring') && (
        <div className="animate-in absolute right-5 top-5 w-48 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5 shadow-lg">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-[var(--text-muted)]">
            <History size={11} />
            Version history
          </div>
          <div className="flex items-center justify-between rounded-lg px-1.5 py-1 text-[11px] text-[var(--text-muted)]">
            <span>Just now</span>
          </div>
          <div
            className={`flex items-center justify-between rounded-lg px-1.5 py-1 text-[11px] transition-colors duration-200 ${
              stage === 'restoring' ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'text-[var(--text-muted)]'
            }`}
          >
            <span>2 hours ago</span>
            <RotateCcw size={10} />
          </div>
        </div>
      )}
    </div>
  )
}
