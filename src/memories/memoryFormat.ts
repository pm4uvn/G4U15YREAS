import type { G4UMemory, G4UMemoryMedia } from '../types/g4u-memory'

/** The first photo or video — what a memory looks like. Voice notes are heard, not shown. */
export function firstVisual(memory: G4UMemory): G4UMemoryMedia | undefined {
  return memory.media.find((m) => m.mediaType !== 'audio')
}

export function voiceNotes(memory: G4UMemory): G4UMemoryMedia[] {
  return memory.media.filter((m) => m.mediaType === 'audio')
}

export function memoryDateLabel(m: G4UMemory): string {
  const raw = m.memoryDate ?? m.createdAt
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return String(m.year)
  // A bare year-only feel when only the year is known.
  return m.memoryDate
    ? d.toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' })
    : String(m.year)
}

export function memoryExcerpt(m: G4UMemory, max = 120): string {
  const text = (m.title ?? m.content ?? '').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max).trimEnd()}…`
}
