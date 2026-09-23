import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
import type { Mesh, MeshStandardMaterial } from 'three'
import { getNeckFrame, SURFACE_LIFT, NECK_WIDTH } from './guitarPath'
import { getTimelineState, HERO_FADE_END } from '../timeline/TimelineController'
import { YEAR_COUNT } from '../timeline/timeline.data'

interface YearNodeProps {
  index: number
  year: number
}

const ACTIVE_COLOR = new THREE.Color('#f2c879')
// Frets read as dim brushed metal at rest, not near-invisible dark gray —
// a real guitar's fret wire is always visible, just duller off the active year.
const DIM_COLOR = new THREE.Color('#9a9488')
const FRET_WIDTH = NECK_WIDTH * 1.35
const ACTIVE_WINDOW = 1.7

const _tmpColor = new THREE.Color()
const _worldUp = new THREE.Vector3(0, 1, 0)
const _labelRight = new THREE.Vector3()
const _labelUp = new THREE.Vector3()

export function YearNode({ index, year }: YearNodeProps) {
  // The fret marker, glow dot and year label all sit just off the neck
  // centerline, oriented by the same Frenet frame the edge rails and strings
  // use — so they twist with the helix in step with everything else.
  const frame = useMemo(() => getNeckFrame(index / (YEAR_COUNT - 1)), [index])

  const position = useMemo(
    () => frame.point.clone().addScaledVector(frame.normal, SURFACE_LIFT + 0.03),
    [frame],
  )

  const fretQuaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), frame.binormal),
    [frame],
  )

  // The label deliberately does NOT use the Frenet frame's `normal` — that
  // vector spins around with the helix's own twist (~756° over the full
  // journey), so a label offset by it drifts from "above the node" to
  // "below" it partway through the timeline. World-up stays fixed instead,
  // the same way CameraRig derives its own up vector, so the label reads as
  // "above" consistently for the whole journey.
  const labelOffset = useMemo(() => {
    _labelRight.crossVectors(frame.tangent, _worldUp).normalize()
    _labelUp.crossVectors(_labelRight, frame.tangent).normalize()
    return _labelUp.clone().multiplyScalar(0.34)
  }, [frame])

  const groupRef = useRef<THREE.Group>(null)
  const fretRef = useRef<Mesh>(null)
  const dotRef = useRef<Mesh>(null)
  // troika-three-text's Text instance — not part of three's public types, so `any` is intentional here.
  const textRef = useRef<any>(null)

  useFrame(() => {
    const { smoothProgress } = getTimelineState()
    const yearsDistance = Math.abs(smoothProgress * (YEAR_COUNT - 1) - index)
    const active = THREE.MathUtils.clamp(1 - yearsDistance / ACTIVE_WINDOW, 0, 1)
    const eased = active * active * (3 - 2 * active) // smoothstep

    // The 3D timeline stays hidden behind the hero and fades in exactly as the
    // hero text fades out (see Intro.tsx, which uses the same HERO_FADE_END
    // window) so the two never visually double-expose on top of each other.
    const heroReveal = THREE.MathUtils.smoothstep(smoothProgress, 0, HERO_FADE_END)

    const scale = THREE.MathUtils.lerp(0.55, 1.4, eased)
    const opacity = THREE.MathUtils.lerp(0.35, 1, eased) * heroReveal
    const popOut = THREE.MathUtils.lerp(0, 0.9, eased)

    if (groupRef.current) {
      groupRef.current.scale.setScalar(scale)
      groupRef.current.position.copy(position).addScaledVector(frame.tangent, -popOut)
    }

    if (fretRef.current) {
      const mat = fretRef.current.material as MeshStandardMaterial
      mat.opacity = opacity
      _tmpColor.copy(DIM_COLOR).lerp(ACTIVE_COLOR, eased)
      mat.color.copy(_tmpColor)
      mat.emissive.copy(_tmpColor)
      mat.emissiveIntensity = eased * 1.4
    }

    if (dotRef.current) {
      const mat = dotRef.current.material as MeshStandardMaterial
      mat.opacity = opacity
      mat.emissiveIntensity = eased * 2.2
    }

    if (textRef.current) {
      textRef.current.fillOpacity = opacity
    }
  })

  return (
    <group ref={groupRef} position={position}>
      <mesh ref={fretRef} quaternion={fretQuaternion}>
        <cylinderGeometry args={[0.022, 0.022, FRET_WIDTH, 8]} />
        <meshStandardMaterial
          color={DIM_COLOR}
          emissive={DIM_COLOR}
          transparent
          opacity={0.2}
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>

      <mesh ref={dotRef} position={[0, 0, 0]}>
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color={ACTIVE_COLOR} emissive={ACTIVE_COLOR} transparent opacity={0.2} />
      </mesh>

      <Text
        ref={textRef}
        position={labelOffset}
        fontSize={0.42}
        color="#f5f1e8"
        anchorX="center"
        anchorY="middle"
        fillOpacity={0.16}
      >
        {year}
      </Text>
    </group>
  )
}
