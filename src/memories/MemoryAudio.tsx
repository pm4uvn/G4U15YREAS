interface MemoryAudioProps {
  src?: string
  label: string
  seconds?: number
}

/** A voice note. Never autoplays; nothing is fetched until the listener presses play. */
export function MemoryAudio({ src, label, seconds }: MemoryAudioProps) {
  const length = seconds ? `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}` : null
  return (
    <div className="memory-audio">
      <span className="memory-audio__label">
        <span className="memory-audio__dot" aria-hidden="true" />
        {label}
        {length && <em>{length}</em>}
      </span>
      {src ? (
        <audio className="memory-audio__player" src={src} controls preload="none" aria-label={label} />
      ) : (
        <span className="memory-audio__loading">Đang chuẩn bị…</span>
      )}
    </div>
  )
}
