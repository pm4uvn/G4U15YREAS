import { useState } from 'react'
import { LIMITS } from '../lib/supabaseStorage'
import { useVoiceRecorder, type Recording } from './hooks/useVoiceRecorder'

const clock = (seconds: number) => {
  const s = Math.floor(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

interface VoiceRecorderProps {
  disabled: boolean
  /** Receives a finished clip; returns an error message to show, or null. */
  onRecorded: (recording: Recording) => string | null
}

/** Record a voice note from the microphone — on a computer or a phone. */
export function VoiceRecorder({ disabled, onRecorded }: VoiceRecorderProps) {
  const [note, setNote] = useState<string | null>(null)
  const { phase, elapsed, error, supported, start, stop, cancel } = useVoiceRecorder(LIMITS.maxVoiceSeconds, (rec) =>
    setNote(onRecorded(rec)),
  )

  if (!supported) {
    return (
      <p className="memory-form__hint">
        Trình duyệt này chưa hỗ trợ ghi âm. Hãy dùng Chrome, Edge, Firefox hoặc Safari mới, và mở trang bằng HTTPS.
      </p>
    )
  }

  return (
    <div className="voice-recorder">
      {phase === 'recording' ? (
        <div className="voice-recorder__live" role="status">
          <span className="voice-recorder__dot" aria-hidden="true" />
          <span className="voice-recorder__time">
            {clock(elapsed)} / {clock(LIMITS.maxVoiceSeconds)}
          </span>
          <button type="button" className="memory-cta memory-cta--small" onClick={stop}>
            Dừng &amp; lưu
          </button>
          <button type="button" className="memory-link" onClick={cancel}>
            Huỷ
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="memory-cta memory-cta--small"
          disabled={disabled || phase === 'requesting'}
          onClick={() => {
            setNote(null)
            void start()
          }}
        >
          {phase === 'requesting' ? 'Đang chờ quyền micro…' : '● Ghi âm'}
        </button>
      )}

      {(error || note) && (
        <p className="memory-form__error" role="alert">
          {error ?? note}
        </p>
      )}
      <p className="memory-form__hint">
        Kể bằng giọng của bạn (tối đa {LIMITS.maxVoiceSeconds / 60} phút, {LIMITS.maxVoiceNotes} đoạn). Trình duyệt sẽ
        hỏi quyền dùng micro.
      </p>
    </div>
  )
}
