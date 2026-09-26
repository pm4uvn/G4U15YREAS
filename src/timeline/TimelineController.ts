import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { lenis, bindLenisToTicker } from '../animation/lenis'
import { gsap } from '../animation/gsap'
import { YEARS } from './timeline.data'
import { activeYearAtSlot, getHeroFadeEnd, getLayout, journeyStore, tToSlot, yearIndexToT } from './journey'
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
  /**
   * How far the camera's head is turned, -1..1 per axis. Unlike `pointer` above (the mouse's
   * current position, for the hero's subtle parallax), this only moves while a mouse drag is in
   * progress and otherwise holds still — see TimelineController's drag handling for why.
   */
  lookOffset: Pointer
  /** Damped lookOffset, used by CameraRig for the actual look-around rotation. */
  smoothLookOffset: Pointer
  /** Index into YEARS for the year currently dominating the view. */
  activeYearIndex: number
  /** True once the user has scrolled past the hero threshold. */
  hasEntered: boolean
}

const REDUCED_MOTION = prefersReducedMotion()
const PROGRESS_DAMPING = REDUCED_MOTION ? 1 : 0.085
const POINTER_DAMPING = REDUCED_MOTION ? 1 : 0.07
const LOOK_DAMPING = REDUCED_MOTION ? 1 : 0.14
const VELOCITY_DECAY = 0.88
// The hero fades out over the first fifth of a slot (see getHeroFadeEnd) — comfortably before
// the first year becomes active, so the hero never ghosts while a year is already shown.

export const timelineStore = createStore<TimelineState>(() => ({
  rawProgress: 0,
  smoothProgress: 0,
  velocity: 0,
  pointer: { x: 0, y: 0 },
  smoothPointer: { x: 0, y: 0 },
  lookOffset: { x: 0, y: 0 },
  smoothLookOffset: { x: 0, y: 0 },
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

  /**
   * Press-and-drag with the mouse turns the camera's head (CameraRig reads `lookOffset`). This is
   * a persistent offset built from drag *distance*, not the mouse's raw position like `pointer`
   * above — an absolute-position mapping meant every stray mouse movement anywhere on the page
   * (after clicking a button, reading the ticker, anything) snapped the look angle to wherever the
   * cursor happened to land, which read as jittery. A drag has no such jump, and holds still after
   * release rather than sliding back, like turning to look at something and leaving your head there.
   * Touch is left out: a touch-drag is already how the page is scrolled, and the two would fight.
   */
  let dragPointerId: number | null = null
  let lastDragX = 0
  let lastDragY = 0
  const DRAG_YAW_PER_PX = 1 / (window.innerWidth * 0.9)
  const DRAG_PITCH_PER_PX = 1 / (window.innerHeight * 0.7)

  const onDragStart = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    dragPointerId = event.pointerId
    lastDragX = event.clientX
    lastDragY = event.clientY
  }
  const onDragMove = (event: PointerEvent) => {
    if (dragPointerId === null || event.pointerId !== dragPointerId) return
    const dx = event.clientX - lastDragX
    const dy = event.clientY - lastDragY
    lastDragX = event.clientX
    lastDragY = event.clientY
    const { lookOffset } = timelineStore.getState()
    timelineStore.setState({
      lookOffset: {
        x: Math.min(1, Math.max(-1, lookOffset.x + dx * DRAG_YAW_PER_PX)),
        y: Math.min(1, Math.max(-1, lookOffset.y - dy * DRAG_PITCH_PER_PX)),
      },
    })
  }
  const onDragEnd = (event: PointerEvent) => {
    if (event.pointerId === dragPointerId) dragPointerId = null
  }
  window.addEventListener('pointerdown', onDragStart, { passive: true })
  window.addEventListener('pointermove', onDragMove, { passive: true })
  window.addEventListener('pointerup', onDragEnd, { passive: true })
  window.addEventListener('pointercancel', onDragEnd, { passive: true })

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
    const smoothLookOffset = {
      x: gsap.utils.interpolate(state.smoothLookOffset.x, state.lookOffset.x, LOOK_DAMPING),
      y: gsap.utils.interpolate(state.smoothLookOffset.y, state.lookOffset.y, LOOK_DAMPING),
    }

    const activeYearIndex = activeYearAtSlot(getLayout(), tToSlot(smoothProgress))

    const hasEntered = state.hasEntered || smoothProgress > getHeroFadeEnd() * 0.5

    const next: Partial<TimelineState> = { smoothProgress, velocity, smoothPointer, smoothLookOffset }
    if (activeYearIndex !== state.activeYearIndex) next.activeYearIndex = activeYearIndex
    if (hasEntered !== state.hasEntered) next.hasEntered = hasEntered

    timelineStore.setState(next)
  }

  gsap.ticker.add(tick)

  // When the journey re-measures itself (a year gained memories and the strings grew),
  // keep the camera on the same spot of the neck rather than the same fraction of the scroll.
  const unsubscribeJourney = journeyStore.subscribe((state, prev) => {
    if (state.layout.slotsLength === prev.layout.slotsLength) return
    const slot = timelineStore.getState().smoothProgress * prev.layout.slotsLength
    const t = Math.min(1, slot / state.layout.slotsLength)
    // Only the target (rawProgress) moves here — smoothProgress is left for the normal per-frame
    // damping in tick() to ease toward it, same as any other scroll. Forcing it to `t` outright,
    // and force-snapping Lenis's own scroll position in the same instant, used to fight whatever
    // eased scrollTo was already mid-flight (e.g. the "Enter the Journey" hand-off) and abort it
    // with a visible pop the moment memory counts finished loading in behind it.
    timelineStore.setState({ rawProgress: t })
    // The scroll spacer resizes on the next render; wait for it before repositioning Lenis.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        lenis?.resize()
        lenis?.scrollTo(t * (lenis?.limit ?? 0), { duration: 0.8, easing: (x: number) => 1 - Math.pow(1 - x, 3) })
      }),
    )
  })

  // Deep link: ?year=2018 opens the journey at that year.
  const requested = Number(new URLSearchParams(window.location.search).get('year'))
  const requestedIndex = YEARS.findIndex((y) => y.year === requested)
  if (requestedIndex >= 0) {
    requestAnimationFrame(() => {
      lenis?.resize()
      lenis?.scrollTo(yearIndexToT(requestedIndex) * (lenis?.limit ?? 0), { immediate: true, force: true })
    })
  }

  // Keep the URL shareable as the active year changes. replaceState (not
  // pushState) so scrolling never fills the Back button with every year passed.
  const unsubscribeUrl = timelineStore.subscribe((state, prev) => {
    if (state.activeYearIndex === prev.activeYearIndex || !state.hasEntered) return
    const url = new URL(window.location.href)
    url.searchParams.set('year', String(YEARS[state.activeYearIndex].year))
    window.history.replaceState(window.history.state, '', url)
  })

  return () => {
    unsubscribeUrl()
    unsubscribeJourney()
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerdown', onDragStart)
    window.removeEventListener('pointermove', onDragMove)
    window.removeEventListener('pointerup', onDragEnd)
    window.removeEventListener('pointercancel', onDragEnd)
    gsap.ticker.remove(tick)
    unbindTicker?.()
    initialized = false
  }
}

/** Scroll (via Lenis) to a given year's position on the timeline. */
export function scrollToYearIndex(index: number) {
  if (!lenis || !isBrowser) return
  const target = yearIndexToT(index) * lenis.limit
  lenis.scrollTo(target, { duration: 1.6, easing: (t: number) => 1 - Math.pow(1 - t, 4) })
}

/**
 * Scrolls to the very start of the journey proper — just past the hero fade, where the "WELCOME
 * TO THE G4U JOURNEY" lettering begins — rather than year 2011's own fret (scrollToYearIndex(0)),
 * which skips over that lead-in stretch of open neck entirely.
 */
export function scrollToStart() {
  if (!lenis || !isBrowser) return
  const target = getHeroFadeEnd() * lenis.limit
  lenis.scrollTo(target, { duration: 1.6, easing: (t: number) => 1 - Math.pow(1 - t, 4) })
}
