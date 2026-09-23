import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getNeckFrame, useJourneyPath, type JourneyPath } from './guitarPath'
import { isMobileViewport, prefersReducedMotion } from '../utils/device'

/**
 * A dark exhibition room around the strings: a warm near-black backdrop, a few specks of dust
 * and one or two soft highlights on the path. Nothing else — no rings, frames or bokeh. Depth
 * comes from the memory cards' opacity and scale, not from decoration.
 */

const UP = new THREE.Vector3(0, 1, 0)
const MOBILE = isMobileViewport()
const REDUCED = prefersReducedMotion()
const DENSITY = MOBILE ? 0.6 : 1

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A point on the path plus a stable right/up frame (right stays horizontal, like the camera's). */
function basisAt(path: JourneyPath, slot: number) {
  const t = THREE.MathUtils.clamp(slot / path.slotsLength, 0, 1)
  const f = getNeckFrame(t, path)
  const right = new THREE.Vector3().crossVectors(f.tangent, UP).normalize()
  const up = new THREE.Vector3().crossVectors(right, f.tangent).normalize()
  return { point: f.point, tangent: f.tangent, right, up }
}

/* ------------------------------------------------------------------ backdrop */

const BACKDROP_VERT = /* glsl */ `
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
// Screen-space, like a fixed CSS backdrop: near-black #050507 with two faint warm pools and a vignette.
const BACKDROP_FRAG = /* glsl */ `
  uniform vec2 uRes;
  void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    vec3 col = vec3(0.0196, 0.0196, 0.0275);
    // rgba(120,90,40,.08) at 65% 35% (from the top), rgba(80,60,30,.05) at 15% 80%
    col += vec3(0.4706, 0.3529, 0.1569) * 0.08 * (1.0 - smoothstep(0.0, 0.40, length((uv - vec2(0.65, 0.65)) * vec2(1.0, 1.0))));
    col += vec3(0.3137, 0.2353, 0.1176) * 0.05 * (1.0 - smoothstep(0.0, 0.45, length((uv - vec2(0.15, 0.20)) * vec2(1.0, 1.0))));
    // edges darker than the centre
    col *= 1.0 - 0.55 * smoothstep(0.42, 1.05, length((uv - 0.5) * vec2(1.15, 1.0)));
    col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
    gl_FragColor = vec4(col, 1.0);
  }
`

function Backdrop() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uRes: { value: new THREE.Vector2(1, 1) } },
        vertexShader: BACKDROP_VERT,
        fragmentShader: BACKDROP_FRAG,
        side: THREE.BackSide,
        depthTest: false,
        depthWrite: false,
        fog: false,
      }),
    [],
  )
  useEffect(() => () => material.dispose(), [material])

  const dome = useRef<THREE.Mesh>(null)
  useFrame(({ camera, gl }) => {
    gl.getDrawingBufferSize(material.uniforms.uRes.value)
    dome.current?.position.copy(camera.position)
  })

  return (
    <mesh ref={dome} renderOrder={-100} frustumCulled={false}>
      <sphereGeometry args={[200, 16, 12]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

/* ------------------------------------------------------------------ points */

const POINT_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uScale;
  uniform float uDrift;
  uniform float uMaxSize;
  uniform float uFar;
  attribute float aSeed;
  attribute float aSize;
  varying float vAlpha;
  varying float vSeed;
  void main() {
    vec3 p = position;
    p += vec3(sin(uTime * 0.12 + aSeed * 6.28), cos(uTime * 0.10 + aSeed * 12.5), sin(uTime * 0.08 + aSeed * 3.1)) * uDrift;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = max(-mv.z, 0.001);
    gl_PointSize = clamp(aSize * uScale / dist, 1.0, uMaxSize);
    vAlpha = smoothstep(2.0, 5.0, dist) * (1.0 - smoothstep(uFar * 0.5, uFar, dist));
    vSeed = aSeed;
    gl_Position = projectionMatrix * mv;
  }
`
const POINT_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uSoft;
  varying float vAlpha;
  varying float vSeed;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = 1.0 - smoothstep(uSoft, 1.0, d);
    float breathe = 0.7 + 0.3 * sin(uTime * (0.35 + vSeed * 0.8) + vSeed * 40.0);
    gl_FragColor = vec4(uColor, a * vAlpha * uOpacity * breathe);
  }
`

interface PointsProps {
  /** Builds the point positions; called whenever the path changes. */
  place: (path: JourneyPath, rand: () => number) => THREE.Vector3[]
  seed: number
  size: [number, number]
  color: string
  soft: number
  opacity: number
  drift: number
  maxSize: number
  fadeFar: number
}

function SoftPoints({ place, seed, size, color, soft, opacity, drift, maxSize, fadeFar }: PointsProps) {
  const path = useJourneyPath()

  const geometry = useMemo(() => {
    const rand = rng(seed)
    const points = place(path, rand)
    const positions = new Float32Array(points.length * 3)
    const seeds = new Float32Array(points.length)
    const sizes = new Float32Array(points.length)
    points.forEach((p, i) => {
      positions.set([p.x, p.y, p.z], i * 3)
      seeds[i] = rand()
      sizes[i] = size[0] + (size[1] - size[0]) * rand()
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    g.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    return g
    // The layout depends on the path only; the other props are fixed per instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uScale: { value: 1000 },
          uDrift: { value: REDUCED ? 0 : drift },
          uMaxSize: { value: maxSize },
          uFar: { value: fadeFar },
          uColor: { value: new THREE.Color(color) },
          uOpacity: { value: opacity },
          uSoft: { value: soft },
        },
        vertexShader: POINT_VERT,
        fragmentShader: POINT_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])

  useFrame(({ clock, camera, gl }) => {
    material.uniforms.uTime.value = clock.elapsedTime
    const fov = (camera as THREE.PerspectiveCamera).fov ?? 50
    // Pixels per world unit at distance 1, so `size` is a true world-space diameter.
    material.uniforms.uScale.value = gl.domElement.height / (2 * Math.tan((fov * Math.PI) / 360))
  })

  return <points geometry={geometry} material={material} frustumCulled={false} />
}

/**
 * Sparse dust: roughly 15–25 specks are ever in view. Pushed toward the lower-left of the frame,
 * where the path comes from, and barely visible.
 */
function Dust() {
  return (
    <SoftPoints
      seed={11}
      size={[0.035, 0.075]}
      color="#d8c8a0"
      soft={0.35}
      opacity={0.4}
      drift={0.22}
      maxSize={9}
      fadeFar={22}
      place={(path, rand) => {
        const count = Math.max(10, Math.round(Math.min(path.slotsLength * 7, 140) * DENSITY))
        return Array.from({ length: count }, () => {
          const b = basisAt(path, rand() * path.slotsLength)
          const angle = rand() * Math.PI * 2
          const r = 0.8 + rand() * 4.2
          return b.point
            .clone()
            .addScaledVector(b.right, Math.cos(angle) * r - 1.6)
            .addScaledVector(b.up, Math.sin(angle) * r - 1.2)
            .addScaledVector(b.tangent, (rand() - 0.5) * 2)
        })
      }}
    />
  )
}

/** One or two soft warm highlights on the strings — like light catching the path. */
function PathHighlights() {
  return (
    <SoftPoints
      seed={5}
      size={[0.5, 0.7]}
      color="#c4a468"
      soft={0.0}
      opacity={0.16}
      drift={0}
      maxSize={70}
      fadeFar={26}
      place={(path) => {
        const slots: number[] = []
        for (let s = 2.4; s < path.slotsLength; s += 6.5) slots.push(s)
        return slots.map((s) => {
          const b = basisAt(path, s)
          return b.point.clone().addScaledVector(b.up, 0.05)
        })
      }}
    />
  )
}

export function Atmosphere() {
  return (
    <>
      <Backdrop />
      <Dust />
      <PathHighlights />
    </>
  )
}
