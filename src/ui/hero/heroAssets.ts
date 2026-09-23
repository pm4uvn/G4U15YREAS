import { YEARS } from '../../timeline/timeline.data'
import { ROAD_MARKERS, SCENE_H, SCENE_W } from './heroLayout'

/**
 * Cover artwork. All layers are expected to share one 16:9 canvas (same
 * pixel size as hero-bg) so the road, guitar and markers stay registered.
 * A missing file falls back to the built-in vector version of that layer.
 */
export const HERO_ASSETS = {
  background: '/hero/hero-bg.webp',
  road: '/hero/hero-road.webp',
  guitar: '/hero/hero-guitar.webp',
  particles: '/hero/hero-particles.webp',
  logo: '/hero/logo-g15-gold.png',
  memory: (n: number) => `/memories/memory-${String(n).padStart(2, '0')}.webp`,
  memoryCount: 12,
} as const

/** bg, road, guitar and particles are authored on one shared canvas of this size. */
export const HERO_CANVAS = { width: 2560, height: 1440 } as const

export type HeroCanvasLayer = 'bg' | 'road' | 'guitar' | 'particles'

/**
 * Layers are NOT repositioned by default: each fills the 16:9 stage exactly
 * (inset 0, 100% × 100%, object-fit cover, centred). Add an entry here only to
 * deliberately nudge one layer — x/y in percent of the canvas, scale as a multiplier.
 */
export const HERO_LAYER_OVERRIDES: Partial<Record<HeroCanvasLayer, { x?: number; y?: number; scale?: number }>> = {
  // Road sits a little lower so it guides the eye up from the bottom instead of crossing the copy.
  // The milestone dots below already include this shift.
  road: { y: 4 },
}

export function layerOverrideStyle(layer: HeroCanvasLayer) {
  const o = HERO_LAYER_OVERRIDES[layer]
  if (!o) return undefined
  return { transform: `translate(${o.x ?? 0}%, ${o.y ?? 0}%) scale(${o.scale ?? 1})` }
}

export interface HeroMilestone {
  year: number
  /** Dot position on the road, percent of the stage. */
  x: number
  y: number
  /** Stem height, percent of stage height. */
  stem: number
}

/** Milestones shown on the cover; the full 2011–2026 range lives in the journey itself. */
const MILESTONE_YEARS = [2011, 2015, 2020, 2026]

/**
 * Positions default to the built-in vector road. When the real hero-road art
 * lands, put each year's dot on its road here (percent of the 16:9 canvas).
 */
const OVERRIDES: Partial<Record<number, { x: number; y: number; stem?: number }>> = {
  // Placed on the supplied hero-road art (percent of the 1672×941 canvas), kept clear of the centre copy column.
  2011: { x: 30.8, y: 81.4, stem: 4 },
  2015: { x: 70.9, y: 65.6, stem: 6 },
  2020: { x: 86, y: 32.7, stem: 5.5 },
  2026: { x: 88.5, y: 14.1, stem: 3 },
}

const BUILT_IN: Record<number, { x: number; y: number; stem: number }> = Object.fromEntries(
  ROAD_MARKERS.filter((m) => m.label).map((m) => [
    Number(m.label),
    { x: (m.x / SCENE_W) * 100, y: (m.y / SCENE_H) * 100, stem: (m.stem / SCENE_H) * 100 },
  ]),
)

export const HERO_MILESTONES: HeroMilestone[] = MILESTONE_YEARS.filter((y) => YEARS.some((e) => e.year === y)).map(
  (year) => ({ year, ...(BUILT_IN[year] ?? { x: 50, y: 80, stem: 6 }), ...OVERRIDES[year] }),
)

/** Where the road meets the horizon — the transition zooms toward this point. */
export const ROAD_END = { x: 88.5, y: 16 }
