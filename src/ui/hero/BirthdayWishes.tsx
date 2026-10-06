import { useEffect, useState, type FormEvent } from 'react'
import { useWishesStore } from '../../store/wishesStore'
import { toMemoryError } from '../../lib/g4uMemories'
import { isSupabaseConfigured } from '../../lib/supabase'

const NAME_KEY = 'g4u_comment_author'

/**
 * Newest-first, scrolling on its own from the bottom, looping through every wish.
 * Rendered twice: once as a fixed overlay for desktop (`variant="overlay"`, the default), and once
 * inline inside the mobile scroll column (`variant="inline"`) since a phone has no room to float it.
 */
export function BirthdayWishesTicker({ variant = 'overlay' }: { variant?: 'overlay' | 'inline' } = {}) {
  const wishes = useWishesStore((s) => s.wishes)
  const load = useWishesStore((s) => s.load)

  useEffect(() => {
    if (isSupabaseConfigured) void load()
  }, [load])

  if (!isSupabaseConfigured || wishes.length === 0) return null

  // Longer copy scrolls for longer, at a steady reading pace.
  const seconds = Math.max(18, wishes.reduce((n, w) => n + w.message.length, 0) * 0.22)

  return (
    <aside
      className={variant === 'inline' ? 'hero-wishes hero-wishes--inline' : 'hero-wishes'}
      aria-label="Lời chúc mừng sinh nhật G4U"
    >
      <p className="hero-wishes__title">Lời chúc mừng sinh nhật</p>
      <div className="hero-wishes__mask">
        <div className="hero-wishes__track" style={{ animationDuration: `${seconds}s` }}>
          {[0, 1].map((copy) => (
            <ul className="hero-wishes__list" key={copy}>
              {wishes.map((w) => (
                <li key={`${copy}-${w.id}`} className="hero-wishes__item">
                  <p className="hero-wishes__message">“{w.message}”</p>
                  <p className="hero-wishes__author">— {w.authorName || 'Ẩn danh'}</p>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </aside>
  )
}

/** A small pill that opens an inline form to post a wish — appended live to the ticker above. */
export function BirthdayWishForm() {
  const submit = useWishesStore((s) => s.submit)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [message, setMessage] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  if (!isSupabaseConfigured) return null

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!message.trim() || posting) return
    setPosting(true)
    setError(null)
    try {
      await submit(name, message)
      try {
        localStorage.setItem(NAME_KEY, name.trim())
      } catch {
        /* private browsing — the name just won't be remembered next time */
      }
      setMessage('')
      setDone(true)
      window.setTimeout(() => {
        setDone(false)
        setOpen(false)
      }, 1600)
    } catch (err) {
      setError(toMemoryError(err).userMessage)
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="hero-wish-form">
      <button type="button" className="hero__cta hero__cta--ghost hero-enter" onClick={() => setOpen((v) => !v)}>
        Gửi lời chúc mừng
      </button>
      {open && (
        <form className="hero-wish-form__panel" onSubmit={(e) => void onSubmit(e)}>
          {done ? (
            <p className="hero-wish-form__done">Cảm ơn lời chúc của bạn! 🎉</p>
          ) : (
            <>
              <input
                className="hero-wish-form__input"
                placeholder="Tên của bạn (không bắt buộc)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
              />
              <textarea
                className="hero-wish-form__textarea"
                placeholder="Viết lời chúc mừng sinh nhật 15 năm G4U…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={300}
                rows={3}
                required
              />
              {error && <p className="hero-wish-form__error">{error}</p>}
              <button type="submit" className="hero__cta" disabled={posting || !message.trim()}>
                {posting ? 'Đang gửi…' : 'Gửi'}
              </button>
            </>
          )}
        </form>
      )}
    </div>
  )
}
