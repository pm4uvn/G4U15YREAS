import { memo } from 'react'
import {
  EMBERS,
  SCENE_H,
  SCENE_W,
  STARS,
  STRING_OFFSETS,
  pointOnRoad,
  roadPath,
  roadSurface,
} from './heroLayout'

const SUN = pointOnRoad(0, 2)
const SURFACE = roadSurface()

/** Vector stand-in for hero-bg: night sky, sun, ridges and lake. No text, no UI. */
export const FallbackBackdrop = memo(function FallbackBackdrop() {
  return (
    <>
      <div className="hero-fallback-sky" />
      <svg className="hero-fill" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="sunGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff2c8" stopOpacity="1" />
            <stop offset="0.18" stopColor="#ffc46b" stopOpacity="0.85" />
            <stop offset="0.5" stopColor="#e2793a" stopOpacity="0.3" />
            <stop offset="1" stopColor="#e2793a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c86a3c" stopOpacity="0.55" />
            <stop offset="1" stopColor="#3a2030" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff4d8" opacity={s.o} />
        ))}
        <circle cx={SUN.x + 12} cy={SUN.y - 32} r={210} fill="url(#sunGlow)" />
        <circle cx={SUN.x + 12} cy={SUN.y - 32} r={17} fill="#fff6d6" />
        <path d="M 860 560 L 1010 515 L 1140 545 L 1260 495 L 1400 540 L 1520 470 L 1600 500 L 1600 900 L 860 900 Z" fill="#241326" />
        <path d="M 1120 610 Q 1350 585 1600 620 L 1600 690 Q 1350 668 1120 690 Z" fill="url(#lake)" />
        <path d="M 980 640 L 1160 590 L 1330 625 L 1480 560 L 1600 600 L 1600 900 L 980 900 Z" fill="#170c1b" />
        <path d="M 0 720 L 170 650 L 380 705 L 600 690 L 820 770 L 900 900 L 0 900 Z" fill="#0c070d" />
        <path d="M 1300 700 L 1440 655 L 1600 700 L 1600 900 L 1300 900 Z" fill="#0a060c" />
      </svg>
    </>
  )
})

/** Vector stand-in for hero-road: the string-road, transparent around it. */
export const FallbackRoad = memo(function FallbackRoad() {
  return (
    <svg className="hero-fill" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="road" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#120a06" />
          <stop offset="1" stopColor="#2a1608" />
        </linearGradient>
        <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <polygon points={SURFACE} fill="url(#road)" />
      {STRING_OFFSETS.map((d) => {
        const outer = Math.abs(d) === 2
        return (
          <g key={d}>
            <path d={roadPath(d)} fill="none" stroke="#f0b552" strokeWidth={outer ? 5 : 3} opacity="0.55" filter="url(#softGlow)" />
            <path d={roadPath(d)} fill="none" stroke={outer ? '#ffd989' : '#fff0c4'} strokeWidth={outer ? 2.2 : 1.3} strokeLinecap="round" />
          </g>
        )
      })}
    </svg>
  )
})

/** Vector stand-in for hero-particles: drifting embers. */
export const FallbackParticles = memo(function FallbackParticles() {
  return (
    <svg className="hero-fill" viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} preserveAspectRatio="xMidYMid slice">
      {EMBERS.map((e, i) => (
        <circle
          key={i}
          className="hero-ember"
          cx={e.x * 1.1}
          cy={e.y * 0.9 + 60}
          r={e.r}
          fill="#ffcf7a"
          opacity={e.o}
          style={{ animationDelay: `${e.delay}s` }}
        />
      ))}
    </svg>
  )
})
