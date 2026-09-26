import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getJourneyPath } from './guitarPath'
import { getTimelineState } from '../timeline/TimelineController'
import { prefersReducedMotion } from '../utils/device'
import { getLayout } from '../timeline/journey'

const PULL_BACK = 1.7
const BASE_FOV = 50
// A portrait phone has a very narrow horizontal view, which hides memories hung on the far side of
// the strings. Below this horizontal angle the vertical fov is opened up to keep both sides in frame.
const MIN_HORIZONTAL_FOV = THREE.MathUtils.degToRad(60)
const MAX_FOV = 96
// A small forward lean in years, not a fixed distance — at rest (t=0) this
// must stay well inside year 2011's own active window, otherwise the camera
// centers on 2012's node before the user has scrolled anywhere.
const LOOK_AHEAD_YEARS = 0.25
const PARALLAX_STRENGTH = 0.12 // the path stays essentially still under the pointer
// Dragging with the mouse turns the camera's head — a real look-around, not just the small
// positional drift above. Yaw is the wider of the two, like turning to look down the strings;
// pitch stays modest so the neck never tips out of frame.
const LOOK_YAW = THREE.MathUtils.degToRad(30)
const LOOK_PITCH = THREE.MathUtils.degToRad(16)
/** A constant tilt upward from dead-ahead, so the resting view reads a little less flat. */
const BASE_TILT_UP = THREE.MathUtils.degToRad(7)
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
const _lookDir = new THREE.Vector3()
const _lookAt = new THREE.Vector3()
const _yawQuat = new THREE.Quaternion()
const _pitchQuat = new THREE.Quaternion()

export function CameraRig() {
  const currentRoll = useRef(0)

  useFrame(({ camera, size }) => {
    const cam = camera as THREE.PerspectiveCamera
    const aspect = size.width / size.height
    const wanted = Math.min(
      MAX_FOV,
      Math.max(BASE_FOV, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(MIN_HORIZONTAL_FOV / 2) / aspect))),
    )
    if (Math.abs(cam.fov - wanted) > 0.01) {
      cam.fov = wanted
      cam.updateProjectionMatrix()
    }
    const { smoothProgress, velocity, smoothPointer, smoothLookOffset } = getTimelineState()
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

    // Turn the head: rotate the look direction around the path's own up/right, rather than just
    // sliding the target sideways, so it reads as a genuine look-around instead of a slight drift.
    _lookDir.subVectors(_lookTarget, camera.position)
    _yawQuat.setFromAxisAngle(_up, smoothLookOffset.x * LOOK_YAW)
    _pitchQuat.setFromAxisAngle(_right, smoothLookOffset.y * LOOK_PITCH + BASE_TILT_UP)
    _lookDir.applyQuaternion(_yawQuat).applyQuaternion(_pitchQuat)
    _lookAt.addVectors(camera.position, _lookDir)
    camera.lookAt(_lookAt)

    const targetRoll = THREE.MathUtils.clamp(velocity * -ROLL_STRENGTH, -0.16, 0.16)
    currentRoll.current = THREE.MathUtils.lerp(currentRoll.current, targetRoll, ROLL_DAMPING)
    camera.rotation.z += currentRoll.current
  })

  return null
}
