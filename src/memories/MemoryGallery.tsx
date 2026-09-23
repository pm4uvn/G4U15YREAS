import { useState } from 'react'
import type { G4UMemoryMedia } from '../types/g4u-memory'
import { MemoryVideo } from './MemoryVideo'

interface MemoryGalleryProps {
  media: G4UMemoryMedia[]
  urls: Record<string, string>
  alt: string
}

/** Carousel over a memory's photos and videos. Arrow keys stay reserved for memory navigation. */
export function MemoryGallery({ media, urls, alt }: MemoryGalleryProps) {
  const [index, setIndex] = useState(0)

  const current = media[index]
  if (!current) return null
  const src = current.storagePath ? urls[current.storagePath] : undefined
  const many = media.length > 1

  return (
    <div className="memory-gallery">
      <div className="memory-gallery__stage">
        {current.mediaType === 'image' && !src && <div className="memory-gallery__skeleton" aria-hidden="true" />}
        {src && current.mediaType === 'image' && (
          <img key={current.id} className="memory-gallery__image" src={src} alt={`${alt} (${index + 1}/${media.length})`} decoding="async" />
        )}
        {current.mediaType === 'video' && current.externalId && (
          <MemoryVideo key={current.id} videoId={current.externalId} label={`${alt} — video`} />
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
