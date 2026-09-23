import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Line } from '@react-three/drei'
import { getStringOffsets, sampleStringPoints, sampleNeckEdge, useJourneyPath } from './guitarPath'
import { YEARS } from '../timeline/timeline.data'
import { YearNode } from './YearNode'
import { getTimelineState } from '../timeline/TimelineController'
import { getHeroFadeEnd } from '../timeline/journey'

const EDGE_BASE_OPACITY = 0.3
const STRING_BASE_OPACITY = 0.82
// Low-to-high string gauge, purely visual — thicker "bass" strings, thinner "treble".
const STRING_WIDTHS = [2.0, 1.6, 1.3, 1.0, 0.8]
// Strings read as bright metal, the edge rails as a dimmer wood-toned frame —
// the same contrast a real neck has between its binding and its strings.
// Warm ivory to muted gold; no glow — the path should feel engraved, not neon.
const STRING_LOW_COLOR = new THREE.Color('#c4a468')
const STRING_HIGH_COLOR = new THREE.Color('#e8e2d6')
const EDGE_COLOR = new THREE.Color('#6f5c39')

type LineHandle = { material: THREE.Material & { opacity: number } } | null

export function GuitarTimeline() {
  const path = useJourneyPath()
  const stringOffsets = useMemo(() => getStringOffsets(), [])
  const strings = useMemo(
    () =>
      stringOffsets.map((offset, i) => ({
        points: sampleStringPoints(path, offset).map((p) => [p.x, p.y, p.z] as [number, number, number]),
        color: STRING_LOW_COLOR.clone().lerp(STRING_HIGH_COLOR, i / (stringOffsets.length - 1)),
        width: STRING_WIDTHS[i] ?? 1,
      })),
    [stringOffsets, path],
  )

  const edges = useMemo(
    () =>
      ([-1, 1] as const).map((side) =>
        sampleNeckEdge(path, side).map((p) => [p.x, p.y, p.z] as [number, number, number]),
      ),
    [path],
  )

  // The Line2 mesh instances rendered by drei's <Line>, kept so we can fade
  // them in lockstep with the year nodes as the hero recedes.
  const stringRefs = useRef<LineHandle[]>([])
  const edgeRefs = useRef<LineHandle[]>([])

  useFrame(() => {
    const { smoothProgress } = getTimelineState()
    const heroReveal = THREE.MathUtils.smoothstep(smoothProgress, 0, getHeroFadeEnd())

    for (const line of stringRefs.current) {
      if (line?.material) line.material.opacity = STRING_BASE_OPACITY * heroReveal
    }
    for (const line of edgeRefs.current) {
      if (line?.material) line.material.opacity = EDGE_BASE_OPACITY * heroReveal
    }
  })

  return (
    <group>
      {edges.map((points, i) => (
        <Line
          key={i}
          ref={(el) => {
            edgeRefs.current[i] = el as never
          }}
          points={points}
          color={EDGE_COLOR}
          transparent
          opacity={0}
          lineWidth={1}
        />
      ))}

      {strings.map((string, i) => (
        <Line
          key={i}
          ref={(el) => {
            stringRefs.current[i] = el as never
          }}
          points={string.points}
          color={string.color}
          transparent
          opacity={0}
          lineWidth={string.width}
        />
      ))}

      {YEARS.map((entry, index) => (
        <YearNode key={entry.year} index={index} year={entry.year} />
      ))}
    </group>
  )
}
