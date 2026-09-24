import { useEffect, useState } from 'react'
import { useTimeline } from '../timeline/useTimeline'
import { useMemoriesByYear } from '../memories/hooks/useMemoriesByYear'
import './ticker.css'

/** Phones only: the right half of the screen carries the year's words, drifting slowly upward. */
export function MessageTicker() {
  const { activeYear, hasEntered } = useTimeline()
  const [year, setYear] = useState(activeYear.year)
  useEffect(() => {
    const t = window.setTimeout(() => setYear(activeYear.year), 250)
    return () => window.clearTimeout(t)
  }, [activeYear.year])

  const { items } = useMemoriesByYear(year)
  const entry = activeYear.year === year ? activeYear : null
  if (!entry) return null

  const lines = [
    { key: 'title', className: 'ticker__title', text: entry.title },
    { key: 'sub', className: 'ticker__sub', text: entry.subtitle },
    { key: 'quote', className: 'ticker__quote', text: `“${entry.quote}”` },
    ...items
      .map((m) => (m.content ?? m.title ?? '').trim())
      .filter(Boolean)
      .map((text, i) => ({ key: `m${i}`, className: 'ticker__memory', text })),
  ]
  // Longer copy scrolls for longer, at a steady reading pace.
  const seconds = Math.max(28, lines.reduce((n, l) => n + l.text.length, 0) * 0.32)

  return (
    <aside className={`ticker ${hasEntered ? 'is-visible' : ''}`} aria-hidden key={year}>
      <div className="ticker__track" style={{ animationDuration: `${seconds}s` }}>
        {[0, 1].map((copy) => (
          <div className="ticker__copy" key={copy}>
            <p className="ticker__year">{year}</p>
            {lines.map((l) => (
              <p key={l.key} className={l.className}>
                {l.text}
              </p>
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
}
