import { supabase } from './supabase'
import { ensureSession, MemoryError, toMemoryError } from './g4uMemories'

export interface BirthdayWish {
  id: string
  authorName: string | null
  message: string
  createdAt: string
}

function mapWish(row: Record<string, string | null>): BirthdayWish {
  return { id: row.id as string, authorName: row.author_name, message: row.message as string, createdAt: row.created_at as string }
}

/** Every birthday wish, newest first. */
export async function fetchWishes(): Promise<BirthdayWish[]> {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('g4u_birthday_wishes')
    .select('id, author_name, message, created_at')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw toMemoryError(error)
  return (data as Record<string, string | null>[]).map(mapWish)
}

/** Posts a birthday wish as the current session (starting an anonymous one first if needed). */
export async function addWish(authorName: string, message: string): Promise<BirthdayWish> {
  if (!supabase) throw new MemoryError('not_configured')
  const trimmed = message.trim().slice(0, 300)
  if (!trimmed) throw new MemoryError('unknown', 'empty wish')
  const { user } = await ensureSession()
  const { data, error } = await supabase
    .from('g4u_birthday_wishes')
    .insert({ user_id: user.id, author_name: authorName.trim().slice(0, 80) || null, message: trimmed })
    .select('id, author_name, message, created_at')
    .single()
  if (error) throw toMemoryError(error)
  return mapWish(data as Record<string, string | null>)
}
