import { useEffect, useRef, useState, type ReactNode } from 'react'

// A small, dependency-free stand-in for the kind of scroll-triggered
// fade/slide-in Apple's site is full of. IntersectionObserver + a single
// CSS transition does the whole job - no scroll-linked animation library
// needed for something this simple. Fires once (unobserves itself after
// the first reveal) rather than re-animating every time an element
// scrolls in and out of view, which reads as "considered" instead of
// distracting on a second scroll-past.
export default function Reveal({
  children,
  className = '',
  from = 'up',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  from?: 'up' | 'left' | 'right' | 'none'
  delay?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Respect prefers-reduced-motion by skipping straight to visible - the
    // whole point of that setting is "don't animate things at me".
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const hiddenTransform =
    from === 'left' ? '-translate-x-8' : from === 'right' ? 'translate-x-8' : from === 'up' ? 'translate-y-8' : ''

  return (
    <div
      ref={ref}
      style={{ transitionDelay: visible ? `${delay}ms` : '0ms' }}
      className={`ease-smooth transition-all duration-700 ${
        visible ? 'translate-x-0 translate-y-0 opacity-100' : `opacity-0 ${hiddenTransform}`
      } ${className}`}
    >
      {children}
    </div>
  )
}
