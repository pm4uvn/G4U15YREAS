import { useEffect, useMemo, useRef, useState } from 'react'
import { useTimeline } from '../timeline/useTimeline'
import { timelineStore } from '../timeline/TimelineController'
import { tToSlot, useJourneyLayout } from '../timeline/journey'
import { YEARS } from '../timeline/timeline.data'
import { fetchAllMemoryTexts, type MemoryText } from '../lib/g4uMemories'
import { isSupabaseConfigured } from '../lib/supabase'
import { pathLean, useJourneyPath } from '../experience/guitarPath'
import './ticker.css'

/** Must match MemoryField: memories begin this far into their year's stretch of neck. */
const LEAD = 0.35
/** The memory being passed is the one nearest a little ahead of the camera, where its card is in view. */
const LOOK_AHEAD_SLOTS = 0.7

interface Entry extends MemoryText {
  slot: number
  /** Which way the strings sweep here; the words sit on that side, the memory card opposite. */
  lean: 1 | -1
}

function dateLabel(m: MemoryText): string {
  const d = new Date(m.memoryDate ?? m.createdAt)
  if (Number.isNaN(d.getTime())) return String(m.year)
  return m.memoryDate ? d.toLocaleDateString('vi-VN') : String(m.year)
}

/**
 * The right side of the screen: the words of every memory on the timeline, in order, in one long
 * column. The column follows the scroll so the memory the camera is passing sits in the middle.
 */
export function MessageTicker() {
  const { activeYearIndex, hasEntered } = useTimeline()
  const layout = useJourneyLayout()
  const path = useJourneyPath()
  const [texts, setTexts] = useState<MemoryText[]>([])

  // Refetch whenever the number of memories changes (someone added or removed one).
  const total = YEARS.reduce((n, y) => n + (layout.counts[y.year] ?? 0), 0)
  useEffect(() => {
    if (!isSupabaseConfigured) return
    let live = true
    fetchAllMemoryTexts()
      .then((rows) => live && setTexts(rows))
      .catch((err) => console.warn('[g4u] could not load memory texts', err))
    return () => {
      live = false
    }
  }, [total])

  const entries = useMemo<Entry[]>(() => {
    const byYear = new Map<number, MemoryText[]>()
    for (const t of texts) byYear.set(t.year, [...(byYear.get(t.year) ?? []), t])
    const out: Entry[] = []
    for (const [year, items] of byYear) {
      const i = YEARS.findIndex((y) => y.year === year)
      if (i < 0) continue
      const n = Math.max(layout.counts[year] ?? 0, items.length)
      items.forEach((m, k) => {
        const slot = layout.starts[i] + (LEAD + (1 - LEAD) * ((k + 1) / (n + 1))) * layout.spans[i]
        out.push({ ...m, slot, lean: pathLean(path, slot) })
      })
    }
    return out.sort((a, b) => a.slot - b.slot)
  }, [texts, layout, path])

  const track = useRef<HTMLDivElement>(null)
  const aside = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = track.current
    if (!el || entries.length === 0) return
    let current = -1
    const move = () => {
      const strip = el.parentElement
      if (!strip) return
      const slot = tToSlot(timelineStore.getState().smoothProgress) + LOOK_AHEAD_SLOTS
      // Fractional position between the memories, so the column glides instead of jumping.
      let idx = 0
      if (slot >= entries[entries.length - 1].slot) idx = entries.length - 1
      else if (slot > entries[0].slot) {
        let i = 0
        while (i < entries.length - 2 && entries[i + 1].slot <= slot) i++
        idx = i + (slot - entries[i].slot) / (entries[i + 1].slot - entries[i].slot)
      }
      const kids = el.children
      const a = kids[Math.floor(idx)] as HTMLElement | undefined
      const b = (kids[Math.ceil(idx)] as HTMLElement | undefined) ?? a
      if (!a || !b) return
      const centerA = a.offsetTop + a.offsetHeight / 2
      const centerB = b.offsetTop + b.offsetHeight / 2
      const center = centerA + (centerB - centerA) * (idx - Math.floor(idx))
      el.style.transform = `translateY(${strip.clientHeight / 2 - center}px)`

      const nearest = Math.round(idx)
      if (nearest !== current) {
        current = nearest
        const side = entries[nearest].lean > 0 ? 'right' : 'left'
        if (aside.current && aside.current.dataset.side !== side) aside.current.dataset.side = side
        for (let k = 0; k < kids.length; k++) {
          const d = Math.abs(k - nearest)
          kids[k].classList.toggle('is-current', d === 0)
          kids[k].classList.toggle('is-near', d === 1)
        }
      }
    }
    move()
    return timelineStore.subscribe(move)
  }, [entries])

  const year = YEARS[activeYearIndex]

  return (
    <aside ref={aside} className={`ticker ${hasEntered ? 'is-visible' : ''}`} data-side="right" aria-hidden>
      {entries.length > 0 ? (
        <div ref={track} className="ticker__track">
          {entries.map((e) => (
            <article key={e.id} className="ticker__entry">
              <p className="ticker__year">{e.year}</p>
              {e.title && <p className="ticker__title">{e.title}</p>}
              <p className="ticker__sub">{[e.author, dateLabel(e), e.location].filter(Boolean).join(' · ')}</p>
              {e.content && <p className="ticker__memory">{e.content}</p>}
            </article>
          ))}
        </div>
      ) : (
        <div className="ticker__track is-static">
          <p className="ticker__year">{year.year}</p>
          <p className="ticker__title">{year.title}</p>
          <p className="ticker__sub">{year.subtitle}</p>
          <p className="ticker__quote">{`“${year.quote}”`}</p>
        </div>
      )}
    </aside>
  )
}
