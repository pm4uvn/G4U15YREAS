import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getNeckFrame, NECK_WIDTH, SURFACE_LIFT, useJourneyPath } from './guitarPath'
import { getTimelineState } from '../timeline/TimelineController'
import { getHeroFadeEnd, tToSlot } from '../timeline/journey'

const IVORY = '#E8E2D6'
const UP = new THREE.Vector3(0, 1, 0)

/**
 * How far the lettering is stood up from the neck plane (0 = lying flat, 90° = upright). Flat text
 * is squashed to a sliver by the camera's shallow angle; leaning it up keeps it legible.
 */
const TILT = THREE.MathUtils.degToRad(62)

const SERIF_URL =
  'https://cdn.jsdelivr.net/npm/@fontsource/cormorant-garamond@5/files/cormorant-garamond-latin-500-normal.woff'
const FONT_FAMILY = '"G4U Serif", "Cormorant Garamond", "Iowan Old Style", Georgia, serif'

let fontReady: Promise<void> | null = null
/** The serif used elsewhere for years; if it cannot load, the system serif is used instead. */
function loadFont(): Promise<void> {
  fontReady ??= (async () => {
    try {
      const face = new FontFace('G4U Serif', `url(${SERIF_URL})`, { weight: '500' })
      document.fonts.add(await face.load())
    } catch {
      /* fall back to Georgia */
    }
  })()
  return fontReady
}

/** Draws the line straight, with generous letter-spacing, onto a transparent canvas. */
function drawLine(text: string): { texture: THREE.CanvasTexture; aspect: number } {
  const fontPx = 110
  const tracking = fontPx * 0.15
  const pad = fontPx * 0.5
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = `500 ${fontPx}px ${FONT_FAMILY}`
  const chars = [...text]
  const widths = chars.map((c) => measure.measureText(c).width)
  const total = widths.reduce((a, b) => a + b, 0) + tracking * (chars.length - 1)

  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(total + pad * 2)
  canvas.height = Math.ceil(fontPx * 1.6)
  const ctx = canvas.getContext('2d')!
  ctx.font = `500 ${fontPx}px ${FONT_FAMILY}`
  ctx.textBaseline = 'middle'
  ctx.fillStyle = IVORY
  let x = pad
  chars.forEach((c, i) => {
    ctx.fillText(c, x, canvas.height / 2)
    x += widths[i] + tracking
  })

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return { texture, aspect: canvas.width / canvas.height }
}

interface PathTextProps {
  text: string
  /** Slot where the line begins; it runs away from the camera along the strings. */
  fromSlot: number
  /** Height of the letters' line, in world units. */
  height?: number
  /** Which side of the strings: -1 = left, 1 = right. */
  side?: -1 | 1
  opacity?: number
}

/**
 * A line of lettering lying on the neck plane beside the strings and bending with them, read from
 * near to far like a caption on the path. One ribbon mesh, so spacing stays exact along the curve.
 */
export function PathText({ text, fromSlot, height = 0.5, side = -1, opacity = 0.85 }: PathTextProps) {
  const path = useJourneyPath()
  const [line, setLine] = useState<{ texture: THREE.CanvasTexture; aspect: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    let made: THREE.CanvasTexture | null = null
    void loadFont().then(() => {
      if (cancelled) return
      const drawn = drawLine(text)
      made = drawn.texture
      setLine(drawn)
    })
    return () => {
      cancelled = true
      made?.dispose()
    }
  }, [text])

  const ribbon = useMemo(() => {
    if (!line) return null
    const wanted = line.aspect * height
    const positions: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    // Sample the path densely from `fromSlot`, stopping once the line's natural length is used up.
    const steps = 220
    const spanSlots = 1.1
    let travelled = 0
    let prev: THREE.Vector3 | null = null
    const samples: { p: THREE.Vector3; side: THREE.Vector3; lift: THREE.Vector3; dist: number }[] = []
    for (let i = 0; i <= steps; i++) {
      const s = fromSlot + (i / steps) * spanSlots
      const frame = getNeckFrame(s / path.slotsLength, path)
      const right = new THREE.Vector3().crossVectors(frame.tangent, UP).normalize()
      const up = new THREE.Vector3().crossVectors(right, frame.tangent).normalize()
      // The neck's own plane (so the lettering stays coplanar with the strings), oriented left/up.
      const outward = side === -1 ? right.clone().negate() : right.clone()
      const b = frame.binormal.clone()
      if (b.dot(outward) < 0) b.negate()
      const n = frame.normal.clone()
      if (n.dot(up) < 0) n.negate()
      if (prev) travelled += frame.point.distanceTo(prev)
      prev = frame.point
      samples.push({ p: frame.point.clone(), side: b, lift: n, dist: travelled })
      if (travelled >= wanted) break
    }
    const total = Math.min(travelled, wanted)
    const letterHeight = total < wanted ? total / line.aspect : height
    const inner = NECK_WIDTH / 2 + 0.22

    samples.forEach((sm, i) => {
      const u = Math.min(1, sm.dist / total)
      const base = sm.p.clone().addScaledVector(sm.lift, SURFACE_LIFT + 0.01)
      const bottom = base.clone().addScaledVector(sm.side, inner)
      // The top edge leans outward and up, so the line stands off the neck like a slanted sign.
      const top = base
        .clone()
        .addScaledVector(sm.side, inner + letterHeight * Math.cos(TILT))
        .addScaledVector(sm.lift, letterHeight * Math.sin(TILT))
      positions.push(bottom.x, bottom.y, bottom.z, top.x, top.y, top.z)
      uvs.push(u, 0, u, 1)
      if (i > 0) {
        const a = (i - 1) * 2
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    })

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    g.setIndex(indices)
    return { geometry: g, endSlot: fromSlot + (samples.length / steps) * spanSlots }
  }, [line, path, fromSlot, height, side])

  useEffect(() => () => ribbon?.geometry.dispose(), [ribbon])

  const material = useRef<THREE.MeshBasicMaterial>(null)

  useFrame(() => {
    if (!ribbon || !line) return
    const { smoothProgress } = getTimelineState()
    const slot = tToSlot(smoothProgress)
    const reveal = THREE.MathUtils.smoothstep(smoothProgress, 0, getHeroFadeEnd())
    // Once the camera has run past the end of the line, let it go.
    const passed = 1 - THREE.MathUtils.smoothstep(slot, ribbon.endSlot - 0.3, ribbon.endSlot + 0.5)
    if (material.current) material.current.opacity = opacity * reveal * passed
  })

  if (!ribbon) return null
  return (
    <mesh geometry={ribbon.geometry} frustumCulled={false} renderOrder={2}>
      <meshBasicMaterial
        ref={material}
        map={line?.texture ?? null}
        transparent
        opacity={0}
        side={THREE.DoubleSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}
