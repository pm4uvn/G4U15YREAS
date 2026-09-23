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
import { YearMemoryLayer } from './memories/YearMemoryLayer'
import { initTimelineController } from './timeline/TimelineController'
import { useExperienceStore } from './store/experienceStore'
import { refreshJourneyCounts, useJourneyLayout } from './timeline/journey'
import { checkWebglSupport, getAdaptiveDpr } from './utils/device'

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
          gl={{ antialias: true, powerPreference: 'high-performance' }}
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
        <SoundToggle />
      </div>
      <Suspense fallback={null}>
        {memoryOpen && <MemoryDetailModal />}
        {addOpen && <AddMemoryModal />}
      </Suspense>
    </>
  )
}
