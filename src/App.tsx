import { lazy, Suspense, useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei'
import { Experience } from './experience/Experience'
import { LoadingScreen } from './ui/LoadingScreen'
import { Intro } from './ui/Intro'
import { Navigation } from './ui/Navigation'
import { YearIndicator } from './ui/YearIndicator'
import { SoundToggle } from './ui/SoundToggle'
import { FallbackTimeline } from './ui/FallbackTimeline'
import { MessageTicker } from './ui/MessageTicker'
import { YearMemoryLayer } from './memories/YearMemoryLayer'
import { initTimelineController } from './timeline/TimelineController'
import { useExperienceStore } from './store/experienceStore'
import { startAmbient } from './audio/ambientEngine'
import { refreshJourneyCounts, useJourneyLayout } from './timeline/journey'
import { checkWebglSupport, getAdaptiveDpr, isMobileViewport } from './utils/device'

const MemoryDetailModal = lazy(() => import('./memories/MemoryDetailModal'))
const AddMemoryModal = lazy(() => import('./memories/AddMemoryModal'))

export default function App() {
  const memoryOpen = useExperienceStore((s) => s.memoryView !== null)
  const addOpen = useExperienceStore((s) => s.addMemoryYear !== null)
  const layout = useJourneyLayout()
  const webglSupported = useExperienceStore((s) => s.webglSupported)
  const setWebglSupported = useExperienceStore((s) => s.setWebglSupported)
  const [dprRange] = useState(getAdaptiveDpr)

  useEffect(() => {
    setWebglSupported(checkWebglSupport())
  }, [setWebglSupported])

  // Measure how many memories each year holds so the strings can lengthen to fit them.
  useEffect(() => {
    void refreshJourneyCounts()
  }, [])

  useEffect(() => {
    if (!webglSupported) return
    const cleanup = initTimelineController()
    return cleanup
  }, [webglSupported])

  // Sound defaults on, but a browser only allows starting audio from within a real user
  // gesture — never automatically on page load. So instead of waiting specifically for the
  // "Enter the Journey" button, the very first interaction of any kind (a click, a key, the
  // first scroll or touch, anywhere on the page) starts it, which reads as "music plays as
  // soon as the site opens" for anyone who scrolls or taps right away.
  useEffect(() => {
    if (!webglSupported) return
    let started = false
    const start = () => {
      if (started || !useExperienceStore.getState().soundOn) return
      started = true
      startAmbient()
      events.forEach((ev) => window.removeEventListener(ev, start))
    }
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    events.forEach((ev) => window.addEventListener(ev, start, { passive: true, once: true }))
    return () => events.forEach((ev) => window.removeEventListener(ev, start))
  }, [webglSupported])

  if (!webglSupported) {
    return <FallbackTimeline />
  }

  return (
    <>
      <LoadingScreen />

      {/* Drives Lenis's scroll range — the 3D scene itself is a fixed overlay. */}
      <div className="scroll-spacer" style={{ height: `${(layout.slotsLength + 1) * 100}vh` }} aria-hidden="true" />

      <div className="canvas-layer">
        <Canvas
          dpr={dprRange}
          camera={{ fov: 50, near: 0.1, far: 400, position: [0, 0.35, 5.2] }}
          gl={{ antialias: !isMobileViewport(), powerPreference: 'high-performance' }}
        >
          <PerformanceMonitor>
            <AdaptiveDpr pixelated={false} />
            <Suspense fallback={null}>
              <Experience />
            </Suspense>
          </PerformanceMonitor>
        </Canvas>
      </div>

      <div className="ui-layer">
        <Intro />
        <Navigation />
        <YearIndicator />
        <YearMemoryLayer />
        <MessageTicker />
        <SoundToggle />
      </div>
      <Suspense fallback={null}>
        {memoryOpen && <MemoryDetailModal />}
        {addOpen && <AddMemoryModal />}
      </Suspense>
    </>
  )
}
