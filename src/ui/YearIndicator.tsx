import { useEffect, useRef } from 'react'
import { useTimeline } from '../timeline/useTimeline'
import { gsap } from '../animation/gsap'
import { FIRST_YEAR, LAST_YEAR } from '../timeline/timeline.data'

export function YearIndicator() {
  const { activeYear, hasEntered } = useTimeline()
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!textRef.current) return
    gsap.fromTo(
      textRef.current,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' },
    )
  }, [activeYear.year])

  return (
    <div className={`year-indicator ${hasEntered ? 'is-visible' : ''}`} aria-live="polite">
      <div ref={textRef} className="year-indicator__content">
        <span className="year-indicator__count">
          {activeYear.year} <span className="year-indicator__count-total">/ {LAST_YEAR}</span>
        </span>
        <span className="year-indicator__title">{activeYear.title}</span>
      </div>
      <div className="year-indicator__rail">
        <div
          className="year-indicator__rail-fill"
          style={{
            width: `${((activeYear.year - FIRST_YEAR) / (LAST_YEAR - FIRST_YEAR)) * 100}%`,
          }}
        />
      </div>
    </div>
  )
}
