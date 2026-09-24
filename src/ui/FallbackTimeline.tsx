import { YEARS } from '../timeline/timeline.data'

/** Lightweight, dependency-free timeline shown when WebGL is unavailable. */
export function FallbackTimeline() {
  return (
    <main className="fallback">
      <header className="fallback__hero">
        <p className="fallback__kicker">G4U · Guitar For You</p>
        <h1>G4U — 15 Years</h1>
        <p className="fallback__range">2011 — 2026</p>
        <p className="fallback__tagline">Nếu cuộc đời này không rực rỡ thì sao? Miễn là những năm tháng ấy, chúng ta đã từng có nhau.</p>
      </header>

      <ol className="fallback__list">
        {YEARS.map((entry) => (
          <li key={entry.year} className="fallback__item">
            <span className="fallback__year">{entry.year}</span>
            <div>
              <h2>{entry.title}</h2>
              <p>{entry.subtitle}</p>
            </div>
          </li>
        ))}
      </ol>
    </main>
  )
}
