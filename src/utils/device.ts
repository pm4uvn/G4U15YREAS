export const isBrowser = typeof window !== 'undefined'

export function prefersReducedMotion(): boolean {
  if (!isBrowser) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Portrait-phone layout: memories hang on one side and the other carries the message ticker. */
export function isPhoneLayout(): boolean {
  if (!isBrowser) return false
  return window.innerWidth <= 720
}

export function isMobileViewport(): boolean {
  if (!isBrowser) return false
  return window.innerWidth < 820
}

export function isCoarsePointer(): boolean {
  if (!isBrowser) return false
  return window.matchMedia('(pointer: coarse)').matches
}

export function checkWebglSupport(): boolean {
  if (!isBrowser) return false
  try {
    const canvas = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    )
  } catch {
    return false
  }
}

export function getAdaptiveDpr(): [number, number] {
  const max = isMobileViewport() ? 1.5 : 2
  return [1, Math.min(max, isBrowser ? window.devicePixelRatio : 1)]
}
