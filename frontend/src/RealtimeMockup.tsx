import { useEffect, useState } from 'react'

const SENTENCE = "Real-time sync means nobody's edit gets lost."
const SPLIT = Math.ceil(SENTENCE.length / 2) // where authorship visually hands off
const TYPE_MS = 45
const HOLD_MS = 2200
const START_DELAY_MS = 500

const ALEX = { name: 'Alex', color: '#3b82f6' }
const SAM = { name: 'Sam', color: '#10b981' }

// A staged recreation of live collaborative editing - not a real capture
// of the app (that would need two real browser sessions and screen-
// recording tooling), just enough of its actual visual language - the
// presence avatars, a per-person colored cursor - to sell the idea in a
// few seconds on a loop. Reuses the "type from a starting point, hand off
// partway through" motif the hero wordmark already establishes, just with
// a sentence instead of a 6-letter word.
export default function RealtimeMockup() {
  const [typed, setTyped] = useState(0)

  useEffect(() => {
    let cancelled = false
    let typeInterval: number | undefined
    let holdTimeout: number | undefined

    function cycle() {
      setTyped(0)
      let i = 0
      typeInterval = window.setInterval(() => {
        i++
        setTyped(i)
        if (i >= SENTENCE.length) {
          window.clearInterval(typeInterval)
          holdTimeout = window.setTimeout(() => {
            if (!cancelled) cycle()
          }, HOLD_MS)
        }
      }, TYPE_MS)
    }

    const startTimeout = window.setTimeout(cycle, START_DELAY_MS)
    return () => {
      cancelled = true
      window.clearTimeout(startTimeout)
      if (typeInterval) window.clearInterval(typeInterval)
      if (holdTimeout) window.clearTimeout(holdTimeout)
    }
  }, [])

  const author = typed <= SPLIT ? ALEX : SAM
  const done = typed >= SENTENCE.length

  return (
    <div className="flex h-full w-full flex-col justify-between p-6">
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-semibold text-white"
            style={{ background: ALEX.color, borderColor: 'var(--surface-2)' }}
          >
            A
          </span>
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full border-2 text-[10px] font-semibold text-white"
            style={{ background: SAM.color, borderColor: 'var(--surface-2)' }}
          >
            S
          </span>
        </div>
        <span className="text-xs text-[var(--text-muted)]">Alex &amp; Sam are editing</span>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="h-2.5 w-4/5 rounded-full bg-[var(--border)]" />
        <div className="h-2.5 w-3/5 rounded-full bg-[var(--border)]" />
        <p className="mt-1 min-h-[1.4em] text-[15px] leading-relaxed text-[var(--text)]">
          {SENTENCE.slice(0, typed)}
          {!done && (
            <span
              className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] align-middle"
              style={{ background: author.color }}
            />
          )}
        </p>
      </div>

      <div
        className="flex items-center gap-1.5 text-xs transition-opacity duration-300"
        style={{ color: author.color, opacity: done ? 0 : 1 }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: author.color }} />
        {author.name} is typing…
      </div>
    </div>
  )
}
