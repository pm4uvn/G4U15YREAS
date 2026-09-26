import { useCallback, useEffect, useState, type FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { signPaths } from '../lib/supabaseStorage'
import { youtubeThumbnail } from '../lib/youtube'
import type { MediaRow, MemoryStatus, MemoryVisibility } from '../types/g4u-memory'
import {
  PAGE_SIZE,
  currentSession,
  deleteForever,
  deleteMedia,
  hasAdminRole,
  listMemories,
  setDeleted,
  signIn,
  signOut,
  updateMemory,
  type AdminFilters,
  type AdminMemory,
  type MemoryPatch,
} from './adminApi'
import './admin.css'

const YEARS = Array.from({ length: 17 }, (_, i) => 2010 + i)
const STATUS_LABEL: Record<MemoryStatus, string> = {
  published: 'Đang hiện',
  pending: 'Chờ duyệt',
  hidden: 'Đã ẩn',
  rejected: 'Từ chối',
  draft: 'Nháp',
}

function errorText(err: unknown) {
  return err instanceof Error ? err.message : 'Đã có lỗi xảy ra.'
}

function patchOf(row: AdminMemory, status: MemoryStatus): MemoryPatch {
  return {
    title: row.title,
    content: row.content,
    author_name: row.author_name,
    location: row.location,
    memory_date: row.memory_date,
    year: row.year,
    status,
    visibility: row.visibility,
  }
}

/** Signed URL for one stored file, or null while it loads / when there is none. */
function useSignedUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    if (!path) return
    signPaths([path])
      .then((m) => live && setUrl(m[path] ?? null))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [path])
  return path ? url : null
}

function LoginForm({ onSession }: { onSession: (s: Session) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onSession(await signIn(email.trim(), password))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="admin-login" onSubmit={submit}>
      <h1>G4U · Quản trị</h1>
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
      </label>
      <label>
        Mật khẩu
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      {error && <p className="admin-error">{error}</p>}
      <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>
        {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
      </button>
    </form>
  )
}

function Thumb({ row }: { row: AdminMemory }) {
  const media = row.g4u_memory_media ?? []
  const visual = media.find((m) => m.media_type !== 'audio')
  const stored = useSignedUrl(visual?.thumbnail_path ?? visual?.storage_path ?? null)
  const src = visual?.media_type === 'video' && visual.external_id ? youtubeThumbnail(visual.external_id) : stored
  if (src) return <img className="admin-thumb" src={src} alt="" loading="lazy" />
  return <div className="admin-thumb admin-thumb--empty">{media.some((m) => m.media_type === 'audio') ? '♪' : '—'}</div>
}

function MediaPreview({ media, onDelete }: { media: MediaRow; onDelete: () => void }) {
  const url = useSignedUrl(media.media_type === 'image' ? (media.thumbnail_path ?? media.storage_path) : media.storage_path)
  return (
    <div className="admin-media">
      {media.media_type === 'image' && (url ? <img src={url} alt="" /> : <div className="admin-media__empty">Ảnh</div>)}
      {media.media_type === 'video' && media.external_id && (
        <a href={`https://www.youtube.com/watch?v=${media.external_id}`} target="_blank" rel="noreferrer">
          <img src={youtubeThumbnail(media.external_id)} alt="" />
        </a>
      )}
      {media.media_type === 'audio' &&
        (url ? <audio controls src={url} preload="none" /> : <div className="admin-media__empty">Ghi âm</div>)}
      <button type="button" className="admin-btn admin-btn--danger admin-btn--small" onClick={onDelete}>
        Xóa
      </button>
    </div>
  )
}

function EditDialog({
  row,
  onClose,
  onChanged,
}: {
  row: AdminMemory
  onClose: () => void
  /** The memory's year after a successful save, so the list can drop a year filter that would now hide it. */
  onChanged: (year?: number) => void
}) {
  const [title, setTitle] = useState(row.title ?? '')
  const [content, setContent] = useState(row.content ?? '')
  const [author, setAuthor] = useState(row.author_name ?? '')
  const [location, setLocation] = useState(row.location ?? '')
  const [date, setDate] = useState(row.memory_date ?? '')
  const [year, setYear] = useState(row.year)
  const [status, setStatus] = useState<MemoryStatus>(row.status)
  const [visibility, setVisibility] = useState<MemoryVisibility>(row.visibility)
  const [media, setMedia] = useState<MediaRow[]>(row.g4u_memory_media ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await updateMemory(row.id, {
        title: title.trim() || null,
        content: content.trim() || null,
        author_name: author.trim() || null,
        location: location.trim() || null,
        memory_date: date || null,
        year,
        status,
        visibility,
      })
      onChanged(year)
      onClose()
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  const removeMedia = async (m: MediaRow) => {
    if (!window.confirm('Xóa tệp này khỏi bài đăng? Không thể khôi phục.')) return
    try {
      await deleteMedia(m)
      setMedia((list) => list.filter((x) => x.id !== m.id))
      onChanged()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <div
      className="admin-overlay"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form className="admin-dialog" onSubmit={save}>
        <h2>Sửa bài đăng</h2>
        <label>
          Tiêu đề
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </label>
        <label>
          Nội dung
          <textarea value={content} onChange={(e) => setContent(e.target.value)} maxLength={4000} rows={6} />
        </label>
        <div className="admin-grid">
          <label>
            Người đăng
            <input value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={80} />
          </label>
          <label>
            Địa điểm
            <input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} />
          </label>
          <label>
            Năm
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {YEARS.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
          <label>
            Ngày kỷ niệm
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label>
            Trạng thái
            <select value={status} onChange={(e) => setStatus(e.target.value as MemoryStatus)}>
              {(Object.keys(STATUS_LABEL) as MemoryStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Hiển thị
            <select value={visibility} onChange={(e) => setVisibility(e.target.value as MemoryVisibility)}>
              <option value="public">Công khai</option>
              <option value="members">Chỉ thành viên</option>
            </select>
          </label>
        </div>

        {media.length > 0 && (
          <>
            <h3>Tệp đính kèm ({media.length})</h3>
            <div className="admin-media-list">
              {media.map((m) => (
                <MediaPreview key={m.id} media={m} onDelete={() => void removeMedia(m)} />
              ))}
            </div>
          </>
        )}

        {error && <p className="admin-error">{error}</p>}
        <div className="admin-actions">
          <button type="button" className="admin-btn" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>
            {busy ? 'Đang lưu…' : 'Lưu'}
          </button>
        </div>
      </form>
    </div>
  )
}

function mediaSummary(media: MediaRow[]): string {
  const count = (kind: MediaRow['media_type']) => media.filter((m) => m.media_type === kind).length
  return [
    count('image') > 0 && `${count('image')} ảnh`,
    count('video') > 0 && `${count('video')} video`,
    count('audio') > 0 && `${count('audio')} ghi âm`,
  ]
    .filter(Boolean)
    .join(', ')
}

function Dashboard({ session, onSignOut }: { session: Session; onSignOut: () => void }) {
  const [filters, setFilters] = useState<AdminFilters>({ year: 'all', status: 'all', trash: 'active', query: '', page: 0 })
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<AdminMemory[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminMemory | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  /**
   * If the year was just changed away from whatever the list is filtered to, the saved row would
   * otherwise vanish from view with no sign that the save actually worked — so the filter widens
   * to "every year" instead, and the row stays visible where the person can see the new value.
   */
  const handleEdited = useCallback(
    (year?: number) => {
      setFilters((f) => (year !== undefined && f.year !== 'all' && f.year !== year ? { ...f, year: 'all', page: 0 } : f))
      reload()
    },
    [reload],
  )

  useEffect(() => {
    let live = true
    listMemories(filters)
      .then((r) => {
        if (!live) return
        setRows(r.rows)
        setTotal(r.total)
        setError(null)
      })
      .catch((err) => live && setError(errorText(err)))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [filters, reloadKey])

  const patch = (p: Partial<AdminFilters>) => {
    setLoading(true)
    setFilters((f) => ({ ...f, page: 0, ...p }))
  }
  const goPage = (page: number) => {
    setLoading(true)
    setFilters((f) => ({ ...f, page }))
  }

  const run = async (job: () => Promise<void>) => {
    try {
      await job()
      reload()
    } catch (err) {
      setError(errorText(err))
    }
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <h1>G4U · Quản trị bài đăng</h1>
        <div>
          <span className="admin-user">{session.user.email}</span>
          <button type="button" className="admin-btn admin-btn--small" onClick={onSignOut}>
            Đăng xuất
          </button>
        </div>
      </header>

      <form
        className="admin-filters"
        onSubmit={(e) => {
          e.preventDefault()
          patch({ query: search })
        }}
      >
        <input
          placeholder="Tìm tiêu đề, nội dung, người đăng…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={filters.year} onChange={(e) => patch({ year: e.target.value === 'all' ? 'all' : Number(e.target.value) })}>
          <option value="all">Mọi năm</option>
          {YEARS.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
        <select value={filters.status} onChange={(e) => patch({ status: e.target.value as AdminFilters['status'] })}>
          <option value="all">Mọi trạng thái</option>
          {(Object.keys(STATUS_LABEL) as MemoryStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select value={filters.trash} onChange={(e) => patch({ trash: e.target.value as AdminFilters['trash'] })}>
          <option value="active">Bài đang có</option>
          <option value="deleted">Thùng rác (thành viên đã xóa)</option>
        </select>
        <button type="submit" className="admin-btn admin-btn--primary">
          Tìm
        </button>
      </form>

      {error && <p className="admin-error">{error}</p>}
      <p className="admin-count">{loading ? 'Đang tải…' : `${total} bài đăng`}</p>

      <ul className="admin-list">
        {rows.map((row) => {
          const media = row.g4u_memory_media ?? []
          const summary = mediaSummary(media)
          return (
            <li key={row.id} className="admin-row">
              <Thumb row={row} />
              <div className="admin-row__body">
                <div className="admin-row__top">
                  <strong>{row.title || '(không tiêu đề)'}</strong>
                  <span className={`admin-badge admin-badge--${row.status}`}>{STATUS_LABEL[row.status]}</span>
                </div>
                <p className="admin-row__text">{row.content || '—'}</p>
                <p className="admin-row__meta">
                  {row.year} · {row.author_name || 'Ẩn danh'} · {new Date(row.created_at).toLocaleString('vi-VN')}
                  {summary && ` · ${summary}`}
                  {row.visibility === 'members' && ' · chỉ thành viên'}
                </p>
              </div>
              <div className="admin-row__actions">
                <button type="button" className="admin-btn admin-btn--small" onClick={() => setEditing(row)}>
                  Sửa
                </button>
                {row.deleted_at ? (
                  <button
                    type="button"
                    className="admin-btn admin-btn--small"
                    onClick={() => void run(() => setDeleted(row.id, false))}
                  >
                    Khôi phục
                  </button>
                ) : (
                  <button
                    type="button"
                    className="admin-btn admin-btn--small"
                    onClick={() => void run(() => updateMemory(row.id, patchOf(row, row.status === 'hidden' ? 'published' : 'hidden')))}
                  >
                    {row.status === 'hidden' ? 'Hiện' : 'Ẩn'}
                  </button>
                )}
                <button
                  type="button"
                  className="admin-btn admin-btn--danger admin-btn--small"
                  onClick={() => {
                    if (window.confirm('Xóa vĩnh viễn bài đăng này cùng ảnh/ghi âm của nó? Không thể khôi phục.')) {
                      void run(() => deleteForever(row))
                    }
                  }}
                >
                  Xóa
                </button>
              </div>
            </li>
          )
        })}
        {!loading && rows.length === 0 && <li className="admin-empty">Không có bài đăng nào.</li>}
      </ul>

      <nav className="admin-pager">
        <button type="button" className="admin-btn admin-btn--small" disabled={filters.page === 0} onClick={() => goPage(filters.page - 1)}>
          ← Trước
        </button>
        <span>
          Trang {filters.page + 1} / {pages}
        </span>
        <button
          type="button"
          className="admin-btn admin-btn--small"
          disabled={filters.page + 1 >= pages}
          onClick={() => goPage(filters.page + 1)}
        >
          Sau →
        </button>
      </nav>

      {editing && <EditDialog row={editing} onClose={() => setEditing(null)} onChanged={handleEdited} />}
    </div>
  )
}

export default function AdminApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    document.title = 'G4U · Quản trị'
    if (!supabase) return
    void currentSession().then((s) => {
      setSession(s)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) {
    return (
      <div className="admin-login">
        <p className="admin-error">Supabase chưa được cấu hình (thiếu biến môi trường).</p>
      </div>
    )
  }
  if (!ready) {
    return (
      <div className="admin-login">
        <p>Đang tải…</p>
      </div>
    )
  }

  const signedIn = !!session && !session.user.is_anonymous
  if (signedIn && hasAdminRole(session)) {
    return <Dashboard session={session} onSignOut={() => void signOut()} />
  }
  return (
    <>
      <LoginForm onSession={setSession} />
      {signedIn && <p className="admin-error admin-login__note">Tài khoản này chưa có quyền quản trị.</p>}
    </>
  )
}
