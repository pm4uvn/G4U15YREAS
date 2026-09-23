import { useState } from 'react'
import { youtubeEmbedUrl, youtubeThumbnail } from '../lib/youtube'

interface MemoryVideoProps {
  videoId: string
  label: string
}

/**
 * YouTube player behind a click-to-play poster: the embed (and YouTube's
 * scripts/cookies) load only when the viewer asks for it, so nothing plays
 * or is fetched on its own.
 */
export function MemoryVideo({ videoId, label }: MemoryVideoProps) {
  const [playing, setPlaying] = useState(false)

  return (
    <div className="memory-video">
      {playing ? (
        <iframe
          className="memory-video__frame"
          src={youtubeEmbedUrl(videoId, true)}
          title={label}
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <button type="button" className="memory-video__poster" onClick={() => setPlaying(true)} aria-label={`Phát video: ${label}`}>
          <img src={youtubeThumbnail(videoId)} alt="" loading="lazy" decoding="async" />
          <span className="memory-video__play" aria-hidden="true">
            ▶
          </span>
        </button>
      )}
    </div>
  )
}
