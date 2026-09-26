import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  addComment,
  deleteComment,
  fetchComments,
  fetchLikeState,
  setLiked,
  toMemoryError,
  type LikeState,
  type MemoryComment,
} from '../lib/g4uMemories'
import { isSupabaseConfigured } from '../lib/supabase'

const NAME_KEY = 'g4u_comment_author'

function commentTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' })
}

interface ShareInfo {
  title: string | null
  year: number
}

/** Like / comment / share for one memory, shown under its story in the fullscreen viewer. */
export function MemorySocial({ memoryId, share }: { memoryId: string; share: ShareInfo }) {
  // Starts at a real value, not null, so the button is clickable immediately — showing "0" rather
  // than nothing while the real count loads, or forever if it fails to (e.g. not migrated yet).
  const [like, setLike] = useState<LikeState>({ count: 0, likedByMe: false })
  const likeTouched = useRef(false)
  const likeBusy = useRef(false)
  const [comments, setComments] = useState<MemoryComment[] | null>(null)
  const draftRef = useRef<HTMLTextAreaElement>(null)
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) ?? ''
    } catch {
      return ''
    }
  })
  const [draft, setDraft] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let live = true
    fetchLikeState(memoryId)
      .then((s) => live && !likeTouched.current && setLike(s))
      .catch((err) => console.warn('[g4u] could not load like state', err))
    return () => {
      live = false
    }
  }, [memoryId])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    let live = true
    fetchComments(memoryId)
      .then((rows) => live && setComments(rows))
      .catch((err) => {
        console.error('[g4u] could not load comments', err)
        if (live) setError('Không tải được bình luận.')
      })
    return () => {
      live = false
    }
  }, [memoryId])

  const toggleLike = async () => {
    if (likeBusy.current) return
    likeTouched.current = true
    likeBusy.current = true
    const wasLiked = like.likedByMe
    setLike({ count: like.count + (wasLiked ? -1 : 1), likedByMe: !wasLiked })
    try {
      await setLiked(memoryId, !wasLiked)
    } catch (err) {
      console.warn('[g4u] like failed', err)
      setLike(like)
      setError(toMemoryError(err).userMessage)
    } finally {
      likeBusy.current = false
    }
  }

  const submitComment = async (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim() || posting) return
    setPosting(true)
    setError(null)
    try {
      const saved = await addComment(memoryId, name, draft)
      setComments((list) => [...(list ?? []), saved])
      setDraft('')
      try {
        localStorage.setItem(NAME_KEY, name.trim())
      } catch {
        /* private browsing — the name just won't be remembered next time */
      }
    } catch (err) {
      setError(toMemoryError(err).userMessage)
    } finally {
      setPosting(false)
    }
  }

  const removeComment = async (id: string) => {
    const prev = comments
    setComments((list) => list?.filter((c) => c.id !== id) ?? null)
    try {
      await deleteComment(id)
    } catch (err) {
      setComments(prev ?? null)
      setError(toMemoryError(err).userMessage)
    }
  }

  const onShare = () => {
    const url = `${window.location.origin}/?year=${share.year}`
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
    // A plain link (not _blank target/rel tricks) is what makes a phone browser hand this off to
    // the installed Facebook app instead of opening it as just another browser tab.
    window.open(fbUrl, '_blank', 'noopener,noreferrer,width=600,height=640')
  }

  if (!isSupabaseConfigured) return null

  return (
    <div className="memory-social">
      <div className="memory-social__row">
        <button
          type="button"
          className={`memory-social__action ${like.likedByMe ? 'is-active' : ''}`}
          onClick={() => void toggleLike()}
        >
          <img src="/favicon-64.png" alt="" className="memory-social__like-icon" />
          Thích ({like.count})
        </button>
        <button type="button" className="memory-social__action" onClick={() => draftRef.current?.focus()}>
          💬 Bình luận{comments ? ` (${comments.length})` : ''}
        </button>
        <button type="button" className="memory-social__action" onClick={onShare}>
          ↗ Chia sẻ Facebook
        </button>
      </div>
      {error && <p className="memory-modal__error">{error}</p>}

      <div className="memory-social__comments">
        <h3 className="memory-social__heading">Bình luận{comments ? ` (${comments.length})` : ''}</h3>
        {comments === null && <p className="memory-social__note">Đang tải bình luận…</p>}
        {comments?.length === 0 && <p className="memory-social__note">Chưa có bình luận nào. Hãy là người đầu tiên.</p>}
        {comments && comments.length > 0 && (
          <ul className="memory-social__list">
            {comments.map((c) => (
              <li key={c.id} className="memory-social__comment">
                <p className="memory-social__comment-head">
                  <span className="memory-social__comment-author">{c.authorName || 'Ẩn danh'}</span>
                  <span className="memory-social__comment-time">{commentTime(c.createdAt)}</span>
                </p>
                <p className="memory-social__comment-text">{c.content}</p>
                {c.mine && (
                  <button type="button" className="memory-link memory-social__comment-delete" onClick={() => void removeComment(c.id)}>
                    Xoá
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <form className="memory-social__form" onSubmit={(e) => void submitComment(e)}>
          <input
            className="memory-social__input"
            placeholder="Tên của bạn (không bắt buộc)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
          />
          <textarea
            ref={draftRef}
            className="memory-social__textarea"
            placeholder="Viết bình luận…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={500}
            rows={2}
            required
          />
          <button type="submit" className="memory-cta" disabled={posting || !draft.trim()}>
            {posting ? 'Đang gửi…' : 'Gửi bình luận'}
          </button>
        </form>
      </div>
    </div>
  )
}
