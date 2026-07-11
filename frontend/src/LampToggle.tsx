import { useState } from 'react'
import { useTheme } from './theme'

// A playful stand-in for the plain Sun/Moon icon button: a little ceiling
// lamp you toggle by "pulling" its cord. All CSS transitions, no animation
// library - easy to swap for something spring-physics-based later.
export default function LampToggle() {
  const { theme, toggleTheme } = useTheme()
  const [pulling, setPulling] = useState(false)
  const isLight = theme === 'light'

  function handlePull() {
    toggleTheme()
    setPulling(true)
    // Tug the cord down, then let the transition ease it back up - roughly
    // mimics a real pull-cord's "yank, then swing back" motion without
    // needing a physics/spring library.
    window.setTimeout(() => setPulling(false), 180)
  }

  return (
    <button
      onClick={handlePull}
      aria-label="Toggle dark mode"
      title="Pull the cord to toggle light/dark mode"
      className="group flex select-none flex-col items-center self-start bg-transparent"
    >
      {/* ceiling cap the cord/shade appears to hang from */}
      <span className="h-1 w-4 rounded-b bg-[var(--text-muted)] opacity-70" />

      {/* shade + bulb - one small svg so the glow can bleed outside its box */}
      <svg width="26" height="22" viewBox="0 0 26 22" className="-mt-px overflow-visible">
        <path d="M5 0 L21 0 L26 11 L0 11 Z" className="fill-[var(--text-muted)]" opacity={0.75} />
        <circle
          cx="13"
          cy="16"
          r="4.5"
          style={{
            // Hardcoded hex rather than var(--surface-2) - deliberately, so
            // there's no dependency on how reliably a CSS custom property
            // resolves inside an SVG presentation attribute across
            // browsers. Lit (glowing) in DARK mode - that's when you'd
            // actually switch a lamp on - and dim/unlit in light mode.
            fill: !isLight ? '#ffd166' : '#33363f',
            filter: !isLight
              ? 'drop-shadow(0 0 5px #ffd166) drop-shadow(0 0 14px rgba(255,209,102,0.55))'
              : 'none',
            transition: 'fill 300ms ease-out, filter 300ms ease-out',
          }}
        />
      </svg>

      {/* cord + pull knob - the whole group shifts down on click (via
          margin-top) then eases back up once `pulling` resets, which is
          what actually creates the "pull" motion. */}
      <span
        className={`ease-smooth flex flex-col items-center transition-[margin-top] duration-300 ${
          pulling ? 'mt-3.5' : 'mt-0'
        }`}
      >
        <span className="h-4 w-px bg-[var(--text-muted)] opacity-70" />
        <span className="ease-smooth h-2 w-2 rounded-full bg-[var(--text-muted)] opacity-70 transition-transform duration-150 group-hover:scale-125" />
      </span>
    </button>
  )
}
