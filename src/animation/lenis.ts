import Lenis from 'lenis'
import { gsap } from './gsap'
import { isBrowser, prefersReducedMotion } from '../utils/device'

/**
 * Lenis is the single source of truth for scroll. It is driven by gsap.ticker
 * (rather than its own requestAnimationFrame) so Lenis, GSAP tweens and the
 * R3F render loop all advance on the exact same frame — this is what keeps
 * camera motion, node transitions and UI text in lockstep with zero drift.
 */
export const lenis: Lenis | null = isBrowser
  ? new Lenis({
      duration: prefersReducedMotion() ? 0.1 : 1.15,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
      smoothWheel: !prefersReducedMotion(),
      wheelMultiplier: 1,
      touchMultiplier: 1.3,
      syncTouch: true,
    })
  : null

let bound = false

export function bindLenisToTicker() {
  if (!lenis || bound) return
  bound = true

  const onTick = (time: number) => {
    lenis.raf(time * 1000)
  }

  gsap.ticker.add(onTick)

  return () => {
    gsap.ticker.remove(onTick)
    bound = false
  }
}
