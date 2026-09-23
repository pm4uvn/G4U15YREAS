import { useEffect, useRef } from 'react'
import { useTimeline } from '../timeline/useTimeline'

export function Navigation() {
  const { years, activeYearIndex, goToYearIndex, hasEntered } = useTimeline()

  const railRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const rail = railRef.current
    const btn = rail?.querySelector<HTMLElement>('.is-active')
    if (!rail || !btn || rail.scrollWidth <= rail.clientWidth) return
    rail.scrollTo({ left: btn.offsetLeft - rail.clientWidth / 2 + btn.offsetWidth / 2, behavior: 'smooth' })
  }, [activeYearIndex])

  return (
    <nav className={`nav ${hasEntered ? 'is-visible' : ''}`} aria-label="Journey through the years">
      <div className="nav__brand">
        <span className="nav__brand-mark">G4U</span>
        <span className="nav__brand-sub">15 Years</span>
      </div>

      <ol ref={railRef} className="nav__years" data-lenis-prevent>
        {years.map((entry, index) => (
          <li key={entry.year}>
            <button
              type="button"
              className={`nav__year ${index === activeYearIndex ? 'is-active' : ''}`}
              aria-current={index === activeYearIndex ? 'true' : undefined}
              onClick={() => goToYearIndex(index)}
            >
              {entry.year}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
