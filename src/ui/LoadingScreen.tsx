import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { gsap } from '../animation/gsap'

export function LoadingScreen() {
  // `progress` only advances when something is actually queued on THREE's
  // DefaultLoadingManager (textures, GLTFs, ...). Phase 1 has no such assets,
  // so it would sit at 0 forever — `active` is what actually tells us whether
  // anything is in flight right now.
  const { active, progress } = useProgress()
  const [hidden, setHidden] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (active) return
    const timer = setTimeout(() => {
      if (!ref.current) {
        setHidden(true)
        return
      }
      gsap.to(ref.current, {
        opacity: 0,
        duration: 0.7,
        ease: 'power2.out',
        onComplete: () => setHidden(true),
      })
    }, 350)
    return () => clearTimeout(timer)
  }, [active])

  if (hidden) return null

  const displayProgress = active ? progress : 100

  return (
    <div ref={ref} className="loading-screen" role="status" aria-live="polite">
      <div className="loading-screen__mark">G4U</div>
      <div className="loading-screen__bar">
        <div className="loading-screen__bar-fill" style={{ width: `${displayProgress}%` }} />
      </div>
      <span className="visually-hidden">Loading experience, {Math.round(displayProgress)}%</span>
    </div>
  )
}
