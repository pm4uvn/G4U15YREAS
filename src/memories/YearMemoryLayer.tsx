import { useEffect, useMemo, useRef, useState } from 'react'
import { gsap } from '../animation/gsap'
import { prefersReducedMotion } from '../utils/device'
import { useTimeline } from '../timeline/useTimeline'
import { useExperienceStore } from '../store/experienceStore'
import { useMemoriesByYear } from './hooks/useMemoriesByYear'
import { AddMemoryButton } from './AddMemoryButton'
import './memories.css'

/**
 * A quiet control for the active year: how many stories it holds, view them all, add one.
 * The memories themselves hang in 3D beside the strings (see experience/MemoryField).
 */
export function YearMemoryLayer() {
  const { activeYear, hasEntered } = useTimeline()
  // Debounced so clicking across many years doesn't fetch every year in between.
  const [year, setYear] = useState(activeYear.year)
  useEffect(() => {
    const t = window.setTimeout(() => setYear(activeYear.year), 250)
    return () => window.clearTimeout(t)
  }, [activeYear.year])

  const { items, total, hasMore, status, error, configured, reload } = useMemoriesByYear(year)
  const openMemory = useExperienceStore((s) => s.openMemory)
  const openAddMemory = useExperienceStore((s) => s.openAddMemory)

  const rootRef = useRef<HTMLDivElement>(null)
  const reduced = useMemo(() => prefersReducedMotion(), [])

  useEffect(() => {
    const el = rootRef.current
    if (!el || reduced) return
    const tween = gsap.fromTo(
      el.children,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.6, stagger: 0.06, ease: 'power2.out', clearProps: 'transform' },
    )
    return () => {
      tween.kill()
    }
  }, [year, status, reduced])

  if (!configured) return null

  const photos = items.reduce((n, m) => n + m.media.filter((x) => x.mediaType === 'image').length, 0)
  const videos = items.reduce((n, m) => n + m.media.filter((x) => x.mediaType === 'video').length, 0)
  const voices = items.reduce((n, m) => n + m.media.filter((x) => x.mediaType === 'audio').length, 0)
  const stats = [
    `${total} kỷ niệm`,
    !hasMore && photos > 0 ? `${photos} ảnh` : null,
    !hasMore && videos > 0 ? `${videos} video` : null,
    !hasMore && voices > 0 ? `${voices} ghi âm` : null,
  ].filter(Boolean)

  return (
    <section
      className={`memory-layer ${hasEntered ? 'is-visible' : ''}`}
      aria-label={`Kỷ niệm năm ${year}`}
    >
      <div ref={rootRef} className="memory-layer__inner">
        <p className="memory-layer__eyebrow">Những câu chuyện của năm {year}</p>

        {status === 'loading' && <p className="memory-layer__note">Đang mở lại ký ức…</p>}

        {status === 'error' && (
          <div className="memory-layer__note">
            <p>{error}</p>
            <button type="button" className="memory-link" onClick={() => void reload()}>
              Thử lại
            </button>
          </div>
        )}

        {status === 'ready' && total === 0 && (
          <p className="memory-layer__note">Chưa có kỷ niệm nào được kể cho năm này.</p>
        )}

        {status === 'ready' && total > 0 && <p className="memory-layer__stats">{stats.join(' · ')}</p>}

        {status === 'ready' && (
          <div className="memory-layer__actions">
            {total > 0 && (
              <button type="button" className="memory-link" onClick={() => openMemory(year, items[0].id)}>
                Xem tất cả ({total}) →
              </button>
            )}
            <AddMemoryButton
              onClick={() => openAddMemory(year)}
              label={total === 0 ? '+ Kể kỷ niệm đầu tiên' : '+ Thêm kỷ niệm'}
            />
          </div>
        )}
      </div>
    </section>
  )
}
