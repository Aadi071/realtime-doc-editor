import { useEffect, useRef, useState } from 'react'
import Logo from './Logo'

const WORD = 'RTEDTR'
const START_DELAY_MS = 450 // let the badge above fade in first
const STEP_MS = 190 // gap between each pair of letters landing
const MERGE_PAUSE_MS = 380 // beat between "fully typed" and the merge pulse
const FLOURISH_INTERVAL_MS = 10000 // how often the idle wordmark does something
const FLOURISH_DURATION_MS: Record<'swap' | 'documentPop', number> = { swap: 1400, documentPop: 1200 }

type Cursor = 'left' | 'right' | null
type Flourish = 'swap' | 'documentPop' | null

// RTEDTR mirrors itself letter-for-letter: R-T at the start, T-R at the
// end. The "swap" flourish leans into that instead of just nudging two
// adjacent letters - the opening R arcs all the way across to where the
// closing R sits (and back), and the opening T does the same with the
// closing T, so the two mirrored pairs visibly trade places. Indices are
// hardcoded rather than computed generically since WORD is a fixed
// constant, not a general-purpose input.
function swapClassFor(i: number): string {
  if (i === 0) return 'letter-mirror-r-start' // R (start) <-> R (end)
  if (i === 5) return 'letter-mirror-r-end'
  if (i === 1) return 'letter-mirror-t-start' // T (start) <-> T (end)
  if (i === 4) return 'letter-mirror-t-end'
  return ''
}

// The hero wordmark doesn't just fade in - it types itself in from both
// ends toward the middle, like two people racing to finish the same word
// from opposite directions. Left letters land in the accent color, right
// letters land in emerald (the same emerald used for "connected" status
// elsewhere in the app - see DocumentEditor.tsx's statusDotClass), then
// once they meet in the center both sides settle to the normal text color
// with a brief pulse. It's a small, self-referential flourish: the exact
// thing this product is about - two writers converging on the same result
// without colliding - played out in the logo itself, rather than just
// described in a feature card below it.
//
// Once settled, it doesn't just sit there either - every ~10s it does one
// of two small idle flourishes: the R and T trade places in a quick arc
// (letters "switching places," never actually reordering the underlying
// text - the DOM/aria-label stays "RTEDTR" throughout, this is purely
// visual), or the whole word gives a staggered little pop as a faint Logo
// icon flashes in behind it, like the word is being freshly pulled off
// the page again.
export default function TypedWordmark({ className = '' }: { className?: string }) {
  const half = Math.ceil(WORD.length / 2)
  const [revealedBy, setRevealedBy] = useState<Cursor[]>(() => WORD.split('').map(() => null))
  const [merged, setMerged] = useState(false)
  const [flourish, setFlourish] = useState<Flourish>(null)
  const reducedMotion = useRef(false)

  // Initial type-in sequence.
  useEffect(() => {
    reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion.current) {
      // Skip straight to the finished state - no typing, no pulse, and
      // (see the effect below) no recurring flourishes either.
      setRevealedBy(WORD.split('').map(() => 'left'))
      setMerged(true)
      return
    }

    const timers: number[] = []
    for (let step = 0; step < half; step++) {
      const leftIndex = step
      const rightIndex = WORD.length - 1 - step
      timers.push(
        window.setTimeout(
          () => {
            setRevealedBy((prev) => {
              const next = [...prev]
              next[leftIndex] = 'left'
              if (rightIndex !== leftIndex) next[rightIndex] = 'right'
              return next
            })
          },
          START_DELAY_MS + step * STEP_MS,
        ),
      )
    }
    timers.push(window.setTimeout(() => setMerged(true), START_DELAY_MS + half * STEP_MS + MERGE_PAUSE_MS))
    return () => timers.forEach((t) => window.clearTimeout(t))
  }, [half])

  // Recurring idle flourishes, once the initial sequence has settled.
  useEffect(() => {
    if (!merged || reducedMotion.current) return
    let toggle = 0
    let pendingTimeout: number | undefined
    const interval = window.setInterval(() => {
      const next = toggle % 2 === 0 ? 'swap' : 'documentPop'
      setFlourish(next)
      toggle += 1
      pendingTimeout = window.setTimeout(() => setFlourish(null), FLOURISH_DURATION_MS[next])
    }, FLOURISH_INTERVAL_MS)
    return () => {
      window.clearInterval(interval)
      if (pendingTimeout) window.clearTimeout(pendingTimeout)
    }
  }, [merged])

  // The two letters where the left and right cursors meet - odd-length
  // words would have exactly one meeting letter, but WORD is even (6), so
  // it's a pair right in the middle.
  const middleIndices = new Set([half - 1, WORD.length - half])

  return (
    <div className="relative inline-block">
      {flourish === 'documentPop' && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center document-pop-icon"
        >
          <Logo size={72} />
        </div>
      )}

      <h1 className={`relative ${className}`} aria-label={WORD}>
        {WORD.split('').map((letter, i) => {
          const by = revealedBy[i]
          const color = merged ? 'var(--text)' : by === 'left' ? 'var(--accent)' : by === 'right' ? '#10b981' : 'transparent'

          const flourishClass =
            flourish === 'swap' ? swapClassFor(i) : flourish === 'documentPop' ? 'letter-repop' : ''

          return (
            <span
              key={i}
              aria-hidden
              className={`inline-block ${flourishClass} ${merged && middleIndices.has(i) ? 'wordmark-pulse' : ''}`}
              style={{
                color,
                opacity: by ? 1 : 0,
                transform: by ? 'translateY(0)' : 'translateY(0.3em)',
                transition:
                  'color 250ms ease-out, opacity 300ms ease-out, ' +
                  'transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1)', // slight overshoot - the "jump" in the pop-in
                animationDelay: flourish === 'documentPop' ? `${i * 45}ms` : undefined,
                // The mirror-swap letters travel across their neighbors -
                // without this they'd paint UNDER whichever letters come
                // later in the DOM (plain source-order stacking), so the
                // R/T arcing right would look like it ducks behind the
                // rest of the word instead of sweeping over it.
                position: flourishClass ? 'relative' : undefined,
                zIndex: flourishClass ? 10 : undefined,
              }}
            >
              {letter}
            </span>
          )
        })}
      </h1>
    </div>
  )
}
