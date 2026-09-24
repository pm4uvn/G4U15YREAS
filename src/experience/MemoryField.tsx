import { useEffect } from 'react'
import { useTimelineStore } from '../timeline/TimelineController'
import { useJourneyLayout } from '../timeline/journey'
import { YEARS, YEAR_COUNT } from '../timeline/timeline.data'
import { loadMore, useMemoriesByYear } from '../memories/hooks/useMemoriesByYear'
import { MemoryNode } from './MemoryNode'
import { pathLean, useJourneyPath } from './guitarPath'

/** Memories are mounted only for the active year and its neighbours; the rest stay unloaded. */
const YEARS_AROUND = 1

/** Fraction of a year's stretch left empty after its fret before the first memory. */
const LEAD = 0.35

function YearMemories({ yearIndex }: { yearIndex: number }) {
  const year = YEARS[yearIndex].year
  const layout = useJourneyLayout()
  const path = useJourneyPath()
  const { items, hasMore, loadingMore } = useMemoriesByYear(year)

  // The 3D field shows every memory, not just the first page — keep paging until the year is complete.
  useEffect(() => {
    if (hasMore && !loadingMore) void loadMore(year)
  }, [hasMore, loadingMore, year, items.length])

  const start = layout.starts[yearIndex]
  const span = layout.spans[yearIndex]
  // Place by the year's full count so positions stay put while later pages are still loading.
  const n = Math.max(layout.counts[year] ?? 0, items.length)

  return (
    <>
      {items.map((memory, k) => {
        // Spread the year's memories evenly across its stretch of neck, on whichever side of the strings is open at that point.
        // Memories begin a little way past the year's fret so the first ones arrive at a comfortable
        // distance from the camera instead of right on top of it.
        const slot = start + (LEAD + (1 - LEAD) * ((k + 1) / (n + 1))) * span
        return <MemoryNode key={memory.id} memory={memory} slot={slot} side={-pathLean(path, slot) as -1 | 1} />
      })}
    </>
  )
}

/** All memories currently in reach of the camera, hung along both sides of the strings. */
export function MemoryField() {
  const active = useTimelineStore((s) => s.activeYearIndex)
  const hasEntered = useTimelineStore((s) => s.hasEntered)
  if (!hasEntered) return null

  const indices: number[] = []
  for (let d = -YEARS_AROUND; d <= YEARS_AROUND; d++) {
    const i = active + d
    if (i >= 0 && i < YEAR_COUNT) indices.push(i)
  }
  return (
    <>
      {indices.map((i) => (
        <YearMemories key={YEARS[i].year} yearIndex={i} />
      ))}
    </>
  )
}
