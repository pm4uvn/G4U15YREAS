import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type {
  G4UMemory,
  G4UMemoryMedia,
  MediaRow,
  MemoryMediaKind,
  MemoryRow,
  MemoryVisibility,
} from '../types/g4u-memory'

export const PAGE_SIZE = 10

export type MemoryErrorCode =
  | 'not_configured'
  | 'unavailable'
  | 'unauthorized'
  | 'session'
  | 'auth_unavailable'
  | 'upload_failed'
  | 'unsupported_file'
  | 'file_too_large'
  | 'too_many_files'
  | 'interrupted'
  | 'cancelled'
  | 'unknown'

/** User-facing copy. Raw backend errors go to the console only. */
const MESSAGES: Record<MemoryErrorCode, string> = {
  not_configured: 'Kho kỷ niệm chưa được kết nối.',
  unavailable: 'Không kết nối được tới máy chủ. Hãy thử lại sau ít phút.',
  unauthorized: 'Bạn chưa có quyền thực hiện thao tác này.',
  session: 'Phiên làm việc đã hết hạn. Hãy thử lại.',
  auth_unavailable: 'Chưa thể xác thực người gửi. Hãy thử lại sau.',
  upload_failed: 'Tải tệp lên không thành công.',
  unsupported_file: 'Định dạng tệp này chưa được hỗ trợ.',
  file_too_large: 'Tệp quá lớn.',
  too_many_files: 'Đã vượt quá số lượng tệp cho phép.',
  interrupted: 'Kết nối bị gián đoạn khi tải lên.',
  cancelled: 'Đã huỷ.',
  unknown: 'Đã có lỗi xảy ra. Hãy thử lại.',
}

export class MemoryError extends Error {
  code: MemoryErrorCode
  detail?: unknown
  constructor(code: MemoryErrorCode, devMessage?: string, detail?: unknown) {
    super(devMessage ?? code)
    this.code = code
    this.detail = detail
  }
  get userMessage(): string {
    return MESSAGES[this.code]
  }
}

export function toMemoryError(err: unknown): MemoryError {
  if (err instanceof MemoryError) return err
  const e = err as { message?: string; code?: string; status?: number } | null
  const text = `${e?.message ?? ''} ${e?.code ?? ''}`
  let code: MemoryErrorCode = 'unknown'
  if (e?.status === 401 || /jwt|expired/i.test(text)) code = 'session'
  else if (e?.code === '42501' || e?.status === 403 || /row-level security|not authorized/i.test(text)) code = 'unauthorized'
  else if (/failed to fetch|network|load failed/i.test(text)) code = 'unavailable'
  else if (/too many/i.test(text)) code = 'too_many_files'
  else if (/anonymous/i.test(text)) code = 'auth_unavailable'
  return new MemoryError(code, e?.message, err)
}

function mapMedia(row: MediaRow): G4UMemoryMedia {
  return {
    id: row.id,
    memoryId: row.memory_id,
    mediaType: row.media_type,
    storagePath: row.storage_path ?? undefined,
    thumbnailPath: row.thumbnail_path ?? undefined,
    provider: row.provider ?? undefined,
    externalId: row.external_id ?? undefined,
    mimeType: row.mime_type ?? undefined,
    fileSize: row.file_size ?? undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    duration: row.duration ?? undefined,
    sortOrder: row.sort_order,
  }
}

function mapMemory(row: MemoryRow): G4UMemory {
  return {
    id: row.id,
    userId: row.user_id,
    year: row.year,
    title: row.title,
    content: row.content,
    memoryDate: row.memory_date ?? undefined,
    location: row.location ?? undefined,
    visibility: row.visibility,
    status: row.status,
    media: (row.g4u_memory_media ?? []).map(mapMedia).sort((a, b) => a.sortOrder - b.sortOrder),
    author: row.author_name ? { displayName: row.author_name } : undefined,
    createdAt: row.created_at,
  }
}

/** One page of published memories for a year, with media in a single round-trip. */
export async function fetchYearPage(
  year: number,
  offset: number,
  limit = PAGE_SIZE,
): Promise<{ items: G4UMemory[]; total: number }> {
  if (!supabase) throw new MemoryError('not_configured')
  const { data, error, count } = await supabase
    .from('g4u_memories')
    .select('*, g4u_memory_media(*)', { count: 'exact' })
    .eq('year', year)
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('memory_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)
  if (error) throw toMemoryError(error)
  return { items: (data as MemoryRow[]).map(mapMemory), total: count ?? data.length }
}

/** Reuse the current session, or start an anonymous one (needs auth.uid() for RLS/storage). */
export async function ensureSession(): Promise<Session> {
  if (!supabase) throw new MemoryError('not_configured')
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session
  const { data: anon, error } = await supabase.auth.signInAnonymously()
  if (error || !anon.session) throw new MemoryError('auth_unavailable', error?.message, error)
  return anon.session
}

export interface NewMemoryInput {
  id: string
  userId: string
  authorName: string
  year: number
  title: string | null
  content: string | null
  memoryDate: string | null
  location: string | null
  visibility: MemoryVisibility
}

export interface NewMediaInput {
  mediaType: MemoryMediaKind
  storagePath: string | null
  thumbnailPath: string | null
  provider?: 'youtube'
  externalId?: string
  originalFilename?: string
  mimeType?: string
  fileSize?: number
  width?: number
  height?: number
  duration?: number
  sortOrder: number
}

export async function insertMemory(memory: NewMemoryInput, media: NewMediaInput[]): Promise<void> {
  if (!supabase) throw new MemoryError('not_configured')
  const { error } = await supabase.from('g4u_memories').insert({
    id: memory.id,
    user_id: memory.userId,
    author_name: memory.authorName,
    year: memory.year,
    title: memory.title,
    content: memory.content,
    memory_date: memory.memoryDate,
    location: memory.location,
    visibility: memory.visibility,
    status: 'published',
  })
  if (error) throw toMemoryError(error)

  if (media.length === 0) return
  const { error: mediaError } = await supabase.from('g4u_memory_media').insert(
    media.map((m) => ({
      memory_id: memory.id,
      media_type: m.mediaType,
      storage_path: m.storagePath,
      thumbnail_path: m.thumbnailPath,
      provider: m.provider ?? null,
      external_id: m.externalId ?? null,
      original_filename: m.originalFilename ?? null,
      mime_type: m.mimeType ?? null,
      file_size: m.fileSize ?? null,
      width: m.width ?? null,
      height: m.height ?? null,
      duration: m.duration ?? null,
      sort_order: m.sortOrder,
    })),
  )
  if (mediaError) {
    // Don't leave a half-published memory behind (authors may soft-delete their own).
    await supabase.from('g4u_memories').update({ deleted_at: new Date().toISOString() }).eq('id', memory.id)
    throw toMemoryError(mediaError)
  }
}

/** Published memories per year, for the cover's milestone previews. */
export async function fetchYearCounts(): Promise<Record<number, number>> {
  if (!supabase) return {}
  const { data, error } = await supabase
    .from('g4u_memories')
    .select('year')
    .eq('status', 'published')
    .is('deleted_at', null)
    .limit(5000)
  if (error) throw toMemoryError(error)
  const counts: Record<number, number> = {}
  for (const row of data as { year: number }[]) counts[row.year] = (counts[row.year] ?? 0) + 1
  return counts
}

export interface MemoryText {
  id: string
  year: number
  title: string | null
  content: string | null
  author: string | null
  memoryDate: string | null
  createdAt: string
  location: string | null
}

/**
 * The words of every published memory, text only, in the same order the 3D field places them
 * (year, then date, then creation time) so each one can be matched to its card.
 */
export async function fetchAllMemoryTexts(): Promise<MemoryText[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('g4u_memories')
    .select('id, year, title, content, author_name, memory_date, created_at, location')
    .eq('status', 'published')
    .is('deleted_at', null)
    .order('year', { ascending: true })
    .order('memory_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(5000)
  if (error) throw toMemoryError(error)
  return (data as Record<string, string | number | null>[]).map((r) => ({
    id: r.id as string,
    year: r.year as number,
    title: r.title as string | null,
    content: r.content as string | null,
    author: r.author_name as string | null,
    memoryDate: r.memory_date as string | null,
    createdAt: r.created_at as string,
    location: r.location as string | null,
  }))
}

export interface LikeState {
  count: number
  likedByMe: boolean
}

/** Everyone who has liked a memory, plus whether the current session is among them. */
export async function fetchLikeState(memoryId: string): Promise<LikeState> {
  if (!supabase) return { count: 0, likedByMe: false }
  const uid = (await supabase.auth.getSession()).data.session?.user.id
  const { data, error } = await supabase.from('g4u_memory_likes').select('user_id').eq('memory_id', memoryId)
  if (error) throw toMemoryError(error)
  const rows = (data ?? []) as { user_id: string }[]
  return { count: rows.length, likedByMe: !!uid && rows.some((r) => r.user_id === uid) }
}

/** Likes or unlikes as the current session (starting an anonymous one first if needed). */
export async function setLiked(memoryId: string, liked: boolean): Promise<void> {
  if (!supabase) throw new MemoryError('not_configured')
  const { user } = await ensureSession()
  if (liked) {
    const { error } = await supabase.from('g4u_memory_likes').insert({ memory_id: memoryId, user_id: user.id })
    // 23505 = unique_violation — already liked (a second tap, another tab): treat as success.
    if (error && (error as { code?: string }).code !== '23505') throw toMemoryError(error)
  } else {
    const { error } = await supabase.from('g4u_memory_likes').delete().eq('memory_id', memoryId).eq('user_id', user.id)
    if (error) throw toMemoryError(error)
  }
}

export interface MemoryComment {
  id: string
  memoryId: string
  userId: string | null
  authorName: string | null
  content: string
  createdAt: string
  /** Written by the current session — theirs to delete. */
  mine: boolean
}

function mapComment(row: Record<string, string | null>, uid: string | undefined): MemoryComment {
  return {
    id: row.id as string,
    memoryId: row.memory_id as string,
    userId: row.user_id,
    authorName: row.author_name,
    content: row.content as string,
    createdAt: row.created_at as string,
    mine: !!uid && row.user_id === uid,
  }
}

/** A memory's comments, oldest first. */
export async function fetchComments(memoryId: string): Promise<MemoryComment[]> {
  if (!supabase) return []
  const uid = (await supabase.auth.getSession()).data.session?.user.id
  const { data, error } = await supabase
    .from('g4u_memory_comments')
    .select('id, memory_id, user_id, author_name, content, created_at')
    .eq('memory_id', memoryId)
    .order('created_at', { ascending: true })
    .limit(300)
  if (error) throw toMemoryError(error)
  return (data as Record<string, string | null>[]).map((r) => mapComment(r, uid))
}

/** Posts a comment as the current session (starting an anonymous one first if needed). */
export async function addComment(memoryId: string, authorName: string, content: string): Promise<MemoryComment> {
  if (!supabase) throw new MemoryError('not_configured')
  const trimmedContent = content.trim().slice(0, 500)
  if (!trimmedContent) throw new MemoryError('unknown', 'empty comment')
  const { user } = await ensureSession()
  const { data, error } = await supabase
    .from('g4u_memory_comments')
    .insert({ memory_id: memoryId, user_id: user.id, author_name: authorName.trim().slice(0, 80) || null, content: trimmedContent })
    .select('id, memory_id, user_id, author_name, content, created_at')
    .single()
  if (error) throw toMemoryError(error)
  return mapComment(data as Record<string, string | null>, user.id)
}

/** Soft-deletes a comment — the author's own, or an admin's via the "admin all" policy. */
export async function deleteComment(commentId: string): Promise<void> {
  if (!supabase) throw new MemoryError('not_configured')
  const { error } = await supabase.from('g4u_memory_comments').update({ deleted_at: new Date().toISOString() }).eq('id', commentId)
  if (error) throw toMemoryError(error)
}
