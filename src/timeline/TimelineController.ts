import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { lenis, bindLenisToTicker } from '../animation/lenis'
import { gsap } from '../animation/gsap'
import { YEAR_COUNT } from './timeline.data'
import { isBrowser, prefersReducedMotion } from '../utils/device'

export interface Pointer {
  x: number
  y: number
}

interface TimelineState {
  /** Raw 0..1 scroll progress reported directly by Lenis this frame. */
  rawProgress: number
  /** Damped/lerped progress — this is what drives the camera and 3D scene. */
  smoothProgress: number
  /** Instantaneous scroll delta this frame, smoothed. Drives "whoosh" energy. */
  velocity: number
  /** Raw pointer position, normalized -1..1. */
  pointer: Pointer
  /** Damped pointer, used for parallax. */
  smoothPointer: Pointer
  /** Index into YEARS for the year currently dominating the view. */
  activeYearIndex: number
  /** True once the user has scrolled past the hero threshold. */
  hasEntered: boolean
}

const REDUCED_MOTION = prefersReducedMotion()
const PROGRESS_DAMPING = REDUCED_MOTION ? 1 : 0.085
const POINTER_DAMPING = REDUCED_MOTION ? 1 : 0.07
const VELOCITY_DECAY = 0.88
// Year N becomes "active" once progress crosses the halfway point to it, i.e.
// at 0.5 / (YEAR_COUNT - 1). The hero must finish fading out comfortably
// before that boundary — otherwise activeYearIndex flips to "2012" while the
// hero title is still ghosting on screen. 0.4x of that boundary leaves a
// clean beat where 2011 is fully revealed, hero-free, before the handoff.
export const HERO_FADE_END = (0.4 * 0.5) / (YEAR_COUNT - 1)

export const timelineStore = createStore<TimelineState>(() => ({
  rawProgress: 0,
  smoothProgress: 0,
  velocity: 0,
  pointer: { x: 0, y: 0 },
  smoothPointer: { x: 0, y: 0 },
  activeYearIndex: 0,
  hasEntered: false,
}))

/** Non-reactive read for use inside R3F useFrame loops — never triggers React renders. */
export const getTimelineState = timelineStore.getState

/** Reactive hook for HTML/UI components — subscribe to the smallest slice you need. */
export function useTimelineStore<T>(selector: (state: TimelineState) => T): T {
  return useStore(timelineStore, selector)
}

let initialized = false
let unbindTicker: (() => void) | void

export function initTimelineController() {
  if (!isBrowser || initialized) return () => {}
  initialized = true

  // The browser restores the previous scroll offset on reload by default,
  // which on a 17-viewport-tall page means "refresh" can silently drop the
  // journey back into the middle of it. The experience always starts at the
  // hero, so scroll position is never something to restore.
  if ('scrollRestoration' in window.history) {
    window.history.scrollRestoration = 'manual'
  }
  window.scrollTo(0, 0)

  unbindTicker = bindLenisToTicker()

  let prevRawProgress = 0

  lenis?.on('scroll', ({ progress }: { progress: number }) => {
    timelineStore.setState({ rawProgress: progress })
  })

  const onPointerMove = (event: PointerEvent) => {
    const x = (event.clientX / window.innerWidth) * 2 - 1
    const y = -(event.clientY / window.innerHeight) * 2 + 1
    timelineStore.setState({ pointer: { x, y } })
  }
  window.addEventListener('pointermove', onPointerMove, { passive: true })

  const tick = () => {
    const state = timelineStore.getState()

    const smoothProgress = gsap.utils.interpolate(
      state.smoothProgress,
      state.rawProgress,
      PROGRESS_DAMPING,
    )
    const rawVelocity = state.rawProgress - prevRawProgress
    prevRawProgress = state.rawProgress
    const velocity = gsap.utils.interpolate(state.velocity, rawVelocity, 1 - VELOCITY_DECAY) * VELOCITY_DECAY

    const smoothPointer = {
      x: gsap.utils.interpolate(state.smoothPointer.x, state.pointer.x, POINTER_DAMPING),
      y: gsap.utils.interpolate(state.smoothPointer.y, state.pointer.y, POINTER_DAMPING),
    }

    const activeYearIndex = Math.min(
      YEAR_COUNT - 1,
      Math.max(0, Math.round(smoothProgress * (YEAR_COUNT - 1))),
    )

    const hasEntered = state.hasEntered || smoothProgress > HERO_FADE_END * 0.5

    const next: Partial<TimelineState> = { smoothProgress, velocity, smoothPointer }
    if (activeYearIndex !== state.activeYearIndex) next.activeYearIndex = activeYearIndex
    if (hasEntered !== state.hasEntered) next.hasEntered = hasEntered

    timelineStore.setState(next)
  }

  gsap.ticker.add(tick)

  return () => {
    window.removeEventListener('pointermove', onPointerMove)
    gsap.ticker.remove(tick)
    unbindTicker?.()
    initialized = false
  }
}

/** Scroll (via Lenis) to a given year's position on the timeline. */
export function scrollToYearIndex(index: number) {
  if (!lenis || !isBrowser) return
  const target = (index / (YEAR_COUNT - 1)) * lenis.limit
  lenis.scrollTo(target, { duration: 1.6, easing: (t: number) => 1 - Math.pow(1 - t, 4) })
}
