import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line, Text } from '@react-three/drei'
import * as THREE from 'three'
import { getNeckFrame, NECK_WIDTH, SURFACE_LIFT, useJourneyPath } from './guitarPath'
import { getTimelineState } from '../timeline/TimelineController'
import { getHeroFadeEnd, tToSlot } from '../timeline/journey'
import { useExperienceStore } from '../store/experienceStore'
import { youtubeThumbnail } from '../lib/youtube'
import { signPaths } from '../lib/supabaseStorage'
import { prefersReducedMotion } from '../utils/device'
import { firstVisual, memoryExcerpt, voiceNotes } from '../memories/memoryFormat'
import { fetchComments, fetchLikeState, setLiked, type LikeState, type MemoryComment } from '../lib/g4uMemories'
import type { G4UMemory, G4UMemoryMedia } from '../types/g4u-memory'

const CARD_WIDTH = 2.7
/** Gap between the neck's edge and the card's nearest edge. */
const SIDE_GAP = 1.15
/** Floats the card's bottom edge above the strings, low enough to stay in view when the camera arrives. */
const RAISE = 0.7

/** Only memories close to the camera are mounted (and hold a texture). */
const SLOTS_BEHIND = 0.8
const SLOTS_AHEAD = 2.8

// Palette
const GOLD = '#C4A468'
const IVORY = '#E8E2D6'
const MUTED = '#81796B'

/** Depth by opacity and scale, not geometry: the nearest memory reads fullest, the rest recede. */
const NEAR_OPACITY = 0.85
const FAR_OPACITY = 0.2
const NEAR_SCALE = 1
const FAR_SCALE = 0.85

const REDUCED = prefersReducedMotion()
const _up = new THREE.Vector3(0, 1, 0)

/** Small stable pseudo-random in [-1, 1] from a string, so a memory always lands in the same place. */
function jitter(id: string, salt: number): number {
  let h = 2166136261 ^ salt
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) % 2000) / 1000 - 1
}

function coverFor(memory: G4UMemory): string | undefined {
  if (memory.coverUrl) return memory.coverUrl
  const first = firstVisual(memory)
  if (first?.mediaType === 'video' && first.externalId) return youtubeThumbnail(first.externalId)
  return undefined
}

/** A soft dark falloff used as a drop shadow under each photo. Built once, shared by every card. */
let shadowTexture: THREE.CanvasTexture | null = null
function getShadowTexture() {
  if (shadowTexture) return shadowTexture
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(0,0,0,0.85)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  shadowTexture = new THREE.CanvasTexture(canvas)
  return shadowTexture
}

/** The G4U mark used as the like button's icon — one texture, shared by every card. */
let likeIconTexture: THREE.Texture | null = null
let likeIconPromise: Promise<THREE.Texture> | null = null
function useLikeIconTexture(): THREE.Texture | null {
  const [tex, setTex] = useState(likeIconTexture)
  useEffect(() => {
    if (tex) return
    likeIconPromise ??= new Promise((resolve, reject) => {
      new THREE.TextureLoader().load(
        '/favicon-64.png',
        (t) => {
          t.colorSpace = THREE.SRGBColorSpace
          likeIconTexture = t
          resolve(t)
        },
        undefined,
        reject,
      )
    })
    let cancelled = false
    likeIconPromise.then((t) => !cancelled && setTex(t)).catch((err) => console.warn('[g4u] like icon failed to load', err))
    return () => {
      cancelled = true
    }
  }, [tex])
  return tex
}

/** Like count + whether this session already liked it, fetched once a card is close enough to matter. */
function useLikeState(memoryId: string, enabled: boolean) {
  // Starts at a real value (not null) so the button is clickable — and shows "0" rather than
  // nothing — from the very first frame, even before the count has loaded or if it never does
  // (e.g. the likes table not migrated yet). A click still attempts to save; only the outcome
  // is uncertain.
  const [state, setState] = useState<LikeState>({ count: 0, likedByMe: false })
  const touched = useRef(false)
  const busy = useRef(false)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    fetchLikeState(memoryId)
      .then((s) => !cancelled && !touched.current && setState(s))
      .catch((err) => console.warn('[g4u] could not load like state', err))
    return () => {
      cancelled = true
    }
  }, [memoryId, enabled])

  const toggle = useCallback(() => {
    if (busy.current) return
    touched.current = true
    busy.current = true
    setState((current) => {
      const wasLiked = current.likedByMe
      void setLiked(memoryId, !wasLiked)
        .catch((err) => {
          console.warn('[g4u] like failed', err)
          setState((s) => ({ count: s.count + (wasLiked ? 1 : -1), likedByMe: wasLiked }))
        })
        .finally(() => {
          busy.current = false
        })
      return { count: current.count + (wasLiked ? -1 : 1), likedByMe: !wasLiked }
    })
  }, [memoryId])

  return { state, toggle }
}

/** Loads a texture only while `enabled`, and disposes it as soon as it is not needed. */
function useCoverTexture(url: string | undefined, enabled: boolean) {
  const [state, setState] = useState<{ url: string; texture: THREE.Texture; aspect: number } | null>(null)

  useEffect(() => {
    if (!enabled || !url) return
    let cancelled = false
    let loaded: THREE.Texture | null = null
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(
      url,
      (texture) => {
        if (cancelled) {
          texture.dispose()
          return
        }
        texture.colorSpace = THREE.SRGBColorSpace
        texture.needsUpdate = true
        loaded = texture
        const image = texture.image as { width: number; height: number }
        setState({ url, texture, aspect: image.width / image.height })
      },
      undefined,
      (err) => {
        console.warn('[g4u] memory cover failed to load', url, err)
      },
    )
    return () => {
      cancelled = true
      loaded?.dispose()
    }
  }, [url, enabled])

  return enabled && state?.url === url ? state : null
}

const ALBUM_ADVANCE_MS = 5000

/** An album's cover cycles through its own photos, one every 5s, once its card is near. */
function useAlbumCover(images: G4UMemoryMedia[], enabled: boolean): string | undefined {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)
  const paths = useMemo(() => images.map((m) => m.thumbnailPath ?? m.storagePath).filter((p): p is string => !!p), [images])

  useEffect(() => {
    if (!enabled || paths.length < 2) return
    let cancelled = false
    signPaths(paths)
      .then((signed) => !cancelled && setUrls(signed))
      .catch((err) => console.warn('[g4u] could not load album photos', err))
    return () => {
      cancelled = true
    }
  }, [enabled, paths])

  useEffect(() => {
    if (!enabled || paths.length < 2) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % paths.length), ALBUM_ADVANCE_MS)
    return () => window.clearInterval(id)
  }, [enabled, paths.length])

  if (paths.length < 2) return undefined
  return urls[paths[index % paths.length]]
}

/** A memory's comments pop up beside the card, one every 5s, looping — same pace as the album. */
function useCardComments(memoryId: string, enabled: boolean): MemoryComment | null {
  const [comments, setComments] = useState<MemoryComment[]>([])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    fetchComments(memoryId)
      .then((rows) => !cancelled && setComments(rows))
      .catch((err) => console.warn('[g4u] could not load comments for the card', err))
    return () => {
      cancelled = true
    }
  }, [memoryId, enabled])

  useEffect(() => {
    if (!enabled || comments.length < 2) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % comments.length), ALBUM_ADVANCE_MS)
    return () => window.clearInterval(id)
  }, [enabled, comments.length])

  return enabled && comments.length > 0 ? comments[index % comments.length] : null
}

type PlaybackState = 'idle' | 'loading' | 'playing' | 'error'

/** Only one voice note plays at a time, wherever it is. */
let stopActivePlayback: (() => void) | null = null

/** Plays a memory's voice notes one after another, on demand. Nothing is fetched until the button is pressed. */
function useVoicePlayback(memory: G4UMemory) {
  const paths = useMemo(
    () => voiceNotes(memory).map((v) => v.storagePath).filter(Boolean) as string[],
    [memory],
  )
  const [state, setState] = useState<PlaybackState>('idle')
  const audio = useRef<HTMLAudioElement | null>(null)
  const token = useRef(0)

  const stop = useCallback(() => {
    token.current++
    audio.current?.pause()
    audio.current = null
    setState('idle')
  }, [])

  const playFrom = useCallback(
    async function play(index: number, mine: number) {
      try {
        const urls = await signPaths([paths[index]])
        if (mine !== token.current) return
        const el = new Audio(urls[paths[index]])
        audio.current = el
        el.onended = () => {
          if (mine !== token.current) return
          if (index + 1 < paths.length) void play(index + 1, mine)
          else {
            audio.current = null
            setState('idle')
          }
        }
        el.onerror = () => mine === token.current && setState('error')
        await el.play()
        if (mine === token.current) setState('playing')
      } catch (err) {
        console.warn('[g4u] could not play the voice note', err)
        if (mine === token.current) setState('error')
      }
    },
    [paths],
  )

  const toggle = useCallback(() => {
    if (paths.length === 0) return
    if (state === 'playing' || state === 'loading') {
      stop()
      return
    }
    stopActivePlayback?.()
    stopActivePlayback = stop
    const mine = ++token.current
    setState('loading')
    void playFrom(0, mine)
  }, [paths.length, playFrom, state, stop])

  // Leaving the page (or the card being unmounted) must silence it.
  useEffect(
    () => () => {
      token.current++
      audio.current?.pause()
      if (stopActivePlayback === stop) stopActivePlayback = null
    },
    [stop],
  )

  return { hasVoice: paths.length > 0, state, toggle, stop }
}

interface MemoryNodeProps {
  memory: G4UMemory
  /** Slot along the journey where this memory hangs. */
  slot: number
  /** -1 = left of the strings, 1 = right. */
  side: -1 | 1
}

/**
 * One memory, hung beside the strings. Only real memories are drawn: a photo card once its picture
 * has loaded (never an empty frame), or — for a memory with no picture — its words alone.
 */
export function MemoryNode({ memory, slot, side }: MemoryNodeProps) {
  const path = useJourneyPath()
  const openMemory = useExperienceStore((s) => s.openMemory)

  const [near, setNear] = useState(false)
  const [hovered, setHovered] = useState(false)

  const groupRef = useRef<THREE.Group>(null)
  const cardRef = useRef<THREE.Group>(null)
  const frameMat = useRef<THREE.MeshBasicMaterial>(null)
  const photoMat = useRef<THREE.MeshBasicMaterial>(null)
  const shadowMat = useRef<THREE.MeshBasicMaterial>(null)
  const leaderRef = useRef<{ material: THREE.Material & { opacity: number } } | null>(null)
  const textRefs = useRef<({ fillOpacity: number } | null)[]>([])
  const hoverScale = useRef(1)
  const appear = useRef(0)

  // A memory with several photos reads as a small stack, with a count badge in the corner —
  // and, once its card is near, its own cover cycles through those photos every 5s.
  const images = useMemo(() => memory.media.filter((m) => m.mediaType === 'image'), [memory.media])
  const photoCount = images.length
  const isAlbum = photoCount > 1
  const albumCover = useAlbumCover(images, near && isAlbum)
  const cover = albumCover ?? coverFor(memory)
  const isVideo = firstVisual(memory)?.mediaType === 'video'
  const voice = useVoicePlayback(memory)
  const hasVoice = voice.hasVoice
  const wantsPhoto = !!cover
  const [btnHover, setBtnHover] = useState(false)
  const btnDiscMat = useRef<THREE.MeshBasicMaterial>(null)
  const btnRingMat = useRef<THREE.MeshBasicMaterial>(null)
  const btnBars = useRef<THREE.MeshBasicMaterial>(null)
  const btnScale = useRef(1)
  const btnGroup = useRef<THREE.Group>(null)
  const tex = useCoverTexture(cover, near)
  // Locked to the first photo's shape once known, so later ones in the cycle never resize the
  // whole card (frame, shadow, badges, text) around them — only the picture itself changes.
  const frozenAspect = useRef<number | null>(null)
  if (tex && frozenAspect.current === null) frozenAspect.current = tex.aspect
  const stackMat1 = useRef<THREE.MeshBasicMaterial>(null)
  const stackMat2 = useRef<THREE.MeshBasicMaterial>(null)
  const badgeDiscMat = useRef<THREE.MeshBasicMaterial>(null)
  const badgeRingMat = useRef<THREE.MeshBasicMaterial>(null)
  const badgeText = useRef<{ fillOpacity: number } | null>(null)

  const like = useLikeState(memory.id, near)
  const likeIconTex = useLikeIconTexture()
  const [likeHover, setLikeHover] = useState(false)
  const likeGroup = useRef<THREE.Group>(null)
  const likeScale = useRef(1)
  const likeDiscMat = useRef<THREE.MeshBasicMaterial>(null)
  const likeRingMat = useRef<THREE.MeshBasicMaterial>(null)
  const likeIconMat = useRef<THREE.MeshBasicMaterial>(null)
  const likeCountText = useRef<{ fillOpacity: number } | null>(null)

  const comment = useCardComments(memory.id, near)
  const commentText = useRef<{ fillOpacity: number } | null>(null)

  const layout = useMemo(() => {
    const t = slot / path.slotsLength
    const frame = getNeckFrame(t, path)
    // Left/right must stay left/right on screen, so use a horizontal side vector rather than the
    // neck's twisting binormal.
    const right = new THREE.Vector3().crossVectors(frame.tangent, _up).normalize()
    const up = new THREE.Vector3().crossVectors(right, frame.tangent).normalize()

    const width = CARD_WIDTH * (0.9 + 0.2 * (jitter(memory.id, 1) * 0.5 + 0.5))
    const lateral = side * (NECK_WIDTH / 2 + SIDE_GAP + width / 2 + jitter(memory.id, 2) * 0.35)

    const position = frame.point.clone().addScaledVector(right, lateral)
    const anchor = frame.point.clone().addScaledVector(up, SURFACE_LIFT)

    // The card faces back toward the camera and turns a little toward the strings.
    const normal = frame.tangent.clone().multiplyScalar(-0.78).addScaledVector(right, -side * 0.5).normalize()
    const m = new THREE.Matrix4().lookAt(normal, new THREE.Vector3(), up)
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(m)
    quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), jitter(memory.id, 4) * 0.06))

    return { position, quaternion, width, leader: anchor.clone().sub(position), stem: up.clone().multiplyScalar(RAISE) }
  }, [memory.id, slot, side, path])

  const w = layout.width
  const h = wantsPhoto ? w / (frozenAspect.current ?? tex?.aspect ?? 4 / 3) : 1.2
  const rise = h / 2 + RAISE + (jitter(memory.id, 3) * 0.5 + 0.5) * 0.25

  const title = memory.title ?? ''
  const author = memory.author?.displayName ?? ''
  const quote = memoryExcerpt(memory, 140)
  const showWords = !wantsPhoto && (quote || author)

  useFrame(({ camera }) => {
    const group = groupRef.current
    if (!group) return
    const { smoothProgress, smoothPointer } = getTimelineState()
    const ahead = slot - tToSlot(smoothProgress)

    const inWindow = ahead > -SLOTS_BEHIND && ahead < SLOTS_AHEAD
    if (inWindow !== near) setNear(inWindow)
    if (!inWindow) return

    // Nearest reads fullest (~1 slot ahead); further along the path memories recede.
    const depth = THREE.MathUtils.smoothstep(Math.abs(ahead - 0.9), 0.3, 1.9)
    const baseOpacity = THREE.MathUtils.lerp(NEAR_OPACITY, FAR_OPACITY, depth)
    const baseScale = THREE.MathUtils.lerp(NEAR_SCALE, FAR_SCALE, depth)

    const reveal = THREE.MathUtils.smoothstep(smoothProgress, 0, getHeroFadeEnd())
    // Fade out as the camera is about to pass through the card.
    const passing = THREE.MathUtils.smoothstep(camera.position.distanceTo(layout.position), 1.6, 4.2)

    // A photo card only appears once its picture has arrived, and then eases in.
    const ready = wantsPhoto ? !!tex : true
    appear.current += ((ready ? 1 : 0) - appear.current) * 0.06
    const alpha = reveal * passing * baseOpacity * appear.current

    hoverScale.current += ((hovered ? 1.05 : 1) - hoverScale.current) * 0.15
    if (cardRef.current) {
      cardRef.current.scale.setScalar(baseScale * hoverScale.current)
      // A few pixels of drift with the pointer.
      const px = REDUCED ? 0 : smoothPointer.x
      const py = REDUCED ? 0 : smoothPointer.y
      cardRef.current.position.set(px * 0.05, rise + py * 0.06, 0)
    }

    if (btnGroup.current) {
      btnScale.current += ((btnHover ? 1.12 : 1) - btnScale.current) * 0.2
      btnGroup.current.scale.setScalar(btnScale.current)
    }
    // The listen button stays clearly readable while its memory is in view.
    const btnAlpha = Math.min(1, alpha * 1.15)
    if (btnDiscMat.current) btnDiscMat.current.opacity = btnAlpha * 0.85
    if (btnRingMat.current) btnRingMat.current.opacity = btnAlpha * 0.9
    if (btnBars.current) btnBars.current.opacity = btnAlpha

    if (frameMat.current) frameMat.current.opacity = alpha * 0.35
    if (photoMat.current) photoMat.current.opacity = alpha
    if (shadowMat.current) shadowMat.current.opacity = alpha * 0.55
    if (stackMat1.current) stackMat1.current.opacity = alpha * 0.3
    if (stackMat2.current) stackMat2.current.opacity = alpha * 0.22
    if (badgeDiscMat.current) badgeDiscMat.current.opacity = alpha * 0.85
    if (badgeRingMat.current) badgeRingMat.current.opacity = alpha * 0.9
    if (badgeText.current) badgeText.current.fillOpacity = alpha

    if (likeGroup.current) {
      likeScale.current += ((likeHover ? 1.12 : 1) - likeScale.current) * 0.2
      likeGroup.current.scale.setScalar(likeScale.current)
    }
    const likeAlpha = Math.min(1, alpha * 1.15)
    const liked = like.state.likedByMe
    if (likeDiscMat.current) likeDiscMat.current.opacity = likeAlpha * 0.85
    if (likeRingMat.current) likeRingMat.current.opacity = likeAlpha * (liked ? 1 : 0.9)
    if (likeIconMat.current) likeIconMat.current.opacity = likeAlpha * (liked ? 1 : 0.75)
    if (likeCountText.current) likeCountText.current.fillOpacity = likeAlpha
    if (commentText.current) commentText.current.fillOpacity = likeAlpha * 0.9

    if (leaderRef.current) leaderRef.current.material.opacity = reveal * passing * appear.current * 0.16
    // quote 0.9 · play mark 0.9 · title 0.75 · author 0.45
    const factors = [0.9, 0.9, 0.75, 0.45, 0.85, 0.7]
    textRefs.current.forEach((t, i) => {
      if (t) t.fillOpacity = (i >= 4 ? btnAlpha : alpha) * (factors[i] ?? 1)
    })
  })

  // A memory that drifts out of range stops talking.
  useEffect(() => {
    if (!near) voice.stop()
    // stop is stable per memory
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [near])

  useEffect(() => {
    document.body.style.cursor = hovered || btnHover || likeHover ? 'pointer' : ''
    return () => {
      document.body.style.cursor = ''
    }
  }, [hovered, btnHover, likeHover])

  if (!near) return <group ref={groupRef} position={layout.position} />

  const open = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    openMemory(memory.year, memory.id)
  }
  const over = (e: { stopPropagation: () => void }) => {
    e.stopPropagation()
    setHovered(true)
  }
  const out = () => setHovered(false)

  const authorLine = `— ${author}${hasVoice ? ' · có ghi âm' : ''}`

  return (
    <group ref={groupRef} position={layout.position}>
      {/* A hairline back to the strings, barely there */}
      {(wantsPhoto ? !!tex : !!showWords) && (
        <Line
          ref={(el) => {
            leaderRef.current = el as never
          }}
          points={[
            [layout.stem.x, layout.stem.y, layout.stem.z],
            [layout.leader.x, layout.leader.y, layout.leader.z],
          ]}
          color={GOLD}
          transparent
          opacity={0}
          lineWidth={0.6}
        />
      )}

      <group quaternion={layout.quaternion}>
        <group ref={cardRef} position={[0, rise, 0]}>
          {wantsPhoto && tex && (
            <>
              <mesh position={[0.07, -0.1, -0.03]}>
                <planeGeometry args={[w * 1.35, h * 1.45]} />
                <meshBasicMaterial ref={shadowMat} map={getShadowTexture()} color="#000000" transparent opacity={0} depthWrite={false} toneMapped={false} />
              </mesh>

              {/* A memory with several photos: two more edges peek out behind the top one, like a stack of prints. */}
              {isAlbum && (
                <>
                  <mesh position={[0.16, -0.18, -0.07]} rotation={[0, 0, -0.05]}>
                    <planeGeometry args={[w * 0.94, h * 0.94]} />
                    <meshBasicMaterial ref={stackMat2} color={GOLD} transparent opacity={0} toneMapped={false} />
                  </mesh>
                  <mesh position={[0.09, -0.1, -0.05]} rotation={[0, 0, 0.03]}>
                    <planeGeometry args={[w * 0.97, h * 0.97]} />
                    <meshBasicMaterial ref={stackMat1} color={GOLD} transparent opacity={0} toneMapped={false} />
                  </mesh>
                </>
              )}

              {/* Thin warm border, just outside the picture */}
              <mesh position={[0, 0, -0.01]} onClick={open} onPointerOver={over} onPointerOut={out}>
                <planeGeometry args={[w + 0.05, h + 0.05]} />
                <meshBasicMaterial ref={frameMat} color={GOLD} transparent opacity={0} toneMapped={false} />
              </mesh>

              <mesh onClick={open} onPointerOver={over} onPointerOut={out}>
                <planeGeometry args={[w, h]} />
                <meshBasicMaterial key="photo" ref={photoMat} map={tex.texture} color="#ffffff" transparent opacity={0} toneMapped={false} />
              </mesh>

              {isAlbum && (
                <group position={[w / 2 - 0.32, h / 2 - 0.32, 0.06]} onClick={open} onPointerOver={over} onPointerOut={out}>
                  <mesh>
                    <circleGeometry args={[0.26, 32]} />
                    <meshBasicMaterial ref={badgeDiscMat} color="#0b0805" transparent opacity={0} depthWrite={false} toneMapped={false} />
                  </mesh>
                  <mesh position={[0, 0, 0.005]}>
                    <ringGeometry args={[0.245, 0.265, 32]} />
                    <meshBasicMaterial ref={badgeRingMat} color={GOLD} transparent opacity={0} depthWrite={false} toneMapped={false} />
                  </mesh>
                  <Text
                    ref={(el: never) => {
                      badgeText.current = el
                    }}
                    position={[0, 0, 0.01]}
                    fontSize={0.19}
                    color={IVORY}
                    anchorX="center"
                    anchorY="middle"
                    fillOpacity={0}
                  >
                    {photoCount}
                  </Text>
                </group>
              )}

              {/* A quick like, below the photo (not on it) — on the picture itself, its own click
                  to open the memory always won the hit-test over this smaller button underneath. */}
              <group
                ref={likeGroup}
                position={[-(w / 2 - 0.3), -h / 2 - 0.85, 0.02]}
                onClick={(e) => {
                  e.stopPropagation()
                  like.toggle()
                }}
                onPointerOver={(e) => {
                  e.stopPropagation()
                  setLikeHover(true)
                }}
                onPointerOut={() => setLikeHover(false)}
              >
                <mesh>
                  <circleGeometry args={[0.3, 40]} />
                  <meshBasicMaterial ref={likeDiscMat} color="#0b0805" transparent opacity={0} depthWrite={false} toneMapped={false} />
                </mesh>
                <mesh position={[0, 0, 0.005]}>
                  <ringGeometry args={[0.285, 0.31, 40]} />
                  <meshBasicMaterial ref={likeRingMat} color={GOLD} transparent opacity={0} depthWrite={false} toneMapped={false} />
                </mesh>
                {likeIconTex && (
                  <mesh position={[0, 0.03, 0.01]} scale={0.32}>
                    <planeGeometry args={[1, 1]} />
                    <meshBasicMaterial
                      ref={likeIconMat}
                      map={likeIconTex}
                      transparent
                      opacity={0}
                      depthWrite={false}
                      toneMapped={false}
                    />
                  </mesh>
                )}
                <Text
                  ref={(el: never) => {
                    likeCountText.current = el
                  }}
                  position={[0, -0.5, 0.01]}
                  fontSize={0.12}
                  color={GOLD}
                  anchorX="center"
                  anchorY="middle"
                  fillOpacity={0}
                >
                  {like.state.count}
                </Text>
              </group>

              {/* A comment pops up beside the like button, one every 5s, looping through them all. */}
              {comment && (
                <Text
                  ref={(el: never) => {
                    commentText.current = el
                  }}
                  position={[-(w / 2 - 0.3) + 0.68, -h / 2 - 0.85, 0.02]}
                  fontSize={0.11}
                  lineHeight={1.3}
                  maxWidth={w - 1.1}
                  color={IVORY}
                  anchorX="left"
                  anchorY="middle"
                  fillOpacity={0}
                >
                  {`“${comment.content.length > 90 ? `${comment.content.slice(0, 90).trimEnd()}…` : comment.content}”`}
                </Text>
              )}

              {isVideo && (
                <Text
                  ref={(el: never) => {
                    textRefs.current[1] = el
                  }}
                  position={[0, 0, 0.03]}
                  fontSize={0.5}
                  color="#f5ecd4"
                  anchorX="center"
                  anchorY="middle"
                  fillOpacity={0}
                >
                  ▶
                </Text>
              )}

              {title && (
                <Text
                  ref={(el: never) => {
                    textRefs.current[2] = el
                  }}
                  position={[0, -h / 2 - 0.15, 0.02]}
                  maxWidth={w}
                  fontSize={0.14}
                  color={IVORY}
                  anchorX="center"
                  anchorY="top"
                  textAlign="center"
                  fillOpacity={0}
                >
                  {title}
                </Text>
              )}
              {author && (
                <Text
                  ref={(el: never) => {
                    textRefs.current[3] = el
                  }}
                  position={[0, -h / 2 - (title ? 0.45 : 0.15), 0.02]}
                  fontSize={0.1}
                  color={MUTED}
                  anchorX="center"
                  anchorY="top"
                  fillOpacity={0}
                >
                  {authorLine}
                </Text>
              )}
            </>
          )}

          {/* Listen: a round button, so a recording is one click away */}
          {hasVoice && (wantsPhoto ? !!tex : true) && (
            <group
              ref={btnGroup}
              position={wantsPhoto ? [w / 2 - 0.38, -h / 2 + 0.38, 0.06] : [0, showWords && quote ? -1.05 : -0.2, 0.04]}
              onClick={(e) => {
                e.stopPropagation()
                voice.toggle()
              }}
              onPointerOver={(e) => {
                e.stopPropagation()
                setBtnHover(true)
              }}
              onPointerOut={() => setBtnHover(false)}
            >
              <mesh>
                <circleGeometry args={[0.3, 40]} />
                <meshBasicMaterial ref={btnDiscMat} color="#0b0805" transparent opacity={0} depthWrite={false} toneMapped={false} />
              </mesh>
              <mesh position={[0, 0, 0.005]}>
                <ringGeometry args={[0.285, 0.31, 40]} />
                <meshBasicMaterial ref={btnRingMat} color={GOLD} transparent opacity={0} depthWrite={false} toneMapped={false} />
              </mesh>
              {voice.state === 'playing' ? (
                <>
                  <mesh position={[-0.07, 0, 0.01]}>
                    <planeGeometry args={[0.07, 0.24]} />
                    <meshBasicMaterial ref={btnBars} color={IVORY} transparent opacity={0} toneMapped={false} />
                  </mesh>
                  <mesh position={[0.07, 0, 0.01]}>
                    <planeGeometry args={[0.07, 0.24]} />
                    <meshBasicMaterial color={IVORY} transparent opacity={0.9} toneMapped={false} />
                  </mesh>
                </>
              ) : (
                <Text
                  ref={(el: never) => {
                    textRefs.current[4] = el
                  }}
                  position={[0.03, 0, 0.01]}
                  fontSize={0.26}
                  color={IVORY}
                  anchorX="center"
                  anchorY="middle"
                  fillOpacity={0}
                >
                  {voice.state === 'loading' ? '…' : voice.state === 'error' ? '!' : '▶'}
                </Text>
              )}
              <Text
                ref={(el: never) => {
                  textRefs.current[5] = el
                }}
                position={[0, -0.5, 0.01]}
                fontSize={0.09}
                letterSpacing={0.18}
                color={GOLD}
                anchorX="center"
                anchorY="middle"
                fillOpacity={0}
              >
                {voice.state === 'playing' ? 'ĐANG NGHE' : voice.state === 'error' ? 'KHÔNG PHÁT ĐƯỢC' : 'NGHE GHI ÂM'}
              </Text>
            </group>
          )}

          {/* A memory with no picture: its words only, no frame */}
          {showWords && (
            <>
              {quote && (
                <Text
                  ref={(el: never) => {
                    textRefs.current[0] = el
                  }}
                  maxWidth={w - 0.2}
                  fontSize={0.16}
                  lineHeight={1.5}
                  color={IVORY}
                  anchorX="center"
                  anchorY="middle"
                  textAlign="center"
                  fillOpacity={0}
                >
                  {`“${quote}”`}
                </Text>
              )}
              {author && (
                <Text
                  ref={(el: never) => {
                    textRefs.current[3] = el
                  }}
                  position={[0, quote ? -0.55 : 0, 0.02]}
                  fontSize={0.1}
                  color={MUTED}
                  anchorX="center"
                  anchorY="top"
                  fillOpacity={0}
                >
                  {authorLine}
                </Text>
              )}
            </>
          )}
        </group>
      </group>
    </group>
  )
}
