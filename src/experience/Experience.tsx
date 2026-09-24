import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CameraRig } from './CameraRig'
import { GuitarTimeline } from './GuitarTimeline'
import { getTimelineState, timelineStore } from '../timeline/TimelineController'
import { MemoryField } from './MemoryField'
import { Atmosphere } from './Atmosphere'
import { PathText } from './PathText'
import { prefersReducedMotion } from '../utils/device'

const TILT_STRENGTH = prefersReducedMotion() ? 0 : 3.2

/** While the cover is up (progress still at the very start) nothing in the 3D scene is visible, so the
 * canvas stops rendering and leaves the GPU to the cover's own animation. It resumes on the first scroll. */
const AT_REST = 0.0005
const WARM_FRAMES = 120

function CoverGate() {
  const setFrameloop = useThree((s) => s.setFrameloop)
  const warm = useRef(0)
  // setFrameloop restarts the clock, so it must only be called when the state actually changes.
  const paused = useRef(false)
  const apply = (pause: boolean) => {
    if (paused.current === pause) return
    paused.current = pause
    setFrameloop(pause ? 'never' : 'always')
  }

  // Let shaders compile and textures upload before pausing.
  useFrame(() => {
    warm.current++
    if (warm.current === WARM_FRAMES && getTimelineState().smoothProgress < AT_REST) apply(true)
  })

  useEffect(
    () =>
      timelineStore.subscribe((state) => {
        if (warm.current < WARM_FRAMES) return
        apply(state.smoothProgress < AT_REST)
      }),
    // apply only touches refs and the stable setFrameloop
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setFrameloop],
  )
  return null
}

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
      <color attach="background" args={['#050507']} />
      <fog attach="fog" args={['#050507', 4, 28]} />

      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 6]} intensity={0.6} color="#f2c879" />
      <pointLight position={[0, 0, 4]} intensity={0.5} color="#f5f1e8" distance={12} decay={2} />

      <CoverGate />
      <Atmosphere />

      <group ref={timelineGroup}>
        <GuitarTimeline />
        {/* A welcome written along the strings, on the stretch of open neck before the first year. */}
        <PathText text="WELCOME TO THE G4U JOURNEY" fromSlot={0.16} />
        <MemoryField />
      </group>

      <CameraRig />
    </>
  )
}
