import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { gsap } from '../animation/gsap'
import { prefersReducedMotion } from '../utils/device'
import { useExperienceStore } from '../store/experienceStore'
import { useCreateMemory, type MemoryFormValues } from './hooks/useCreateMemory'
import { MemoryUpload } from './MemoryUpload'
import { useDialog } from './useDialog'
import './memories.css'

const NAME_KEY = 'g4u:author-name'

function readSavedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export default function AddMemoryModal() {
  const year = useExperienceStore((s) => s.addMemoryYear)
  const close = useExperienceStore((s) => s.closeAddMemory)
  if (year === null) return null
  return <Form year={year} onClose={close} />
}

function Form({ year, onClose }: { year: number; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLFormElement>(null)
  const { items, videos, state, error, addFiles, addVoice, removeItem, addVideoLink, removeVideo, retryUploads, submit, cancel } =
    useCreateMemory(year)

  const [values, setValues] = useState<MemoryFormValues>({
    authorName: readSavedName(),
    title: '',
    content: '',
    memoryDate: '',
    location: '',
    visibility: 'public',
  })
  const [consent, setConsent] = useState(false)
  const submitting = state === 'submitting'

  const handleClose = () => {
    if (submitting) cancel()
    onClose()
  }
  useDialog(dialogRef, handleClose)

  useEffect(() => {
    const el = panelRef.current
    if (!el || prefersReducedMotion()) return
    const tween = gsap.fromTo(el, { opacity: 0, y: 18, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power2.out' })
    return () => {
      tween.kill()
    }
  }, [])

  // Success: a short thank-you, then land back on the year with the new memory in it.
  useEffect(() => {
    if (state !== 'success') return
    const t = window.setTimeout(onClose, 1800)
    return () => window.clearTimeout(t)
  }, [state, onClose])

  const set = <K extends keyof MemoryFormValues>(key: K, value: MemoryFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }))

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (submitting || !consent) return
    try {
      localStorage.setItem(NAME_KEY, values.authorName.trim())
    } catch {
      /* private mode — remembering the name is optional */
    }
    void submit(values)
  }

  const yearMin = `${year}-01-01`
  const yearMax = `${year}-12-31`

  return createPortal(
    <div
      ref={dialogRef}
      className="memory-modal memory-modal--form"
      role="dialog"
      aria-modal="true"
      aria-label={`Thêm kỷ niệm năm ${year}`}
      tabIndex={-1}
      data-lenis-prevent
    >
      <form ref={panelRef} className="memory-form" onSubmit={onSubmit} noValidate>
        <button type="button" className="memory-modal__close" onClick={handleClose} aria-label="Đóng">
          ✕
        </button>

        {state === 'success' ? (
          <div className="memory-form__success" role="status">
            <p className="memory-modal__year">{year}</p>
            <h2 className="memory-modal__title">Cảm ơn bạn đã kể lại.</h2>
            <p className="memory-modal__text">Kỷ niệm của bạn đã được thêm vào hành trình.</p>
          </div>
        ) : (
          <>
            <p className="memory-modal__year">{year}</p>
            <h2 className="memory-modal__title">Thêm một kỷ niệm</h2>

            <label className="memory-form__field">
              <span className="memory-form__label">Tên của bạn</span>
              <input
                type="text"
                value={values.authorName}
                maxLength={80}
                required
                disabled={submitting}
                autoComplete="name"
                onChange={(e) => set('authorName', e.target.value)}
              />
            </label>

            <label className="memory-form__field">
              <span className="memory-form__label">Tiêu đề kỷ niệm</span>
              <input
                type="text"
                value={values.title}
                maxLength={120}
                placeholder="Chuyến đi Đà Lạt năm ấy"
                disabled={submitting}
                onChange={(e) => set('title', e.target.value)}
              />
            </label>

            <label className="memory-form__field">
              <span className="memory-form__label">Câu chuyện của bạn</span>
              <textarea
                value={values.content}
                maxLength={4000}
                rows={5}
                placeholder="Đà Lạt năm ấy, chúng ta cứ nghĩ mình còn rất nhiều thời gian."
                disabled={submitting}
                onChange={(e) => set('content', e.target.value)}
              />
            </label>

            <MemoryUpload
              items={items}
              videos={videos}
              disabled={submitting}
              onAdd={addFiles}
              onAddVoice={addVoice}
              onRemove={removeItem}
              onRetry={retryUploads}
              onAddVideo={addVideoLink}
              onRemoveVideo={removeVideo}
            />

            <div className="memory-form__row">
              <label className="memory-form__field">
                <span className="memory-form__label">Ngày (tuỳ chọn)</span>
                <input
                  type="date"
                  value={values.memoryDate}
                  min={yearMin}
                  max={yearMax}
                  disabled={submitting}
                  onChange={(e) => set('memoryDate', e.target.value)}
                />
              </label>
              <label className="memory-form__field">
                <span className="memory-form__label">Địa điểm (tuỳ chọn)</span>
                <input
                  type="text"
                  value={values.location}
                  maxLength={120}
                  disabled={submitting}
                  onChange={(e) => set('location', e.target.value)}
                />
              </label>
            </div>

            <fieldset className="memory-form__field memory-form__visibility" disabled={submitting}>
              <legend className="memory-form__label">Hiển thị</legend>
              <label>
                <input type="radio" name="visibility" checked readOnly /> Công khai
              </label>
              <label title="Cần đăng nhập thành viên G4U — tính năng đăng nhập sẽ có sau.">
                <input type="radio" name="visibility" disabled /> Chỉ thành viên G4U
              </label>
            </fieldset>

            <label className="memory-form__consent">
              <input type="checkbox" checked={consent} disabled={submitting} onChange={(e) => setConsent(e.target.checked)} />
              <span>Tôi đồng ý chia sẻ kỷ niệm này trên website G4U 15 Năm.</span>
            </label>

            {error && (
              <p className="memory-form__error" role="alert">
                {error}
              </p>
            )}

            <div className="memory-form__actions">
              <button type="button" className="memory-link" onClick={handleClose}>
                Huỷ
              </button>
              <button type="submit" className="memory-cta" disabled={submitting || !consent}>
                {submitting ? 'Đang chia sẻ…' : 'Chia sẻ kỷ niệm'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>,
    document.body,
  )
}
