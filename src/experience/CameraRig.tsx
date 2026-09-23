import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getJourneyPath } from './guitarPath'
import { getTimelineState } from '../timeline/TimelineController'
import { prefersReducedMotion } from '../utils/device'
import { getLayout } from '../timeline/journey'

const PULL_BACK = 1.7
// A small forward lean in years, not a fixed distance — at rest (t=0) this
// must stay well inside year 2011's own active window, otherwise the camera
// centers on 2012's node before the user has scrolled anywhere.
const LOOK_AHEAD_YEARS = 0.25
const PARALLAX_STRENGTH = 0.12 // the path stays essentially still under the pointer
const ROLL_STRENGTH = 6.5
const REDUCED_MOTION = prefersReducedMotion()
const CAMERA_DAMPING = REDUCED_MOTION ? 1 : 0.055
const ROLL_DAMPING = REDUCED_MOTION ? 1 : 0.08

const _point = new THREE.Vector3()
const _tangent = new THREE.Vector3()
const _lookTarget = new THREE.Vector3()
const _desiredPos = new THREE.Vector3()
const _right = new THREE.Vector3()
const _up = new THREE.Vector3()
const _worldUp = new THREE.Vector3(0, 1, 0)

export function CameraRig() {
  const currentRoll = useRef(0)

  useFrame(({ camera }) => {
    const { smoothProgress, velocity, smoothPointer } = getTimelineState()
    const t = THREE.MathUtils.clamp(smoothProgress, 0, 1)

    // The camera rides its own wider helix (see guitarPath.ts) so it always
    // stays clear of the solid guitar neck mesh, while looking toward the
    // neck itself — slightly ahead of the current scroll position — so it
    // reads as flying alongside the timeline rather than through it.
    const path = getJourneyPath()
    path.cameraCurve.getPointAt(t, _point)
    path.cameraCurve.getTangentAt(t, _tangent)

    const lookAheadT = THREE.MathUtils.clamp(t + LOOK_AHEAD_YEARS / getLayout().slotsLength, 0, 1)
    path.curve.getPointAt(lookAheadT, _lookTarget)

    _right.crossVectors(_tangent, _worldUp).normalize()
    _up.crossVectors(_right, _tangent).normalize()

    _desiredPos
      .copy(_point)
      .addScaledVector(_tangent, -PULL_BACK)
      .addScaledVector(_right, smoothPointer.x * PARALLAX_STRENGTH)
      .addScaledVector(_up, smoothPointer.y * PARALLAX_STRENGTH * 0.6)

    camera.position.lerp(_desiredPos, CAMERA_DAMPING)

    const lookAt = _lookTarget.clone().addScaledVector(_right, smoothPointer.x * PARALLAX_STRENGTH * 0.5)
    camera.lookAt(lookAt)

    const targetRoll = THREE.MathUtils.clamp(velocity * -ROLL_STRENGTH, -0.16, 0.16)
    currentRoll.current = THREE.MathUtils.lerp(currentRoll.current, targetRoll, ROLL_DAMPING)
    camera.rotation.z += currentRoll.current
  })

  return null
}
