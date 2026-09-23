import { useEffect, type RefObject } from 'react'
import { lenis } from '../animation/lenis'

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])'

/** ESC to close, Tab focus trap, focus restore, and pauses Lenis scrolling while open. */
export function useDialog(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const previous = document.activeElement as HTMLElement | null
    lenis?.stop()

    const focusables = () => Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
    ;(focusables()[0] ?? root).focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const list = focusables()
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      lenis?.start()
      previous?.focus?.()
    }
    // onClose intentionally excluded: re-running would reset focus on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref])
}
