import { useEffect, useState, type CSSProperties } from 'react'
import { prefersReducedMotion } from '../../utils/device'
import { HERO_ASSETS } from './heroAssets'
import { HERO_CARDS, type HeroCard } from './heroLayout'

const TONES = [
  'linear-gradient(180deg, #2a1d3a 0%, #6b3b4a 55%, #d98a4a 100%)',
  'linear-gradient(180deg, #1a1b3a 0%, #4a3560 50%, #c9793f 100%)',
  'linear-gradient(180deg, #231a30 0%, #573a44 55%, #b8703a 100%)',
]

function Placeholder({ card }: { card: HeroCard }) {
  return (
    <div className="hero-card__photo" style={{ background: TONES[card.tone % TONES.length] }}>
      <svg className="hero-card__people" viewBox="0 0 120 90" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        {Array.from({ length: card.people }, (_, i) => {
          const x = 60 + (i - (card.people - 1) / 2) * 24
          const h = 26 + ((i * 7) % 6)
          return (
            <g key={i} fill="#0a0710">
              <circle cx={x} cy={90 - h - 9} r={5.5} />
              <path d={`M ${x - 8} 90 L ${x - 6} ${90 - h} Q ${x} ${90 - h - 4} ${x + 6} ${90 - h} L ${x + 8} 90 Z`} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/**
 * Which photos a card shows. Cards take photos 1..N in order; when there are more photos
 * than cards, the extras are handed to the first cards as a second memory to drift into.
 */
function photosForCard(index: number): number[] {
  const total = HERO_ASSETS.memoryCount
  const cards = HERO_CARDS.length
  const list = [index + 1]
  for (let extra = cards + index + 1; extra <= total; extra += cards) list.push(extra)
  return list.filter((n) => n <= total)
}

const FADE_MS = 1800

function Card({ card, index }: { card: HeroCard; index: number }) {
  const photos = photosForCard(index)
  const [failed, setFailed] = useState(false)
  const [current, setCurrent] = useState(0)
  const [previous, setPrevious] = useState<number | null>(null)

  // Slowly dissolve into the card's next memory. Preload it first so the swap never flashes empty.
  useEffect(() => {
    if (photos.length < 2 || prefersReducedMotion()) return
    const every = (card.dur + 6) * 1000
    const id = window.setInterval(() => {
      const next = (current + 1) % photos.length
      const img = new Image()
      img.onload = () => {
        setPrevious(current)
        setCurrent(next)
        window.setTimeout(() => setPrevious(null), FADE_MS)
      }
      img.src = HERO_ASSETS.memory(photos[next])
    }, every + card.delay * 700)
    return () => window.clearInterval(id)
    // photos is derived from constants and stable per card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, card.dur, card.delay])

  const style = {
    left: `${card.left}%`,
    top: `${card.top}%`,
    width: `${card.width}%`,
    opacity: card.opacity,
    ['--rot' as string]: `${card.rot}deg`,
    ['--z' as string]: `${card.z}px`,
    // Cards that sit deeper are softer; those in front stay sharp.
    ['--blur' as string]: `${card.z < 0 ? Math.min(1.6, -card.z / 20).toFixed(1) : 0}px`,
    ['--d' as string]: card.depth,
    ['--dur' as string]: `${card.dur}s`,
    ['--delay' as string]: `-${card.delay}s`,
  } as CSSProperties

  const photo = (n: number, cls: string) => (
    <img
      key={n}
      className={`hero-card__photo ${cls}`}
      src={HERO_ASSETS.memory(n)}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  )

  return (
    <div className="hero-card" style={style}>
      <div className="hero-card__float">
        {failed ? (
          <Placeholder card={card} />
        ) : (
          <>
            {previous !== null && photo(photos[previous], 'is-leaving')}
            {photo(photos[current], previous !== null ? 'is-entering' : '')}
          </>
        )}
      </div>
    </div>
  )
}

/** Memories drifting behind the scene. Mounted just after first paint so they never delay the cover. */
export function HeroPhotos() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const id = window.setTimeout(() => setReady(true), 300)
    return () => window.clearTimeout(id)
  }, [])

  if (!ready) return null
  return (
    <div className="hero-photos" aria-hidden="true">
      {HERO_CARDS.map((card, i) => (
        <Card key={i} card={card} index={i} />
      ))}
    </div>
  )
}
