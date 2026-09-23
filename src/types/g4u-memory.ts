export type MemoryVisibility = 'public' | 'members'
export type MemoryStatus = 'draft' | 'pending' | 'published' | 'hidden' | 'rejected'
export type MemoryMediaKind = 'image' | 'video' | 'audio'

export interface UserProfile {
  displayName: string
  avatarUrl?: string
}

export interface G4UMemoryMedia {
  id: string
  memoryId: string
  mediaType: MemoryMediaKind
  /** Images only; YouTube videos have no stored file. */
  storagePath?: string
  thumbnailPath?: string
  /** YouTube videos only. */
  provider?: 'youtube'
  externalId?: string
  mimeType?: string
  fileSize?: number
  width?: number
  height?: number
  duration?: number
  sortOrder: number
}

export interface G4UMemory {
  id: string
  userId: string | null
  year: number
  title: string | null
  content: string | null
  memoryDate?: string
  location?: string
  visibility: MemoryVisibility
  status: MemoryStatus
  media: G4UMemoryMedia[]
  author?: UserProfile
  createdAt: string
  /** Signed URL of the first media's thumbnail; client-side only. */
  coverUrl?: string
}

/** Row shapes as returned by PostgREST (snake_case). */
export interface MemoryRow {
  id: string
  user_id: string | null
  author_name: string | null
  year: number
  title: string | null
  content: string | null
  memory_date: string | null
  location: string | null
  visibility: MemoryVisibility
  status: MemoryStatus
  created_at: string
  g4u_memory_media?: MediaRow[]
}

export interface MediaRow {
  id: string
  memory_id: string
  media_type: MemoryMediaKind
  storage_path: string | null
  thumbnail_path: string | null
  provider: 'youtube' | null
  external_id: string | null
  mime_type: string | null
  file_size: number | null
  width: number | null
  height: number | null
  duration: number | null
  sort_order: number
}
