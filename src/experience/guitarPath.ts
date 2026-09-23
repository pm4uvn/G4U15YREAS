import * as THREE from 'three'
import { YEAR_COUNT } from '../timeline/timeline.data'

/**
 * The timeline lives on a single continuous 3D curve: a gently tapering helix
 * that reads as a guitar neck, wrapped in strings, that the camera travels
 * along as `t` (progress) advances from 0 → 1. Each year node, and every line
 * making up the neck itself, are all positioned off this one curve.
 */
const RADIUS = 3.4
const TAPER = 0.3
const TURNS = 2.1
const SWAY = 1.1
const DEPTH_PER_YEAR = 9

function buildControlPoints(count: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = []
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const angle = t * Math.PI * TURNS
    const radius = RADIUS * (1 - t * TAPER)
    const x = Math.sin(angle) * radius
    const y = Math.cos(angle * 0.55) * SWAY + t * 0.6
    const z = -t * DEPTH_PER_YEAR * (count - 1)
    points.push(new THREE.Vector3(x, y, z))
  }
  return points
}

export const GUITAR_PATH_CONTROL_POINTS = buildControlPoints(YEAR_COUNT)

export const guitarPathCurve = new THREE.CatmullRomCurve3(
  GUITAR_PATH_CONTROL_POINTS,
  false,
  'catmullrom',
  0.35,
)

export const TOTAL_PATH_LENGTH = DEPTH_PER_YEAR * (YEAR_COUNT - 1)

/**
 * The camera rides a second, wider helix rather than the neck's own
 * centerline, so it always watches the timeline sweep past from a
 * consistent distance instead of flying straight through it. Now that the
 * neck is drawn as glowing outlines rather than a solid body, there's no
 * collision risk to guard against — this offset is purely about framing.
 * A small phase shift adds a bit of three-quarter viewing variety instead of
 * a flat top-down angle.
 */
const CAMERA_RADIUS_OFFSET = 2
const CAMERA_Y_OFFSET = 1.4
const CAMERA_PHASE_SHIFT = Math.PI / 9 // 20°

function buildCameraControlPoints(count: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = []
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const angle = t * Math.PI * TURNS + CAMERA_PHASE_SHIFT
    const radius = RADIUS * (1 - t * TAPER) + CAMERA_RADIUS_OFFSET
    const x = Math.sin(angle) * radius
    const y = Math.cos(angle * 0.55) * SWAY + t * 0.6 + CAMERA_Y_OFFSET
    const z = -t * DEPTH_PER_YEAR * (count - 1)
    points.push(new THREE.Vector3(x, y, z))
  }
  return points
}

export const CAMERA_PATH_CONTROL_POINTS = buildCameraControlPoints(YEAR_COUNT)

export const cameraPathCurve = new THREE.CatmullRomCurve3(
  CAMERA_PATH_CONTROL_POINTS,
  false,
  'catmullrom',
  0.35,
)

/**
 * The neck is drawn entirely out of glowing lines — two edge rails, evenly
 * spaced frets, five strings — rather than a solid extruded body. A filled
 * mesh viewed end-on down a long curve inevitably reads as a flat wedge in
 * perspective and can hide detail behind itself; lines can't do either: they
 * never occlude each other and never collapse to an invisible sliver.
 */
export const NECK_WIDTH = 0.85
export const SURFACE_LIFT = 0.05
export const NECK_STEPS = 260
export const STRING_COUNT = 5

/**
 * Parallel-transport (Frenet) frames sampled evenly along the curve. Every
 * line — edge rails, strings, frets — is offset from the same frame index at
 * a given `t`, which is what keeps them twisting together as the helix turns
 * instead of drifting apart.
 */
const frenetFrames = guitarPathCurve.computeFrenetFrames(NECK_STEPS, false)

export interface NeckFrame {
  point: THREE.Vector3
  tangent: THREE.Vector3
  normal: THREE.Vector3
  binormal: THREE.Vector3
}

export function getNeckFrame(t: number): NeckFrame {
  const clamped = THREE.MathUtils.clamp(t, 0, 1)
  const i = Math.round(clamped * NECK_STEPS)
  return {
    point: guitarPathCurve.getPointAt(clamped),
    tangent: frenetFrames.tangents[i],
    normal: frenetFrames.normals[i],
    binormal: frenetFrames.binormals[i],
  }
}

/** Evenly spaced string offsets across the neck width, low-to-high. */
export function getStringOffsets(): number[] {
  const span = NECK_WIDTH * 0.82
  return Array.from({ length: STRING_COUNT }, (_, i) =>
    THREE.MathUtils.mapLinear(i, 0, STRING_COUNT - 1, -span / 2, span / 2),
  )
}

/** Samples a line running parallel to the centerline, lifted just off the surface. */
function sampleOffsetLine(sideOffset: number, divisions: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = []
  for (let i = 0; i <= divisions; i++) {
    const { point, normal, binormal } = getNeckFrame(i / divisions)
    points.push(point.clone().addScaledVector(binormal, sideOffset).addScaledVector(normal, SURFACE_LIFT))
  }
  return points
}

/** Samples a string as a strip of points sitting just above the neck surface. */
export function sampleStringPoints(sideOffset: number, divisions = 240): THREE.Vector3[] {
  return sampleOffsetLine(sideOffset, divisions)
}

/** Samples one of the neck's two edge rails (side = -1 left, +1 right). */
export function sampleNeckEdge(side: -1 | 1, divisions = 240): THREE.Vector3[] {
  return sampleOffsetLine(side * (NECK_WIDTH / 2), divisions)
}
