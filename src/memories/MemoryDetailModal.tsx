import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { gsap } from '../animation/gsap'
import { useExperienceStore } from '../store/experienceStore'
import { prefersReducedMotion } from '../utils/device'
import { signPaths } from '../lib/supabaseStorage'
import { loadMore, useMemoriesByYear } from './hooks/useMemoriesByYear'
import { MemoryGallery } from './MemoryGallery'
import { MemoryAudio } from './MemoryAudio'
import { MemorySocial } from './MemorySocial'
import { memoryDateLabel, voiceNotes } from './memoryFormat'
import { useDialog } from './useDialog'
import './memories.css'

/** Fullscreen memory viewer. Left/Right arrows step through the year's memories. */
export default function MemoryDetailModal() {
  const view = useExperienceStore((s) => s.memoryView)
  const closeMemory = useExperienceStore((s) => s.closeMemory)
  const openMemory = useExperienceStore((s) => s.openMemory)

  if (!view) return null
  return <Viewer year={view.year} memoryId={view.memoryId} onClose={closeMemory} onSelect={openMemory} />
}

interface ViewerProps {
  year: number
  memoryId: string
  onClose: () => void
  onSelect: (year: number, id: string) => void
}

function Viewer({ year, memoryId, onClose, onSelect }: ViewerProps) {
  const { items, hasMore } = useMemoriesByYear(year)
  const index = Math.max(0, items.findIndex((m) => m.id === memoryId))
  const memory = items[index]

  const dialogRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [errorFor, setErrorFor] = useState<string | null>(null)
  const mediaError = errorFor === memoryId

  useDialog(dialogRef, onClose)

  // Sign this memory's full-size media only when it is actually opened.
  useEffect(() => {
    const paths = (memory?.media ?? []).flatMap((m) => [m.storagePath, m.thumbnailPath].filter(Boolean) as string[])
    if (paths.length === 0) return
    let cancelled = false
    signPaths(paths)
      .then((signed) => !cancelled && setUrls((prev) => ({ ...prev, ...signed })))
      .catch((err) => {
        console.error('[g4u] could not sign media', err)
        if (!cancelled) setErrorFor(memoryId)
      })
    return () => {
      cancelled = true
    }
  }, [memory, memoryId])

  // Opening / stepping: opacity 0 → 1, scale .96 → 1.
  useEffect(() => {
    const el = contentRef.current
    if (!el || prefersReducedMotion()) return
    const tween = gsap.fromTo(el, { opacity: 0, scale: 0.96 }, { opacity: 1, scale: 1, duration: 0.55, ease: 'power2.out' })
    return () => {
      tween.kill()
    }
  }, [memoryId])

  const go = useCallback(
    (delta: number) => {
      const next = items[index + delta]
      if (next) onSelect(year, next.id)
      else if (delta > 0 && hasMore) void loadMore(year)
    },
    [hasMore, index, items, onSelect, year],
  )

  // Arrow keys for prev/next memory.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [go])

  // Stepping past the last loaded memory: continue once the next page arrives.
  const lastCount = useRef(items.length)
  useEffect(() => {
    if (items.length > lastCount.current && index === lastCount.current - 1) {
      onSelect(year, items[lastCount.current].id)
    }
    lastCount.current = items.length
  }, [index, items, onSelect, year])

  const hasNext = index < items.length - 1 || hasMore
  const title = memory?.title ?? null

  return createPortal(
    <div
      ref={dialogRef}
      className="memory-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title ?? `Kỷ niệm năm ${year}`}
      tabIndex={-1}
      data-lenis-prevent
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <button type="button" className="memory-modal__close" onClick={onClose} aria-label="Đóng">
        ✕
      </button>

      {memory ? (
        <div ref={contentRef} className={`memory-modal__content ${memory.media.length ? 'has-media' : ''}`}>
          {memory.media.length > 0 && (
            <div className="memory-modal__media">
              {memory.media.some((m) => m.mediaType !== 'audio') && (
                <MemoryGallery
                  key={memory.id}
                  media={memory.media.filter((m) => m.mediaType !== 'audio')}
                  urls={urls}
                  alt={title ?? `Kỷ niệm năm ${year}`}
                />
              )}
              {voiceNotes(memory).map((v, i, all) => (
                <MemoryAudio
                  key={v.id}
                  src={v.storagePath ? urls[v.storagePath] : undefined}
                  label={all.length > 1 ? `Ghi âm ${i + 1}` : 'Ghi âm'}
                  seconds={v.duration}
                />
              ))}
              {mediaError && <p className="memory-modal__error">Không tải được ảnh/video. Hãy thử mở lại.</p>}
            </div>
          )}
          <article className="memory-modal__story">
            <p className="memory-modal__year">{year}</p>
            {title && <h2 className="memory-modal__title">{title}</h2>}
            {memory.content && <p className="memory-modal__text">{memory.content}</p>}
            <p className="memory-modal__meta">
              {memory.author && <span>{memory.author.displayName}</span>}
              <span>{memoryDateLabel(memory)}</span>
              {memory.location && <span>{memory.location}</span>}
            </p>
            <MemorySocial memoryId={memory.id} share={{ title, year }} />
          </article>
        </div>
      ) : (
        <p className="memory-modal__empty">Không tìm thấy kỷ niệm này.</p>
      )}

      <nav className="memory-modal__nav" aria-label="Điều hướng kỷ niệm">
        <button type="button" className="memory-link" onClick={() => go(-1)} disabled={index <= 0}>
          ← Kỷ niệm trước
        </button>
        <span className="memory-modal__position">
          {items.length ? index + 1 : 0} / {items.length}
          {hasMore ? '+' : ''}
        </span>
        <button type="button" className="memory-link" onClick={() => go(1)} disabled={!hasNext}>
          Kỷ niệm sau →
        </button>
      </nav>
    </div>,
    document.body,
  )
}
