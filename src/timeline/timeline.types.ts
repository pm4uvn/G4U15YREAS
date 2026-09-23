export type MemoryMediaType =
  | 'image'
  | 'video'
  | 'polaroid'
  | 'poster'
  | 'ticket'
  | 'note'
  | 'pick'
  | 'cassette'
  | 'vinyl'

export interface MemoryMedia {
  type: MemoryMediaType
  src: string
  poster?: string
  caption?: string
}

export interface YearEntry {
  year: number
  title: string
  subtitle: string
  quote: string
  media: MemoryMedia[]
}
