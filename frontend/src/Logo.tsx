// A little icon that's half ancient scroll, half modern text editor:
// rolled parchment ends (the "scroll" part) around a flat panel of clean
// horizontal text lines with a blinking cursor at the end of the last one
// (the "editor" part) - a document that's old in form but current in
// function, which is roughly the whole pitch of the app.
export default function Logo({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden className={className}>
      {/* rolled ends */}
      <rect x="3" y="9" width="7" height="30" rx="3.5" fill="var(--text-muted)" opacity="0.5" />
      <rect x="38" y="9" width="7" height="30" rx="3.5" fill="var(--text-muted)" opacity="0.5" />

      {/* parchment / editor panel */}
      <rect x="8" y="6" width="32" height="36" rx="2.5" fill="var(--surface)" stroke="var(--border)" strokeWidth="1.5" />

      {/* text lines - last one deliberately short, like the end of a paragraph */}
      <line x1="14" y1="16" x2="32" y2="16" stroke="var(--text-muted)" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="14" y1="23" x2="32" y2="23" stroke="var(--text-muted)" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="14" y1="30" x2="24" y2="30" stroke="var(--text-muted)" strokeWidth="2.2" strokeLinecap="round" />

      {/* blinking cursor right after the short line - the "modern editor" tell */}
      <line
        x1="27"
        y1="27"
        x2="27"
        y2="33"
        stroke="var(--accent)"
        strokeWidth="2.4"
        strokeLinecap="round"
        className="logo-cursor-blink"
      />
    </svg>
  )
}
