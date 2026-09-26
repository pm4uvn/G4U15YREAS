import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { BUCKET } from '../lib/supabaseStorage'
import type { MediaRow, MemoryRow, MemoryStatus, MemoryVisibility } from '../types/g4u-memory'

export const PAGE_SIZE = 20

export interface AdminMemory extends MemoryRow {
  deleted_at: string | null
  updated_at: string
}

export interface AdminFilters {
  year: number | 'all'
  status: MemoryStatus | 'all'
  trash: 'active' | 'deleted'
  query: string
  page: number
}

export interface MemoryPatch {
  title: string | null
  content: string | null
  author_name: string | null
  location: string | null
  memory_date: string | null
  year: number
  status: MemoryStatus
  visibility: MemoryVisibility
}

function client() {
  if (!supabase) throw new Error('Supabase chưa được cấu hình (thiếu VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
  return supabase
}

/** Client-side check for showing the right screen; the database enforces the same rule with RLS. */
export function hasAdminRole(session: Session | null): boolean {
  return session?.user.app_metadata?.role === 'admin'
}

export async function signIn(email: string, password: string): Promise<Session> {
  const { data, error } = await client().auth.signInWithPassword({ email, password })
  if (error || !data.session) throw new Error('Email hoặc mật khẩu không đúng.')
  return data.session
}

export async function signOut() {
  await client().auth.signOut()
}

export async function currentSession(): Promise<Session | null> {
  const { data } = await client().auth.getSession()
  return data.session
}

export async function listMemories(f: AdminFilters): Promise<{ rows: AdminMemory[]; total: number }> {
  let q = client()
    .from('g4u_memories')
    .select('*, g4u_memory_media(*)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(f.page * PAGE_SIZE, f.page * PAGE_SIZE + PAGE_SIZE - 1)
  q = f.trash === 'deleted' ? q.not('deleted_at', 'is', null) : q.is('deleted_at', null)
  if (f.year !== 'all') q = q.eq('year', f.year)
  if (f.status !== 'all') q = q.eq('status', f.status)
  // Commas, parentheses and wildcards would break the PostgREST filter grammar.
  const text = f.query.replace(/[,()%*\\]/g, ' ').trim()
  if (text) q = q.or(`title.ilike.%${text}%,content.ilike.%${text}%,author_name.ilike.%${text}%`)
  const { data, error, count } = await q
  if (error) throw new Error(error.message)
  return { rows: (data ?? []) as AdminMemory[], total: count ?? 0 }
}

export async function updateMemory(id: string, patch: MemoryPatch) {
  // `.select()` forces PostgREST to report which rows actually matched — without it, a write RLS
  // silently blocks (wrong role, stale session) returns success with nothing changed, and the
  // person editing sees no error and no effect, which reads as "it just didn't save".
  const { data, error } = await client().from('g4u_memories').update(patch).eq('id', id).select('id')
  if (error) throw new Error(error.message)
  if (!data || data.length === 0) {
    throw new Error('Không lưu được — có thể phiên quản trị đã hết hạn. Hãy đăng xuất rồi đăng nhập lại.')
  }
}

export async function setDeleted(id: string, deleted: boolean) {
  const { error } = await client()
    .from('g4u_memories')
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

function storedPaths(media: MediaRow[]): string[] {
  return media.flatMap((m) => [m.storage_path, m.thumbnail_path]).filter((p): p is string => !!p)
}

/** Removes the memory, its media rows (cascade) and the files behind them. */
export async function deleteForever(row: AdminMemory) {
  const db = client()
  const paths = storedPaths(row.g4u_memory_media ?? [])
  const { error } = await db.from('g4u_memories').delete().eq('id', row.id)
  if (error) throw new Error(error.message)
  if (paths.length > 0) await db.storage.from(BUCKET).remove(paths)
}

export async function deleteMedia(media: MediaRow) {
  const db = client()
  const { error } = await db.from('g4u_memory_media').delete().eq('id', media.id)
  if (error) throw new Error(error.message)
  const paths = storedPaths([media])
  if (paths.length > 0) await db.storage.from(BUCKET).remove(paths)
}

export interface AdminComment {
  id: string
  authorName: string | null
  content: string
  createdAt: string
}

/** A memory's live (not soft-deleted) comments, for moderation. */
export async function listComments(memoryId: string): Promise<AdminComment[]> {
  const { data, error } = await client()
    .from('g4u_memory_comments')
    .select('id, author_name, content, created_at')
    .eq('memory_id', memoryId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({ id: r.id, authorName: r.author_name, content: r.content, createdAt: r.created_at }))
}

/** Permanently removes a comment (the "admin all" policy allows a hard delete; authors only soft-delete their own). */
export async function deleteCommentAdmin(id: string) {
  const { error } = await client().from('g4u_memory_comments').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
