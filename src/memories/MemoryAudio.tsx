import { useEffect, useRef } from 'react'

interface MemoryAudioProps {
  src?: string
  label: string
  seconds?: number
  /** The autoplay tour: start playing itself once the source is ready, instead of on a click. */
  autoPlay?: boolean
}

/** A voice note. Never autoplays on its own; nothing is fetched until the listener presses play. */
export function MemoryAudio({ src, label, seconds, autoPlay }: MemoryAudioProps) {
  const length = seconds ? `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}` : null
  const ref = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (autoPlay && src) void ref.current?.play().catch((err) => console.warn('[g4u] voice note autoplay blocked', err))
  }, [autoPlay, src])

  return (
    <div className="memory-audio">
      <span className="memory-audio__label">
        <span className="memory-audio__dot" aria-hidden="true" />
        {label}
        {length && <em>{length}</em>}
      </span>
      {src ? (
        <audio ref={ref} className="memory-audio__player" src={src} controls preload="none" aria-label={label} />
      ) : (
        <span className="memory-audio__loading">Đang chuẩn bị…</span>
      )}
    </div>
  )
}
