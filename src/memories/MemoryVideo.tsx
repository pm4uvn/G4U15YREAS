import { useState } from 'react'
import { youtubeEmbedUrl, youtubeThumbnail } from '../lib/youtube'

interface MemoryVideoProps {
  videoId: string
  label: string
  /** The autoplay tour skips the poster and starts the video itself — muted, since a browser
   * only allows an iframe to autoplay with sound once that specific frame has been interacted
   * with directly. YouTube's own controls still let the viewer unmute it. */
  autoStart?: boolean
}

/**
 * YouTube player behind a click-to-play poster: the embed (and YouTube's
 * scripts/cookies) load only when the viewer asks for it, so nothing plays
 * or is fetched on its own.
 */
export function MemoryVideo({ videoId, label, autoStart }: MemoryVideoProps) {
  const [playing, setPlaying] = useState(!!autoStart)

  return (
    <div className="memory-video">
      {playing ? (
        <iframe
          className="memory-video__frame"
          src={youtubeEmbedUrl(videoId, true, autoStart)}
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
