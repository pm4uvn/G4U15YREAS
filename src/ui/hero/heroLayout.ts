/** Geometry and layout data for the cover scene. Everything is deterministic (no Math.random). */

export const SCENE_W = 1600
export const SCENE_H = 900

interface Pt {
  x: number
  y: number
}

// The road is two cubic Béziers. `d` fans the strings out: wide at the bottom-left,
// converging to a single point on the horizon at the right.
function segments(d: number): [Pt, Pt, Pt, Pt][] {
  return [
    [
      { x: -50, y: 930 + 70 * d },
      { x: 400, y: 905 + 55 * d },
      { x: 800, y: 835 + 35 * d },
      { x: 1100, y: 745 + 18 * d },
    ],
    [
      { x: 1100, y: 745 + 18 * d },
      { x: 1400, y: 655 + d },
      { x: 1400, y: 605 + 6 * d },
      { x: 1450 + 3 * d, y: 500 + d },
    ],
  ]
}

function cubic([p0, p1, p2, p3]: [Pt, Pt, Pt, Pt], t: number): Pt {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  }
}

/** u runs 0..2 across both segments. */
export function pointOnRoad(d: number, u: number): Pt {
  const segs = segments(d)
  const i = Math.min(1, Math.floor(u))
  return cubic(segs[i], u - i)
}

export function roadPath(d: number): string {
  const [a, b] = segments(d)
  const f = (p: Pt) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  return `M ${f(a[0])} C ${f(a[1])}, ${f(a[2])}, ${f(a[3])} C ${f(b[1])}, ${f(b[2])}, ${f(b[3])}`
}

/** Dark road surface between the two outermost strings. */
export function roadSurface(edge = 2.7, steps = 90): string {
  const left: string[] = []
  const right: string[] = []
  for (let i = 0; i <= steps; i++) {
    const u = (i / steps) * 2
    const a = pointOnRoad(-edge, u)
    const b = pointOnRoad(edge, u)
    left.push(`${a.x.toFixed(1)},${a.y.toFixed(1)}`)
    right.unshift(`${b.x.toFixed(1)},${b.y.toFixed(1)}`)
  }
  return [...left, ...right].join(' ')
}

/** Point on the centre line whose x is closest to the target. */
function pointAtX(x: number): Pt {
  let best = pointOnRoad(0, 0)
  for (let i = 0; i <= 400; i++) {
    const p = pointOnRoad(0, (i / 400) * 2)
    if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p
  }
  return best
}

export interface RoadMarker extends Pt {
  label?: string
  stem: number
}

export const ROAD_MARKERS: RoadMarker[] = [
  { ...pointAtX(640), label: '2011', stem: 30 },
  { ...pointAtX(1030), stem: 58 },
  { ...pointAtX(1225), label: '2015', stem: 58 },
  { ...pointAtX(1350), label: '2020', stem: 52 },
  { ...pointAtX(1440), label: '2026', stem: 56 },
]

export const STRING_OFFSETS = [-2, -1, 0, 1, 2]

function seeded(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const starRand = seeded(7)
export const STARS = Array.from({ length: 90 }, () => ({
  x: starRand() * SCENE_W,
  y: starRand() * 420,
  r: 0.4 + starRand() * 1.1,
  o: 0.25 + starRand() * 0.6,
}))

const sparkRand = seeded(21)
/** Embers drifting off the guitar body and the hills. */
export const EMBERS = Array.from({ length: 56 }, (_, i) => ({
  x: 40 + sparkRand() * 640,
  y: 470 + sparkRand() * 400,
  r: 0.8 + sparkRand() * 2.2,
  o: 0.3 + sparkRand() * 0.7,
  delay: (i % 9) * 0.55,
}))

export interface HeroCard {
  left: number
  top: number
  width: number
  rot: number
  /** translateZ in px: negative sits behind, positive floats in front. */
  z: number
  /** Pointer parallax travel in px (kept to 2–8 so photos never distract). */
  depth: number
  opacity: number
  tone: number
  people: number
  delay: number
  dur: number
}

/**
 * Eight memories at most, in percent of the stage. They sit only in the outer thirds — the
 * central 40% stays calm for the copy — and avoid the guitar neck, the road's upper curve and
 * the Sound button. Sizes, tilts and depths are deliberately uneven so they never read as a grid.
 */
export const HERO_CARDS: HeroCard[] = [
  { left: 15, top: 5, width: 11, rot: -5, z: -20, depth: 3, opacity: 0.44, tone: 0, people: 3, delay: 0, dur: 9 },
  { left: 23, top: 17, width: 9, rot: 4, z: 15, depth: 6, opacity: 0.6, tone: 1, people: 2, delay: 1.2, dur: 11 },
  { left: 17, top: 32, width: 10, rot: -3, z: 5, depth: 5, opacity: 0.52, tone: 2, people: 3, delay: 0.6, dur: 10 },
  { left: 26, top: 3, width: 8, rot: 6, z: -30, depth: 3, opacity: 0.36, tone: 0, people: 4, delay: 2, dur: 12 },
  { left: 71, top: 3, width: 9, rot: 4, z: -25, depth: 3, opacity: 0.4, tone: 2, people: 3, delay: 0.9, dur: 12 },
  { left: 79, top: 1, width: 8, rot: -4, z: 20, depth: 6, opacity: 0.48, tone: 1, people: 2, delay: 0.2, dur: 10 },
  { left: 84, top: 64, width: 11, rot: -3, z: -10, depth: 3, opacity: 0.46, tone: 2, people: 3, delay: 1.9, dur: 10 },
  { left: 86, top: 46, width: 10, rot: 5, z: 15, depth: 6, opacity: 0.55, tone: 0, people: 4, delay: 0.7, dur: 13 },
]
