import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { fetchYearCounts } from '../lib/g4uMemories'
import { isSupabaseConfigured } from '../lib/supabase'
import { YEARS, YEAR_COUNT } from './timeline.data'
import { isPhoneLayout } from '../utils/device'

/**
 * The journey is measured in "slots" (one slot = one stretch of guitar neck).
 * Every year takes at least one slot; a year with many memories takes more, so
 * the strings lengthen to give each memory room instead of crowding them.
 */

/** An empty stretch of open strings before the first year. */
export const LEAD_IN_SLOTS = 1

/** How many memories fit along one slot (both sides of the strings together). */
export const MEMORIES_PER_SLOT = 3

export interface JourneyLayout {
  /** Published memories per year. */
  counts: Record<number, number>
  /** Slots each year occupies (>= 1). */
  spans: number[]
  /** Slot where each year's fret sits; its memories follow along the next `span` slots. */
  starts: number[]
  /** Total path length in slots. */
  slotsLength: number
}

export function computeLayout(counts: Record<number, number>): JourneyLayout {
  const spans = YEARS.map((y) => Math.max(1, Math.ceil((counts[y.year] ?? 0) / (isPhoneLayout() ? MEMORIES_PER_SLOT / 2 : MEMORIES_PER_SLOT))))
  const starts: number[] = []
  let slot = LEAD_IN_SLOTS
  for (const span of spans) {
    starts.push(slot)
    slot += span
  }
  const last = YEAR_COUNT - 1
  // The final year's fret ends the path unless it has memories that need room after it.
  const tail = (counts[YEARS[last].year] ?? 0) > 0 ? spans[last] : 0
  return { counts, spans, starts, slotsLength: starts[last] + tail }
}

export const journeyStore = createStore<{ layout: JourneyLayout }>(() => ({ layout: computeLayout({}) }))

export const getLayout = () => journeyStore.getState().layout

export function useJourneyLayout(): JourneyLayout {
  return useStore(journeyStore, (s) => s.layout)
}

/** Reload per-year memory counts; the journey re-measures itself when they change. */
export async function refreshJourneyCounts(): Promise<void> {
  if (!isSupabaseConfigured) return
  try {
    const counts = await fetchYearCounts()
    const prev = getLayout().counts
    const same = YEARS.every((y) => (prev[y.year] ?? 0) === (counts[y.year] ?? 0))
    if (!same) journeyStore.setState({ layout: computeLayout(counts) })
  } catch (err) {
    console.warn('[g4u] could not measure the journey', err)
  }
}

/** Fractional year index at a slot; negative while still in the lead-in. */
export function slotToYearPosition(layout: JourneyLayout, slot: number): number {
  if (slot < layout.starts[0]) return slot - layout.starts[0]
  let i = layout.starts.length - 1
  while (i > 0 && layout.starts[i] > slot) i--
  return i + (slot - layout.starts[i]) / layout.spans[i]
}

/** The year a slot belongs to — a year becomes active half a slot before its fret. */
export function activeYearAtSlot(layout: JourneyLayout, slot: number): number {
  let i = layout.starts.length - 1
  while (i > 0 && layout.starts[i] > slot + 0.5) i--
  return i
}

// Convenience wrappers over the current layout (progress t is 0..1 along the whole journey).
export const yearIndexToT = (index: number) => getLayout().starts[index] / getLayout().slotsLength
export const tToSlot = (t: number) => t * getLayout().slotsLength
export const tToYearPosition = (t: number) => slotToYearPosition(getLayout(), tToSlot(t))

/** The hero finishes fading a fifth of a slot into the journey. */
export const getHeroFadeEnd = () => 0.2 / getLayout().slotsLength
