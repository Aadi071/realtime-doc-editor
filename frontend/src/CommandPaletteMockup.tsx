import { useEffect, useState } from 'react'
import { Search, FileText } from 'lucide-react'

type Stage = 'idle' | 'typing' | 'results' | 'selected'

const QUERY = 'roadmap'
const RESULTS = ['Q3 roadmap', 'Roadmap review notes', 'Product roadmap 2027']

const SEQUENCE: { stage: Stage; duration: number }[] = [
  { stage: 'idle', duration: 700 },
  { stage: 'typing', duration: QUERY.length * 90 + 300 },
  { stage: 'results', duration: 1400 },
  { stage: 'selected', duration: 900 },
]
const TOTAL_MS = SEQUENCE.reduce((sum, s) => sum + s.duration, 0)
const TICK_MS = 80

// A staged recreation of the command palette - matches CommandPalette.tsx's
// actual layout (search row with an icon, a filtered result list) closely
// enough to read as "this is what ⌘K does" on a loop, without needing a
// live document list or a real keypress to drive it.
export default function CommandPaletteMockup() {
  const [stage, setStage] = useState<Stage>('idle')
  const [elapsedInStage, setElapsedInStage] = useState(0)

  useEffect(() => {
    let elapsed = 0
    const interval = window.setInterval(() => {
      elapsed = (elapsed + TICK_MS) % TOTAL_MS
      let acc = 0
      for (const { stage: s, duration } of SEQUENCE) {
        if (elapsed < acc + duration) {
          setStage(s)
          setElapsedInStage(elapsed - acc)
          break
        }
        acc += duration
      }
    }, TICK_MS)
    return () => window.clearInterval(interval)
  }, [])

  const typedChars =
    stage === 'typing' ? Math.min(QUERY.length, Math.floor(elapsedInStage / 90)) : stage === 'idle' ? 0 : QUERY.length

  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <div className="w-full max-w-[260px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-lg">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
          <Search size={13} className="shrink-0 text-[var(--text-muted)]" />
          <span className="text-[13px] text-[var(--text)]">
            {QUERY.slice(0, typedChars)}
            <span className="logo-cursor-blink inline-block h-[1em] w-[1.5px] translate-y-[2px] bg-[var(--accent)] align-middle" />
          </span>
        </div>

        {(stage === 'results' || stage === 'selected') && (
          <div className="flex flex-col gap-0.5 p-1.5">
            {RESULTS.map((r, i) => (
              <div
                key={r}
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] transition-colors duration-200 ${
                  i === 0 && stage === 'selected'
                    ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                    : i === 0
                      ? 'bg-[var(--bg)] text-[var(--text)]'
                      : 'text-[var(--text-muted)]'
                }`}
              >
                <FileText size={11} className="shrink-0" />
                <span className="truncate">{r}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
