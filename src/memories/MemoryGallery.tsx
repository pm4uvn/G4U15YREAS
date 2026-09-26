import { useEffect, useState } from 'react'
import type { G4UMemoryMedia } from '../types/g4u-memory'
import { MemoryVideo } from './MemoryVideo'

const AUTO_ADVANCE_MS = 5000

interface MemoryGalleryProps {
  media: G4UMemoryMedia[]
  urls: Record<string, string>
  alt: string
  /** The autoplay tour: start the first video itself instead of waiting for a click. */
  autoStartVideo?: boolean
}

/**
 * Carousel over a memory's photos and videos. An album of several photos advances on its own,
 * one every two seconds — a single photo just sits still, and a video pauses the cycling until
 * the person moves past it themselves, so it's never yanked away mid-play.
 */
export function MemoryGallery({ media, urls, alt, autoStartVideo }: MemoryGalleryProps) {
  const [index, setIndex] = useState(0)

  const current = media[index]
  const many = media.length > 1

  useEffect(() => {
    if (!many || current?.mediaType === 'video') return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % media.length), AUTO_ADVANCE_MS)
    return () => window.clearInterval(id)
    // `index` is a dependency on purpose: a manual arrow click gives a fresh 2s window too.
  }, [index, many, media.length, current?.mediaType])

  if (!current) return null
  const src = current.storagePath ? urls[current.storagePath] : undefined

  return (
    <div className="memory-gallery">
      <div className="memory-gallery__stage">
        {current.mediaType === 'image' && !src && <div className="memory-gallery__skeleton" aria-hidden="true" />}
        {src && current.mediaType === 'image' && (
          <img key={current.id} className="memory-gallery__image" src={src} alt={`${alt} (${index + 1}/${media.length})`} decoding="async" />
        )}
        {current.mediaType === 'video' && current.externalId && (
          <MemoryVideo key={current.id} videoId={current.externalId} label={`${alt} — video`} autoStart={autoStartVideo && index === 0} />
        )}
      </div>

      {many && (
        <div className="memory-gallery__controls">
          <button
            type="button"
            className="memory-icon-button"
            aria-label="Ảnh trước"
            onClick={() => setIndex((i) => (i - 1 + media.length) % media.length)}
          >
            ←
          </button>
          <span className="memory-gallery__count" aria-live="polite">
            {index + 1} / {media.length}
          </span>
          <button
            type="button"
            className="memory-icon-button"
            aria-label="Ảnh tiếp theo"
            onClick={() => setIndex((i) => (i + 1) % media.length)}
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}
