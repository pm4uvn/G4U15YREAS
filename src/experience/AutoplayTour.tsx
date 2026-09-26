import { useEffect } from 'react'
import { useExperienceStore } from '../store/experienceStore'
import { useJourneyLayout } from '../timeline/journey'
import { YEARS } from '../timeline/timeline.data'
import { scrollToSlot } from '../timeline/TimelineController'
import { fetchAllMemories } from '../lib/g4uMemories'
import { fetchYear, getYearState, loadMore } from '../memories/hooks/useMemoriesByYear'
import type { G4UMemory } from '../types/g4u-memory'

/** Must match MemoryField's own placement, so the tour stops exactly where each 3D card hangs. */
const LEAD = 0.35

interface Stop {
  memory: G4UMemory
  slot: number
}

/** How long to linger on a memory once it's open, based on what there is to see/hear. */
function dwellMs(memory: G4UMemory): number {
  if (memory.media.some((m) => m.mediaType === 'video')) return 14000
  const audio = memory.media.find((m) => m.mediaType === 'audio')
  if (audio) return Math.min(20000, (audio.duration ?? 8) * 1000 + 2000)
  // An album cycles its own photos every 2s (see MemoryGallery) — give it long enough to get
  // through all of them rather than cutting it off partway.
  const photos = memory.media.filter((m) => m.mediaType === 'image').length
  return Math.max(5000, photos * 5200)
}

/**
 * The fullscreen viewer reads from `useMemoriesByYear`'s own per-year page cache, which is
 * separate from `fetchAllMemories` above and normally only fills in as someone scrolls near a
 * year — so a stop in a year nobody has reached yet would open to "not found" without this.
 */
async function ensureMemoryLoaded(year: number, id: string, isCancelled: () => boolean) {
  await fetchYear(year)
  let state = getYearState(year)
  while (!isCancelled() && state.hasMore && !state.items.some((m) => m.id === id)) {
    await loadMore(year)
    state = getYearState(year)
  }
}

/** A cancellable wait: checked every 200ms, so turning the tour off is felt almost immediately. */
function wait(ms: number, isCancelled: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const step = 200
    let elapsed = 0
    const tick = () => {
      if (isCancelled() || elapsed >= ms) {
        resolve()
        return
      }
      elapsed += step
      window.setTimeout(tick, step)
    }
    tick()
  })
}

/**
 * The guided tour: scrolls through every memory in order, opens each one (so its photo/video,
 * story and comments show exactly as they would if a visitor opened it by hand), plays its
 * video or voice note on its own, lingers a few seconds, then moves on — until the person
 * scrolls, taps or clicks anything themselves, which hands control back immediately.
 */
export function AutoplayTour() {
  const autoplayOn = useExperienceStore((s) => s.autoplayOn)
  const setAutoplay = useExperienceStore((s) => s.setAutoplay)
  const layout = useJourneyLayout()

  useEffect(() => {
    if (!autoplayOn) return
    let cancelled = false
    const isCancelled = () => cancelled || !useExperienceStore.getState().autoplayOn

    const cancel = () => setAutoplay(false)
    window.addEventListener('wheel', cancel, { passive: true })
    window.addEventListener('touchstart', cancel, { passive: true })
    window.addEventListener('pointerdown', cancel, { passive: true })

    void (async () => {
      let memories: G4UMemory[]
      try {
        memories = await fetchAllMemories()
      } catch (err) {
        console.warn('[g4u] could not load the guided tour', err)
        setAutoplay(false)
        return
      }
      if (isCancelled() || memories.length === 0) {
        if (memories.length === 0) setAutoplay(false)
        return
      }

      const byYear = new Map<number, G4UMemory[]>()
      for (const m of memories) byYear.set(m.year, [...(byYear.get(m.year) ?? []), m])

      const stops: Stop[] = []
      for (const [year, items] of byYear) {
        const i = YEARS.findIndex((y) => y.year === year)
        if (i < 0) continue
        const start = layout.starts[i]
        const span = layout.spans[i]
        const n = Math.max(layout.counts[year] ?? 0, items.length)
        items.forEach((memory, k) => {
          stops.push({ memory, slot: start + (LEAD + (1 - LEAD) * ((k + 1) / (n + 1))) * span })
        })
      }
      stops.sort((a, b) => a.slot - b.slot)

      const { openMemory, closeMemory } = useExperienceStore.getState()
      for (const stop of stops) {
        if (isCancelled()) return
        scrollToSlot(stop.slot)
        await ensureMemoryLoaded(stop.memory.year, stop.memory.id, isCancelled)
        await wait(1500, isCancelled)
        if (isCancelled()) return
        openMemory(stop.memory.year, stop.memory.id)
        await wait(dwellMs(stop.memory), isCancelled)
        closeMemory()
        if (isCancelled()) return
        await wait(400, isCancelled)
      }
      setAutoplay(false)
    })()

    return () => {
      cancelled = true
      window.removeEventListener('wheel', cancel)
      window.removeEventListener('touchstart', cancel)
      window.removeEventListener('pointerdown', cancel)
      useExperienceStore.getState().closeMemory()
    }
  }, [autoplayOn, layout, setAutoplay])

  return null
}
