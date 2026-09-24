import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { gsap } from '../animation/gsap'
import { timelineStore, scrollToYearIndex } from '../timeline/TimelineController'
import { getHeroFadeEnd } from '../timeline/journey'
import { YEARS } from '../timeline/timeline.data'
import { isCoarsePointer, prefersReducedMotion } from '../utils/device'
import { AssetImage } from './hero/AssetImage'
import { Guitar } from './hero/Guitar'
import { FallbackBackdrop, FallbackParticles, FallbackRoad } from './hero/HeroFallbacks'
import { HeroPhotos } from './hero/HeroPhotos'
import { HERO_ASSETS, HERO_MILESTONES, ROAD_END, heroSources, layerOverrideStyle } from './hero/heroAssets'
import { useHeroDebug } from './hero/useHeroDebug'
import { RoadMarkers } from './hero/RoadMarkers'
import './hero/hero.css'

// Debug tools exist only in development: with DEV false the dynamic imports are removed from the build.
const HeroDebugGrid = import.meta.env.DEV
  ? lazy(() => import('./hero/HeroDebug').then((m) => ({ default: m.HeroDebugGrid })))
  : null
const HeroDebugPanel = import.meta.env.DEV
  ? lazy(() => import('./hero/HeroDebug').then((m) => ({ default: m.HeroDebugPanel })))
  : null

/** One depth layer. The outer element takes parallax/scroll motion, the inner one the entry animation. */
function Layer({ name, depth = 0, children }: { name: string; depth?: number; children?: ReactNode }) {
  return (
    <div className={`hero-layer hero-layer--${name}`} style={{ ['--depth' as string]: depth }}>
      <div className="hero-layer__in">{children}</div>
    </div>
  )
}

export function Intro() {
  const rootRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef<HTMLDivElement>(null)
  const entered = useRef(false)
  const debug = useHeroDebug()

  // Scroll progress and pointer drive CSS variables directly — no React renders per frame.
  useEffect(() => {
    const motion = !prefersReducedMotion()
    const pointer = motion && !isCoarsePointer()
    let lastMx = 0
    let lastMy = 0

    const resetAfterTransition = () => {
      const root = rootRef.current
      if (!root || !zoomRef.current) return
      entered.current = false
      gsap.killTweensOf([zoomRef.current, ...root.querySelectorAll('.hero-enter')])
      gsap.set(root.querySelectorAll('.hero-enter'), { clearProps: 'opacity,transform,y,scale' })
      gsap.set(root.querySelector('.hero-layer--road'), { '--road-glow': 1 })
      gsap.set(zoomRef.current, { clearProps: 'transform' })
    }

    const unsubscribe = timelineStore.subscribe((state) => {
      const root = rootRef.current
      const content = contentRef.current
      if (!root || !content) return
      const t = Math.min(1, state.smoothProgress / getHeroFadeEnd())
      const opacity = 1 - t
      root.style.opacity = String(opacity)
      root.style.pointerEvents = opacity < 0.08 ? 'none' : 'auto'
      root.style.setProperty('--hp', t.toFixed(3))
      content.style.transform = `translateY(${t * -36}px) scale(${1 - t * 0.06})`

      if (pointer) {
        const { x, y } = state.smoothPointer
        if (Math.abs(x - lastMx) > 0.002 || Math.abs(y - lastMy) > 0.002) {
          lastMx = x
          lastMy = y
          root.style.setProperty('--mx', x.toFixed(3))
          root.style.setProperty('--my', y.toFixed(3))
        }
      }

      if (entered.current && t < 0.02) resetAfterTransition()
    })
    return unsubscribe
  }, [])

  // Opening sequence (times in seconds): bg 0.3 · road 0.7 · guitar 1.0 · photos 1.3 · logo 1.6 · range 1.9 · tagline 2.15 · CTA 2.4.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      const layer = (n: string) => `.hero-layer--${n} .hero-layer__in`
      gsap.set(
        [layer('bg'), layer('glow'), layer('road'), layer('guitar'), layer('photos'), layer('particles'), layer('markers'), '.hero-enter'],
        { opacity: 0 },
      )
      gsap.set('.hero-logo-wrap', { y: 16, scale: 0.98 })
      gsap.set([layer('guitar')], { y: 14 })
      gsap.set('.hero-enter:not(.hero-logo-wrap)', { y: 12 })

      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } })
      tl.to([layer('bg'), layer('glow')], { opacity: 1, duration: 1.4 }, 0.3)
        .fromTo('.hero-layer--road', { '--road-glow': 0.4 }, { '--road-glow': 1, duration: 1.6 }, 0.7)
        .to(layer('road'), { opacity: 1, duration: 1.2 }, 0.7)
        .to(layer('guitar'), { opacity: 1, y: 0, duration: 1.1 }, 1.0)
        .to([layer('photos'), layer('particles')], { opacity: 1, duration: 1.2 }, 1.3)
        .to('.hero-logo-wrap', { opacity: 1, y: 0, scale: 1, duration: 1 }, 1.6)
        .to('.hero__kicker', { opacity: 1, y: 0, duration: 0.9 }, 1.75)
        .to('.hero__range', { opacity: 1, y: 0, duration: 0.9 }, 1.9)
        .to('.hero__tagline', { opacity: 1, y: 0, duration: 0.9 }, 2.15)
        .to([layer('markers'), '.hero__cta', '.hero__milestones'], { opacity: 1, y: 0, duration: 0.9 }, 2.4)
    }, root)
    return () => ctx.revert()
  }, [])

  /** Cinematic hand-off: copy fades, logo settles back, the road brightens and the scene pushes toward it, then the year opens. */
  const enter = useCallback((yearIndex: number) => {
    const root = rootRef.current
    const zoom = zoomRef.current
    if (!root || !zoom || entered.current) return
    if (prefersReducedMotion()) {
      scrollToYearIndex(yearIndex)
      return
    }
    entered.current = true
    const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } })
    tl.to(root.querySelectorAll('.hero__range, .hero__tagline, .hero__cta, .hero__milestones, .hero__brand'), { opacity: 0, y: -10, duration: 0.5 }, 0)
      .to('.hero-logo-wrap', { scale: 0.94, opacity: 0, duration: 0.75 }, 0)
      .to(root.querySelector('.hero-layer--road'), { '--road-glow': 2.2, duration: 0.9 }, 0)
      .to(zoom, { scale: 1.16, transformOrigin: `${ROAD_END.x}% ${ROAD_END.y}%`, duration: 1.5 }, 0.05)
      .call(() => scrollToYearIndex(yearIndex), [], 0.7)
  }, [])

  return (
    <div ref={rootRef} className={`hero ${debug.className}`.trim()}>
      <div className="hero-backfill" aria-hidden />
      <div className="hero-stage">
        <div ref={zoomRef} className="hero-stage__zoom">
          <Layer name="bg" depth={1.5}>
            <AssetImage className="hero-art" style={layerOverrideStyle('bg')} {...heroSources(HERO_ASSETS.background)} priority fallback={<FallbackBackdrop />} />
          </Layer>
          <Layer name="glow" depth={1}>
            <div className="hero-glow" />
          </Layer>
          <Layer name="road" depth={0.4}>
            <AssetImage className="hero-art" style={layerOverrideStyle('road')} {...heroSources(HERO_ASSETS.road)} fallback={<FallbackRoad />} />
          </Layer>
          <Layer name="guitar" depth={5}>
            <AssetImage className="hero-art" style={layerOverrideStyle('guitar')} {...heroSources(HERO_ASSETS.guitar)} fallback={<Guitar />} />
          </Layer>
          <Layer name="photos">
            <HeroPhotos />
          </Layer>
          <Layer name="particles" depth={8}>
            <AssetImage className="hero-art" style={layerOverrideStyle('particles')} {...heroSources(HERO_ASSETS.particles)} fallback={<FallbackParticles />} />
          </Layer>
          <Layer name="markers" depth={0.4}>
            <RoadMarkers onSelect={enter} />
          </Layer>
          {debug.enabled && HeroDebugGrid && (
            <Suspense fallback={null}>
              <HeroDebugGrid />
            </Suspense>
          )}
        </div>
      </div>
      <div className="hero__vignette" />
      {debug.enabled && HeroDebugPanel && (
        <Suspense fallback={null}>
          <HeroDebugPanel hidden={debug.hidden} toggle={debug.toggle} />
        </Suspense>
      )}

      <header className="hero__brand">
        <span className="hero__brand-mark">G4U</span>
        <span className="hero__brand-rule" aria-hidden="true" />
        <span className="hero__brand-sub">GUITAR FOR YOU</span>
      </header>

      <div ref={contentRef} className="hero__content">
        <div className="hero-logo-parallax">
          <h1 className="hero-logo-wrap hero-enter">
            <AssetImage
              className="hero-logo"
              src={HERO_ASSETS.logo}
              alt="G4U — 15 Years"
              priority
              fallback={
                <span className="hero-logo-fallback">
                  G4U<b>15</b>
                  <span className="visually-hidden"> — 15 Years</span>
                </span>
              }
            />
          </h1>
        </div>
        <p className="hero__kicker hero-enter">G4U · Guitar For You</p>
        <p className="hero__range hero-enter">2011 — 2026</p>
        <p className="hero__tagline hero-enter">
          <AssetImage
            className="hero-quote"
            {...heroSources(HERO_ASSETS.quote, 640)}
            sizes="(max-width: 720px) 84vw, 530px"
            alt="Nếu cuộc đời này không rực rỡ thì sao? Miễn là những năm tháng ấy, chúng ta đã từng có nhau."
            fallback={
              <>
                <span>Nếu cuộc đời này không rực rỡ thì sao?</span>
                <span>Miễn là những năm tháng ấy,</span>
                <span>chúng ta đã từng có nhau.</span>
              </>
            }
          />
        </p>
        <button type="button" className="hero__cta hero-enter" onClick={() => enter(0)}>
          Enter the Journey
          <span className="hero__cta-arrow" aria-hidden="true">
            →
          </span>
        </button>

        <ul className="hero__milestones hero-enter" aria-label="Jump to a milestone year">
          {HERO_MILESTONES.map((m) => (
            <li key={m.year}>
              <button type="button" onClick={() => enter(YEARS.findIndex((y) => y.year === m.year))}>
                {m.year}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
