import * as THREE from 'three'
import { getLayout, useJourneyLayout } from '../timeline/journey'
import { useMemo } from 'react'

/**
 * The timeline lives on one continuous 3D curve: a gently tapering helix that reads as a
 * guitar neck, wrapped in strings, which the camera travels along as progress runs 0 → 1.
 * The curve is built from the journey layout, so it lengthens when years gain memories.
 */
const RADIUS = 3.4
const TAPER = 0.3
const SWAY = 1.1
const DEPTH_PER_SLOT = 9
/** Turning per slot is constant, so a longer journey spirals further instead of stretching. */
const ANGLE_PER_SLOT = (Math.PI * 2.1) / 16
const STEPS_PER_SLOT = 16

/**
 * The camera rides a second, wider helix rather than the neck's own centerline, so it
 * watches the timeline sweep past from a consistent distance.
 */
const CAMERA_RADIUS_OFFSET = 2
const CAMERA_Y_OFFSET = 1.4
const CAMERA_PHASE_SHIFT = Math.PI / 9 // 20°

/**
 * The neck is drawn out of glowing lines — two edge rails, evenly spaced frets, five
 * strings — rather than a solid body, which reads as a flat wedge in perspective.
 */
export const NECK_WIDTH = 0.85
export const SURFACE_LIFT = 0.05
export const STRING_COUNT = 5

export interface NeckFrame {
  point: THREE.Vector3
  tangent: THREE.Vector3
  normal: THREE.Vector3
  binormal: THREE.Vector3
}

export interface JourneyPath {
  slotsLength: number
  curve: THREE.CatmullRomCurve3
  cameraCurve: THREE.CatmullRomCurve3
  steps: number
  frames: { tangents: THREE.Vector3[]; normals: THREE.Vector3[]; binormals: THREE.Vector3[] }
}

function buildPath(slotsLength: number): JourneyPath {
  const guide: THREE.Vector3[] = []
  const camera: THREE.Vector3[] = []
  for (let i = 0; i <= slotsLength; i++) {
    const t = i / slotsLength
    const angle = i * ANGLE_PER_SLOT
    const radius = RADIUS * (1 - t * TAPER)
    const y = Math.cos(angle * 0.55) * SWAY + t * 0.6
    const z = -i * DEPTH_PER_SLOT
    guide.push(new THREE.Vector3(Math.sin(angle) * radius, y, z))

    const camAngle = angle + CAMERA_PHASE_SHIFT
    const camY = Math.cos(camAngle * 0.55) * SWAY + t * 0.6 + CAMERA_Y_OFFSET
    camera.push(new THREE.Vector3(Math.sin(camAngle) * (radius + CAMERA_RADIUS_OFFSET), camY, z))
  }
  const curve = new THREE.CatmullRomCurve3(guide, false, 'catmullrom', 0.35)
  const cameraCurve = new THREE.CatmullRomCurve3(camera, false, 'catmullrom', 0.35)
  const steps = slotsLength * STEPS_PER_SLOT
  return { slotsLength, curve, cameraCurve, steps, frames: curve.computeFrenetFrames(steps, false) }
}

let cached: JourneyPath | null = null

/** The path for the current layout; rebuilt only when the journey's length changes. */
export function getJourneyPath(): JourneyPath {
  const { slotsLength } = getLayout()
  if (!cached || cached.slotsLength !== slotsLength) cached = buildPath(slotsLength)
  return cached
}

export function useJourneyPath(): JourneyPath {
  const { slotsLength } = useJourneyLayout()
  // slotsLength is the only input that changes the path.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => getJourneyPath(), [slotsLength])
}

export function getNeckFrame(t: number, path: JourneyPath = getJourneyPath()): NeckFrame {
  const clamped = THREE.MathUtils.clamp(t, 0, 1)
  const i = Math.round(clamped * path.steps)
  return {
    point: path.curve.getPointAt(clamped),
    tangent: path.frames.tangents[i],
    normal: path.frames.normals[i],
    binormal: path.frames.binormals[i],
  }
}

/** Evenly spaced string offsets across the neck width, low-to-high. */
export function getStringOffsets(): number[] {
  const span = NECK_WIDTH * 0.82
  return Array.from({ length: STRING_COUNT }, (_, i) =>
    THREE.MathUtils.mapLinear(i, 0, STRING_COUNT - 1, -span / 2, span / 2),
  )
}

/** A line running parallel to the centerline, lifted just off the surface. */
function sampleOffsetLine(path: JourneyPath, sideOffset: number): THREE.Vector3[] {
  const divisions = path.slotsLength * 15
  const points: THREE.Vector3[] = []
  for (let i = 0; i <= divisions; i++) {
    const { point, normal, binormal } = getNeckFrame(i / divisions, path)
    points.push(point.clone().addScaledVector(binormal, sideOffset).addScaledVector(normal, SURFACE_LIFT))
  }
  return points
}

export function sampleStringPoints(path: JourneyPath, sideOffset: number): THREE.Vector3[] {
  return sampleOffsetLine(path, sideOffset)
}

/** One of the neck's two edge rails (side = -1 left, +1 right). */
export function sampleNeckEdge(path: JourneyPath, side: -1 | 1): THREE.Vector3[] {
  return sampleOffsetLine(path, side * (NECK_WIDTH / 2))
}
