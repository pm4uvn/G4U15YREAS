import { useEffect } from 'react'
import { create } from 'zustand'
import { fetchYearPage, PAGE_SIZE, toMemoryError } from '../../lib/g4uMemories'
import { signPaths } from '../../lib/supabaseStorage'
import { isSupabaseConfigured } from '../../lib/supabase'
import { youtubeThumbnail } from '../../lib/youtube'
import { FIRST_YEAR, LAST_YEAR } from '../../timeline/timeline.data'
import type { G4UMemory } from '../../types/g4u-memory'
import { firstVisual } from '../memoryFormat'

export interface YearState {
  items: G4UMemory[]
  total: number
  hasMore: boolean
  status: 'loading' | 'ready' | 'error'
  loadingMore: boolean
  error?: string
}

const EMPTY: YearState = { items: [], total: 0, hasMore: false, status: 'loading', loadingMore: false }

interface MemoriesStore {
  years: Record<number, YearState>
  patch: (year: number, patch: Partial<YearState>) => void
}

const useStore = create<MemoriesStore>((set) => ({
  years: {},
  patch: (year, patch) =>
    set((s) => ({ years: { ...s.years, [year]: { ...(s.years[year] ?? EMPTY), ...patch } } })),
}))

const inflight = new Map<number, Promise<void>>()

function coverPath(m: G4UMemory): string | undefined {
  const first = firstVisual(m)
  if (!first) return undefined
  if (first.mediaType === 'video') return undefined // YouTube posters need no signing
  return first.thumbnailPath ?? first.storagePath
}

/** YouTube posters are public URLs; only uploaded photos need signing. */
function youtubeCover(m: G4UMemory): string | undefined {
  const first = firstVisual(m)
  return first?.mediaType === 'video' && first.externalId ? youtubeThumbnail(first.externalId) : undefined
}

/** Sign only each memory's cover thumbnail — never full-size media — for previews. */
async function signCovers(year: number) {
  const state = useStore.getState().years[year]
  if (!state) return
  const pending = state.items.filter((m) => !m.coverUrl)
  if (pending.length === 0) return

  let urls: Record<string, string> = {}
  const toSign = pending.map(coverPath).filter(Boolean) as string[]
  if (toSign.length > 0) {
    try {
      urls = await signPaths(toSign)
    } catch (err) {
      console.warn('[g4u] could not sign cover thumbnails', err)
    }
  }

  const latest = useStore.getState().years[year]
  if (!latest) return
  useStore.getState().patch(year, {
    items: latest.items.map((m) => {
      if (m.coverUrl) return m
      const p = coverPath(m)
      const coverUrl = (p && urls[p]) || youtubeCover(m)
      return coverUrl ? { ...m, coverUrl } : m
    }),
  })
}

export function fetchYear(year: number, force = false): Promise<void> {
  const existing = useStore.getState().years[year]
  if (!force && existing?.status === 'ready') return Promise.resolve()
  const running = inflight.get(year)
  if (running) return running

  const { patch } = useStore.getState()
  if (force || !existing) patch(year, { status: existing?.status === 'ready' ? 'ready' : 'loading', error: undefined })

  const job = fetchYearPage(year, 0)
    .then(({ items, total }) => {
      patch(year, { items, total, hasMore: items.length < total, status: 'ready', error: undefined })
    })
    .catch((err) => {
      const e = toMemoryError(err)
      console.error('[g4u] failed to load memories', year, e.detail ?? e)
      patch(year, { status: 'error', error: e.userMessage })
    })
    .finally(() => inflight.delete(year))
  inflight.set(year, job)
  return job
}

export async function loadMore(year: number): Promise<void> {
  const s = useStore.getState().years[year]
  if (!s || !s.hasMore || s.loadingMore) return
  const { patch } = useStore.getState()
  patch(year, { loadingMore: true })
  try {
    const { items, total } = await fetchYearPage(year, s.items.length)
    const cur = useStore.getState().years[year] ?? s
    const merged = [...cur.items, ...items]
    patch(year, { items: merged, total, hasMore: merged.length < total, loadingMore: false })
    void signCovers(year)
  } catch (err) {
    const e = toMemoryError(err)
    console.error('[g4u] failed to load more memories', year, e.detail ?? e)
    patch(year, { loadingMore: false, error: e.userMessage })
  }
}

/** Drop the cache for a year and reload it (e.g. after posting a memory). */
export async function reloadYear(year: number): Promise<void> {
  await fetchYear(year, true)
  void signCovers(year)
}

export { PAGE_SIZE }

/** A year's current cache, read outside of React (e.g. by the guided tour). */
export function getYearState(year: number): YearState {
  return useStore.getState().years[year] ?? EMPTY
}

export function useMemoriesByYear(year: number) {
  const state = useStore((s) => s.years[year]) ?? EMPTY

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let cancelled = false
    void fetchYear(year).then(() => {
      if (cancelled) return
      void signCovers(year)
      // Adjacent years: metadata only, so stepping through the timeline feels instant.
      for (const adj of [year - 1, year + 1]) {
        if (adj >= FIRST_YEAR && adj <= LAST_YEAR) void fetchYear(adj)
      }
    })
    return () => {
      cancelled = true
    }
  }, [year])

  return {
    ...state,
    configured: isSupabaseConfigured,
    loadMore: () => loadMore(year),
    reload: () => reloadYear(year),
  }
}
