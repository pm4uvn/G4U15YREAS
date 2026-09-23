import { useCallback, useEffect, useRef, useState } from 'react'

export type RecorderPhase = 'idle' | 'requesting' | 'recording'

export interface Recording {
  blob: Blob
  /** MIME type without codec parameters, e.g. "audio/webm" — what storage expects. */
  mime: string
  seconds: number
}

/** Containers in order of preference: Chrome/Firefox/Edge record webm/ogg, Safari (incl. iPhone) records mp4. */
const CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg']

function pickMime(): string {
  return CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

export function canRecordAudio(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    window.isSecureContext
  )
}

export function audioExtension(mime: string): string {
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) return 'm4a'
  if (mime.includes('mpeg')) return 'mp3'
  if (mime.includes('wav')) return 'wav'
  return 'webm'
}

function friendlyMicError(err: unknown): string {
  const name = (err as { name?: string } | null)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Bạn chưa cho phép dùng micro. Hãy bật quyền micro cho trang này trong trình duyệt rồi thử lại.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Không tìm thấy micro trên thiết bị này.'
  if (name === 'NotReadableError') return 'Micro đang được ứng dụng khác sử dụng.'
  return 'Không thể bắt đầu ghi âm. Hãy thử lại.'
}

/**
 * Records from the microphone with MediaRecorder. Works on desktop and phones (HTTPS or localhost only).
 * Stops by itself at `maxSeconds`; the finished clip is handed to `onFinished`.
 */
export function useVoiceRecorder(maxSeconds: number, onFinished: (recording: Recording) => void) {
  const [phase, setPhase] = useState<RecorderPhase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const chunks = useRef<Blob[]>([])
  const startedAt = useRef(0)
  const timer = useRef<number | null>(null)
  const discard = useRef(false)
  const finished = useRef(onFinished)
  useEffect(() => {
    finished.current = onFinished
  }, [onFinished])

  const release = useCallback(() => {
    if (timer.current !== null) window.clearInterval(timer.current)
    timer.current = null
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    recorder.current = null
  }, [])

  const stop = useCallback(() => {
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop()
  }, [])

  /** Stop and throw the clip away. */
  const cancel = useCallback(() => {
    discard.current = true
    stop()
    if (!recorder.current) setPhase('idle')
  }, [stop])

  const start = useCallback(async () => {
    if (!canRecordAudio()) {
      setError('Trình duyệt này chưa hỗ trợ ghi âm (cần HTTPS và trình duyệt mới).')
      return
    }
    setError(null)
    setPhase('requesting')
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      stream.current = media
      const mimeType = pickMime()
      const rec = new MediaRecorder(media, mimeType ? { mimeType } : undefined)
      recorder.current = rec
      chunks.current = []
      discard.current = false

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data)
      }
      rec.onstop = () => {
        const seconds = (Date.now() - startedAt.current) / 1000
        const type = rec.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(chunks.current, { type })
        const keep = !discard.current && blob.size > 0 && seconds >= 0.5
        release()
        setPhase('idle')
        setElapsed(0)
        if (keep) finished.current({ blob, mime: type.split(';')[0], seconds })
      }
      rec.onerror = () => {
        setError('Ghi âm bị gián đoạn. Hãy thử lại.')
        discard.current = true
        stop()
      }

      startedAt.current = Date.now()
      rec.start(1000)
      setPhase('recording')
      timer.current = window.setInterval(() => {
        const s = (Date.now() - startedAt.current) / 1000
        setElapsed(s)
        if (s >= maxSeconds) stop()
      }, 200)
    } catch (err) {
      release()
      setError(friendlyMicError(err))
      setPhase('idle')
    }
  }, [maxSeconds, release, stop])

  // Leaving the form must release the microphone.
  useEffect(() => {
    return () => {
      discard.current = true
      if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop()
      release()
    }
  }, [release])

  return { phase, elapsed, error, supported: canRecordAudio(), start, stop, cancel }
}
