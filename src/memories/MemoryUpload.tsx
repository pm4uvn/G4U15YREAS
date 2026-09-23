import { useRef, useState } from 'react'
import { IMAGE_TYPES, LIMITS } from '../lib/supabaseStorage'
import { youtubeThumbnail } from '../lib/youtube'
import type { UploadItem, VideoLink } from './hooks/useCreateMemory'
import type { Recording } from './hooks/useVoiceRecorder'
import { VoiceRecorder } from './VoiceRecorder'

interface MemoryUploadProps {
  items: UploadItem[]
  videos: VideoLink[]
  disabled: boolean
  onAdd: (files: File[]) => string[]
  onAddVoice: (recording: Recording) => string | null
  onRemove: (id: string) => void
  onRetry: () => void
  onAddVideo: (url: string) => string | null
  onRemoveVideo: (id: string) => void
}

const STATUS_LABEL: Record<UploadItem['status'], string> = {
  queued: 'Chờ tải lên',
  processing: 'Đang xử lý…',
  uploading: 'Đang tải lên…',
  done: 'Đã tải lên',
  error: 'Lỗi',
}

export function MemoryUpload({
  items,
  videos,
  disabled,
  onAdd,
  onAddVoice,
  onRemove,
  onRetry,
  onAddVideo,
  onRemoveVideo,
}: MemoryUploadProps) {
  const photoInput = useRef<HTMLInputElement>(null)
  const [notes, setNotes] = useState<string[]>([])
  const [link, setLink] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)

  const addLink = () => {
    if (!link.trim()) return
    const problem = onAddVideo(link)
    setLinkError(problem)
    if (!problem) setLink('')
  }

  return (
    <fieldset className="memory-upload" disabled={disabled}>
      <legend className="memory-form__label">Ảnh</legend>
      <div className="memory-upload__buttons">
        <button type="button" className="memory-cta memory-cta--small" onClick={() => photoInput.current?.click()}>
          Tải ảnh lên
        </button>
      </div>
      <input
        ref={photoInput}
        type="file"
        accept={IMAGE_TYPES.join(',')}
        multiple
        hidden
        onChange={(e) => {
          setNotes(e.target.files ? onAdd(Array.from(e.target.files)) : [])
          e.target.value = ''
        }}
      />
      <p className="memory-form__hint">
        JPG, PNG hoặc WebP, tối đa {LIMITS.imageBytes / 1024 / 1024} MB mỗi ảnh, {LIMITS.maxImages} ảnh.
      </p>

      {notes.length > 0 && (
        <ul className="memory-upload__notes" role="alert">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <ul className="memory-upload__list">
          {items.map((it) => (
            <li key={it.id} className={`memory-upload__item is-${it.status}`}>
              {it.kind === 'audio' ? (
                <span className="memory-upload__thumb memory-upload__thumb--voice" aria-hidden="true">
                  ●
                </span>
              ) : (
                <img className="memory-upload__thumb" src={it.previewUrl} alt="" />
              )}
              <div className="memory-upload__info">
                <span className="memory-upload__name">
                  {it.kind === 'audio' ? `Ghi âm · ${Math.round(it.seconds ?? 0)} giây` : it.file.name}
                </span>
                {it.kind === 'audio' && <audio className="memory-upload__audio" src={it.previewUrl} controls preload="metadata" />}
                <span className="memory-upload__status">
                  {STATUS_LABEL[it.status]}
                  {it.status === 'uploading' && ` ${Math.round(it.progress * 100)}%`}
                  {it.status === 'error' && it.error ? ` — ${it.error}` : ''}
                </span>
                {(it.status === 'uploading' || it.status === 'done') && (
                  <span className="memory-upload__bar" aria-hidden="true">
                    <span style={{ width: `${Math.round(it.progress * 100)}%` }} />
                  </span>
                )}
              </div>
              {it.status === 'error' && (
                <button type="button" className="memory-link" onClick={onRetry}>
                  Thử lại
                </button>
              )}
              <button
                type="button"
                className="memory-icon-button"
                aria-label={`Bỏ ${it.file.name}`}
                onClick={() => onRemove(it.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="memory-form__label memory-upload__subhead">Giọng nói</p>
      <VoiceRecorder disabled={disabled} onRecorded={onAddVoice} />

      <p className="memory-form__label memory-upload__subhead">Video YouTube</p>
      <div className="memory-upload__link">
        <input
          type="url"
          value={link}
          placeholder="https://youtu.be/…"
          aria-label="Link video YouTube"
          onChange={(e) => {
            setLink(e.target.value)
            setLinkError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addLink()
            }
          }}
        />
        <button type="button" className="memory-cta memory-cta--small" onClick={addLink}>
          Thêm link
        </button>
      </div>
      {linkError && (
        <p className="memory-form__error" role="alert">
          {linkError}
        </p>
      )}
      <p className="memory-form__hint">
        Video được phát trực tiếp từ YouTube (tối đa {LIMITS.maxVideos}), không cần tải lên.
      </p>

      {videos.length > 0 && (
        <ul className="memory-upload__list">
          {videos.map((v) => (
            <li key={v.id} className="memory-upload__item is-done">
              <img className="memory-upload__thumb" src={youtubeThumbnail(v.videoId)} alt="" loading="lazy" />
              <div className="memory-upload__info">
                <span className="memory-upload__name">{v.url}</span>
                <span className="memory-upload__status">YouTube</span>
              </div>
              <button
                type="button"
                className="memory-icon-button"
                aria-label="Bỏ video này"
                onClick={() => onRemoveVideo(v.id)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}
