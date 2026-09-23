import { useEffect, useRef } from 'react'
import { timelineStore, HERO_FADE_END, scrollToYearIndex } from '../timeline/TimelineController'

export function Intro() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsubscribe = timelineStore.subscribe((state) => {
      const el = rootRef.current
      if (!el) return
      const t = Math.min(1, state.smoothProgress / HERO_FADE_END)
      const opacity = 1 - t
      el.style.opacity = String(opacity)
      el.style.transform = `translateY(${t * -36}px) scale(${1 - t * 0.06})`
      el.style.pointerEvents = opacity < 0.08 ? 'none' : 'auto'
    })
    return unsubscribe
  }, [])

  return (
    <div ref={rootRef} className="intro" aria-hidden={false}>
      <p className="intro__kicker">G4U · Guitar For You</p>
      <h1 className="intro__title">
        G4U
        <span className="intro__title-sub">15 YEARS</span>
      </h1>
      <p className="intro__range">2011 — 2026</p>
      <p className="intro__tagline">Every year has a song. Every memory has a story.</p>
      <button
        type="button"
        className="intro__cta"
        onClick={() => scrollToYearIndex(1)}
      >
        Enter the Journey
      </button>
    </div>
  )
}
