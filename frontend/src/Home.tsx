import type { ComponentType } from 'react'
import { Users, Shield, History, PenLine, Command, Sparkles, ChevronDown } from 'lucide-react'
import Reveal from './Reveal'
import TypedWordmark from './TypedWordmark'
import Logo from './Logo'
import RealtimeMockup from './RealtimeMockup'
import VersionHistoryMockup from './VersionHistoryMockup'
import CommandPaletteMockup from './CommandPaletteMockup'

// The pre-login landing page. Distinct from Login.tsx on purpose: Login is
// a small, focused form; this is meant to answer "what is this thing and
// why would I sign in" before someone commits to that form - the two jobs
// don't belong in the same component.
//
// Styled after Apple's product pages: huge wordmark hero with a soft glow,
// one big statement, a handful of full-width alternating feature
// "spotlights" instead of a flat grid, everything fading/sliding in as you
// scroll past it (see Reveal.tsx) rather than appearing all at once.

const spotlightFeatures: {
  icon: typeof Sparkles
  eyebrow: string
  title: string
  body: string
  // A small looping recreation of the feature's real UI - not a live
  // screen capture (that would need two real browser sessions and
  // screen-recording tooling), just enough of the actual component's look
  // to sell the idea in a few seconds. See {Realtime,VersionHistory,
  // CommandPalette}Mockup.tsx.
  Mockup: ComponentType
}[] = [
  {
    icon: Sparkles,
    eyebrow: 'The part every other editor fakes',
    title: 'Two people.\nOne sentence.\nZero collisions.',
    body:
      "Most \"real-time\" editors solve conflicts by quietly picking a winner and throwing away the " +
      "loser's work - refresh at the wrong moment and watch a paragraph vanish. RTEDTR doesn't gamble " +
      'with your writing. It runs on Yjs, a CRDT that mathematically guarantees every edit merges - ' +
      "no locking the file, no \"last save wins,\" no sentence that just disappears.",
    Mockup: RealtimeMockup,
  },
  {
    icon: History,
    eyebrow: 'Undo, but for the whole document',
    title: 'Rewind the page.\nNot the collaboration.',
    body:
      "Snapshot a version whenever you want, and step back to it the moment you need to. Because history " +
      "in a CRDT only ever grows, restoring an old version never erases what someone else wrote in the " +
      "meantime - it just adds your rollback as the next honest edit, not a forced overwrite.",
    Mockup: VersionHistoryMockup,
  },
  {
    icon: Command,
    eyebrow: 'Fast enough to disappear',
    title: 'Press ⌘K.\nStop hunting for buttons.',
    body:
      'A command palette that jumps you anywhere in one keystroke, a dark mode you switch by pulling an ' +
      "actual little cord, and transitions tuned until it stopped feeling like a browser tab and started " +
      'feeling like an app you actually want to open.',
    Mockup: CommandPaletteMockup,
  },
]

const gridFeatures: { icon: typeof Users; title: string; body: string }[] = [
  {
    icon: Users,
    title: 'Know who\'s in the room',
    body: 'Colored cursors and live names as people type - no more guessing who wrote what while you were away.',
  },
  {
    icon: Shield,
    title: 'Share it your way',
    body: 'Owner, editor, or view-only - set per person, and enforced in the editor itself, not just a polite suggestion.',
  },
  {
    icon: PenLine,
    title: 'More than just words',
    body: 'Drop in a photo or sketch something on the spot. It syncs exactly like everything else - instantly.',
  },
]

export default function Home({
  onSignIn,
  onSignUp,
}: {
  onSignIn: () => void
  onSignUp: () => void
}) {
  return (
    <div>
      {/* HERO - full-bleed, generous vertical space, a soft radial glow
          behind the wordmark rather than a flat background. min-h uses
          dvh (not vh) so mobile browser chrome doesn't clip the CTAs. */}
      <section className="relative flex min-h-[88dvh] flex-col items-center justify-center overflow-hidden px-6 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2
            -translate-y-1/2 rounded-full opacity-[0.16] blur-[110px]"
          style={{ background: 'var(--accent)' }}
        />

        <Reveal>
          <Logo size={40} className="mb-5" />
        </Reveal>

        <Reveal delay={60}>
          <span className="mb-5 inline-block rounded-full bg-[var(--accent-soft)] px-3.5 py-1.5 text-xs font-medium text-[var(--accent)]">
            Built different. Built to actually hold up.
          </span>
        </Reveal>

        {/* Types itself in from both ends rather than a plain fade - see
            TypedWordmark.tsx for why (it's the product's own pitch, acted
            out in the logo). No Reveal wrapper needed here; the typing
            animation IS the reveal. */}
        <TypedWordmark className="text-[15vw] font-semibold leading-none tracking-tighter sm:text-8xl md:text-9xl" />

        <Reveal delay={520}>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-[var(--text-muted)] sm:text-xl">
            Write in the same sentence, at the same second, and never lose a word to someone else's
            cursor. No spinners, no lockouts, no crossed fingers - just editing that works the way
            it always should have.
          </p>
        </Reveal>

        <Reveal delay={640}>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={onSignUp}
              className="ease-smooth rounded-full bg-[var(--accent)] px-7 py-3 text-[15px] font-medium
                text-[var(--accent-contrast)] shadow-lg transition-all duration-300
                hover:scale-[1.03] hover:opacity-95 active:scale-[0.98]"
            >
              Create an account
            </button>
            <button
              onClick={onSignIn}
              className="ease-smooth rounded-full border border-[var(--border)] bg-[var(--surface)] px-7 py-3
                text-[15px] font-medium text-[var(--text)] transition-all duration-300 hover:scale-[1.03]
                hover:bg-[var(--bg)] active:scale-[0.98]"
            >
              Sign in
            </button>
          </div>
        </Reveal>

        <a
          href="#features"
          aria-label="Scroll to features"
          className="ease-smooth absolute bottom-8 flex flex-col items-center gap-1 text-[var(--text-muted)]
            opacity-60 transition-opacity duration-300 hover:opacity-100"
        >
          <ChevronDown size={20} className="animate-bounce" />
        </a>
      </section>

      {/* BIG STATEMENT - the kind of oversized centered one-liner Apple
          uses to transition from hero into substance. */}
      <section className="border-t border-[var(--border)] bg-[var(--surface)] px-6 py-24 sm:py-32">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="text-3xl font-semibold leading-snug tracking-tight text-[var(--text)] sm:text-5xl">
            Most "collaborative" editors are just autosave wearing a nicer outfit.
            <br />
            <span className="text-[var(--text-muted)]">
              RTEDTR merges every keystroke mathematically - so the document you see is always the one everyone agrees on.
            </span>
          </p>
        </Reveal>
      </section>

      {/* SPOTLIGHT FEATURES - full-width alternating rows, each one
          revealing from the side it's laid out on. */}
      <section id="features" className="px-6 py-24 sm:py-32">
        <div className="mx-auto flex max-w-5xl flex-col gap-24 sm:gap-32">
          {spotlightFeatures.map((f, i) => {
            const fromSide = i % 2 === 0 ? 'left' : 'right'
            return (
              <div
                key={f.title}
                className={`flex flex-col items-center gap-10 sm:gap-16 ${
                  i % 2 === 0 ? 'sm:flex-row' : 'sm:flex-row-reverse'
                }`}
              >
                <Reveal from={fromSide} className="flex-1">
                  <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-soft)]">
                    <f.icon size={26} className="text-[var(--accent)]" />
                  </div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                    {f.eyebrow}
                  </p>
                  <h3 className="mb-4 whitespace-pre-line text-2xl font-semibold leading-tight tracking-tight text-[var(--text)] sm:text-3xl">
                    {f.title}
                  </h3>
                  <p className="max-w-md text-[15px] leading-relaxed text-[var(--text-muted)]">{f.body}</p>
                </Reveal>

                {/* A small looping recreation of the real UI (see
                    f.Mockup / *Mockup.tsx) rather than a real screen
                    capture - keeps the alternating-row rhythm without
                    needing live screen-recording tooling. */}
                <Reveal from={fromSide === 'left' ? 'right' : 'left'} delay={120} className="flex-1">
                  <div
                    className="aspect-[4/3] w-full overflow-hidden rounded-3xl border border-[var(--border)]"
                    style={{ background: 'var(--surface-2)' }}
                  >
                    <f.Mockup />
                  </div>
                </Reveal>
              </div>
            )
          })}
        </div>
      </section>

      {/* SECONDARY FEATURES - compact grid finale, smaller treatment for
          the rest of what it does. */}
      <section className="border-t border-[var(--border)] bg-[var(--surface)] px-6 py-20">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3">
          {gridFeatures.map((f, i) => (
            <Reveal key={f.title} delay={i * 100}>
              <div className="h-full rounded-2xl border border-[var(--border)] bg-[var(--bg)] p-6 text-left">
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-soft)]">
                  <f.icon size={17} className="text-[var(--accent)]" />
                </div>
                <h4 className="mb-1.5 text-[15px] font-semibold text-[var(--text)]">{f.title}</h4>
                <p className="text-sm leading-relaxed text-[var(--text-muted)]">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="border-t border-[var(--border)] px-6 py-24 text-center sm:py-28">
        <Reveal>
          <h2 className="mb-3 text-3xl font-semibold tracking-tight text-[var(--text)] sm:text-4xl">
            Stop merging by hand.
          </h2>
          <p className="mb-6 text-lg text-[var(--text-muted)]">Open a document and watch it happen in real time.</p>
          <button
            onClick={onSignUp}
            className="ease-smooth rounded-full bg-[var(--accent)] px-8 py-3.5 text-[15px] font-medium
              text-[var(--accent-contrast)] shadow-lg transition-all duration-300
              hover:scale-[1.03] hover:opacity-95 active:scale-[0.98]"
          >
            Create an account
          </button>
        </Reveal>
      </section>
    </div>
  )
}
