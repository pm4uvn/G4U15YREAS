import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { HERO_CANVAS } from './heroAssets'
import { HERO_DEBUG_LAYERS } from './heroDebugLayers'

/** Development-only alignment helpers (?heroDebug=1). Loaded via a DEV-gated dynamic import. */

/** Frame, thirds, centre cross and a 5% safe frame, drawn on the canvas so it moves with the layers. */
export function HeroDebugGrid() {
  return (
    <div className="hero-debug-grid" aria-hidden="true">
      <span className="hero-debug-grid__label">
        {HERO_CANVAS.width}×{HERO_CANVAS.height} · 16:9
      </span>
      <span className="hero-debug-grid__safe" />
    </div>
  )
}

/** "file" when the real artwork is showing, "fallback" when the built-in stand-in is. */
function sourceOf(selector: string): 'file' | 'fallback' | '' {
  const layer = document.querySelector(selector)
  if (!layer) return ''
  return layer.querySelector('img.hero-art, img.hero-logo') ? 'file' : 'fallback'
}

export function HeroDebugPanel({ hidden, toggle }: { hidden: string[]; toggle: (key: string) => void }) {
  const [sources, setSources] = useState<Record<string, string>>({})

  useEffect(() => {
    const read = () => setSources(Object.fromEntries(HERO_DEBUG_LAYERS.map((l) => [l.key, sourceOf(l.selector)])))
    read()
    const id = window.setInterval(read, 1000)
    return () => window.clearInterval(id)
  }, [])

  return createPortal(
    <aside className="hero-debug-panel" aria-label="Hero debug">
      <strong>heroDebug</strong>
      {HERO_DEBUG_LAYERS.map((l) => (
        <label key={l.key}>
          <input type="checkbox" checked={!hidden.includes(l.key)} onChange={() => toggle(l.key)} />
          <span>{l.label}</span>
          <em>{sources[l.key]}</em>
        </label>
      ))}
    </aside>,
    document.body,
  )
}
