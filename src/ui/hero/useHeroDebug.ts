import { useCallback, useMemo, useState } from 'react'

/** ?heroDebug=1 turns the alignment tools on. The DEV check lets production builds drop them entirely. */
export function useHeroDebug() {
  const enabled = useMemo(
    () => import.meta.env.DEV && new URLSearchParams(window.location.search).get('heroDebug') === '1',
    [],
  )
  const [hidden, setHidden] = useState<string[]>([])
  const toggle = useCallback(
    (key: string) => setHidden((h) => (h.includes(key) ? h.filter((k) => k !== key) : [...h, key])),
    [],
  )
  return { enabled, hidden, toggle, className: hidden.map((k) => `hide-${k}`).join(' ') }
}
