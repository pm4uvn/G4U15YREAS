import { useEffect, useMemo, useRef, useState } from 'react'
import { useTimeline } from '../timeline/useTimeline'
import { timelineStore } from '../timeline/TimelineController'
import { tToSlot, useJourneyLayout } from '../timeline/journey'
import { YEARS, YEAR_COUNT } from '../timeline/timeline.data'
import { useMemoriesByYear } from '../memories/hooks/useMemoriesByYear'
import { memoryDateLabel } from '../memories/memoryFormat'
import type { G4UMemory } from '../types/g4u-memory'
import './ticker.css'

/** Must match MemoryField: memories begin this far into their year's stretch of neck. */
const LEAD = 0.35
/** The memory being passed is the one nearest a little ahead of the camera, where its card is in view. */
const LOOK_AHEAD_SLOTS = 0.7
/** The words cross the strip while the camera travels this many slots past the memory. */
const PASS_SLOTS = 3

interface Placed {
  memory: G4UMemory
  slot: number
}

/** The right side of the screen: the words of whichever memory the camera is passing, drifting upward. */
export function MessageTicker() {
  const { activeYearIndex, hasEntered } = useTimeline()
  const layout = useJourneyLayout()

  // Debounced, like the other year-driven layers, so scrolling across many years does not fetch each one.
  const [center, setCenter] = useState(activeYearIndex)
  useEffect(() => {
    const t = window.setTimeout(() => setCenter(activeYearIndex), 250)
    return () => window.clearTimeout(t)
  }, [activeYearIndex])

  const prev = YEARS[Math.max(0, center - 1)].year
  const here = YEARS[center].year
  const next = YEARS[Math.min(YEAR_COUNT - 1, center + 1)].year
  const a = useMemoriesByYear(prev).items
  const b = useMemoriesByYear(here).items
  const c = useMemoriesByYear(next).items

  const placed = useMemo(() => {
    const seen = new Set<string>()
    const out: Placed[] = []
    for (const items of [a, b, c]) {
      for (const [k, memory] of items.entries()) {
        if (seen.has(memory.id)) continue
        seen.add(memory.id)
        const i = YEARS.findIndex((y) => y.year === memory.year)
        if (i < 0) continue
        const n = Math.max(layout.counts[memory.year] ?? 0, items.length)
        const slot = layout.starts[i] + (LEAD + (1 - LEAD) * ((k + 1) / (n + 1))) * layout.spans[i]
        out.push({ memory, slot })
      }
    }
    return out
  }, [a, b, c, layout])

  const [focusId, setFocusId] = useState<string | null>(null)
  useEffect(() => {
    if (placed.length === 0) return
    const pick = () => {
      const slot = tToSlot(timelineStore.getState().smoothProgress) + LOOK_AHEAD_SLOTS
      let best = placed[0]
      for (const p of placed) if (Math.abs(p.slot - slot) < Math.abs(best.slot - slot)) best = p
      setFocusId(best.memory.id)
    }
    pick()
    return timelineStore.subscribe(pick)
  }, [placed])

  const focusPlaced = placed.find((p) => p.memory.id === focusId) ?? null
  const focus = focusPlaced?.memory ?? null
  const focusSlot = focusPlaced?.slot ?? null

  // The words are tied to the scroll, not a timer: they rise as the camera passes the memory and
  // replay on every pass, forwards or backwards.
  const track = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = track.current
    if (!el || focusSlot === null) return
    const move = () => {
      const slot = tToSlot(timelineStore.getState().smoothProgress)
      const p = Math.min(1, Math.max(0, (slot - (focusSlot - LOOK_AHEAD_SLOTS) + PASS_SLOTS / 2) / PASS_SLOTS))
      el.style.transform = `translateY(${-p * 100}%)`
      el.style.opacity = String(Math.min(1, p * 6, (1 - p) * 6))
    }
    move()
    return timelineStore.subscribe(move)
  }, [focusSlot])
  const year = YEARS[activeYearIndex]

  const lines = focus
    ? [
        { key: 'year', className: 'ticker__year', text: String(focus.year) },
        focus.title ? { key: 'title', className: 'ticker__title', text: focus.title } : null,
        {
          key: 'meta',
          className: 'ticker__sub',
          text: [focus.author?.displayName, memoryDateLabel(focus), focus.location].filter(Boolean).join(' · '),
        },
        focus.content ? { key: 'content', className: 'ticker__memory', text: focus.content } : null,
      ]
    : [
        { key: 'year', className: 'ticker__year', text: String(year.year) },
        { key: 'title', className: 'ticker__title', text: year.title },
        { key: 'sub', className: 'ticker__sub', text: year.subtitle },
        { key: 'quote', className: 'ticker__quote', text: `“${year.quote}”` },
      ]
  const shown = lines.filter((l): l is { key: string; className: string; text: string } => !!l)

  return (
    <aside className={`ticker ${hasEntered ? 'is-visible' : ''}`} aria-hidden key={focus?.id ?? `year-${year.year}`}>
      <div ref={track} className={`ticker__track ${focus ? '' : 'is-static'}`}>
        {shown.map((l) => (
          <p key={l.key} className={l.className}>
            {l.text}
          </p>
        ))}
      </div>
    </aside>
  )
}
