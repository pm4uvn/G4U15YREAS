import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CameraRig } from './CameraRig'
import { GuitarTimeline } from './GuitarTimeline'
import { getTimelineState } from '../timeline/TimelineController'
import { TOTAL_PATH_LENGTH } from './guitarPath'
import { prefersReducedMotion } from '../utils/device'

const TILT_STRENGTH = prefersReducedMotion() ? 0 : 3.2

export function Experience() {
  const timelineGroup = useRef<THREE.Group>(null)
  const tilt = useRef(0)

  useFrame(() => {
    if (!timelineGroup.current) return
    const { velocity } = getTimelineState()
    const targetTilt = THREE.MathUtils.clamp(velocity * -TILT_STRENGTH, -0.05, 0.05)
    tilt.current = THREE.MathUtils.lerp(tilt.current, targetTilt, 0.08)
    timelineGroup.current.rotation.z = tilt.current
  })

  return (
    <>
      <color attach="background" args={['#07070a']} />
      <fog attach="fog" args={['#07070a', 4, TOTAL_PATH_LENGTH * 0.16]} />

      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 6]} intensity={0.6} color="#f2c879" />
      <pointLight position={[0, 0, 4]} intensity={0.5} color="#f5f1e8" distance={12} decay={2} />

      <group ref={timelineGroup}>
        <GuitarTimeline />
      </group>

      <CameraRig />
    </>
  )
}
