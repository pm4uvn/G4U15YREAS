import { useTimeline } from '../timeline/useTimeline'

export function Navigation() {
  const { years, activeYearIndex, goToYearIndex, hasEntered } = useTimeline()

  return (
    <nav className={`nav ${hasEntered ? 'is-visible' : ''}`} aria-label="Journey through the years">
      <div className="nav__brand">
        <span className="nav__brand-mark">G4U</span>
        <span className="nav__brand-sub">15 Years</span>
      </div>

      <ol className="nav__years">
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
