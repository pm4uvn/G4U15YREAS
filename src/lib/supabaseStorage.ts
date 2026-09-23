import { supabase, isSupabaseConfigured } from './supabase'
import { MemoryError } from './g4uMemories'

export const BUCKET = 'g4u-memories'

export const LIMITS = {
  imageBytes: 10 * 1024 * 1024,
  maxImages: 20,
  maxVideos: 3,
  maxVoiceNotes: 3,
  /** A recording stops by itself at this length (the database allows up to 5 minutes). */
  maxVoiceSeconds: 180,
  audioBytes: 10 * 1024 * 1024,
}

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const MAX_IMAGE_SIDE = 2000
const THUMB_SIDE = 480

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
}

function extFor(blob: Blob): string {
  // Older Safari cannot encode WebP and silently returns PNG.
  return blob.type === 'image/webp' ? 'webp' : blob.type === 'image/png' ? 'png' : 'jpg'
}

function drawScaled(source: CanvasImageSource, w: number, h: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale))
  canvas.height = Math.max(1, Math.round(h * scale))
  canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

export interface ProcessedImage {
  blob: Blob
  ext: string
  width: number
  height: number
  thumb: Blob
}

/** Resize + re-encode to WebP client-side, and make a small thumbnail. */
export async function processImage(file: File): Promise<ProcessedImage> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new MemoryError('unsupported_file', `Cannot decode ${file.name}`)
  }
  try {
    const main = drawScaled(bitmap, bitmap.width, bitmap.height, MAX_IMAGE_SIDE)
    const thumbCanvas = drawScaled(bitmap, bitmap.width, bitmap.height, THUMB_SIDE)
    const [blob, thumb] = await Promise.all([canvasToBlob(main, 0.82), canvasToBlob(thumbCanvas, 0.75)])
    if (!blob || !thumb) throw new MemoryError('unsupported_file', 'Image encoding failed')
    return { blob, ext: extFor(blob), width: main.width, height: main.height, thumb }
  } finally {
    bitmap.close()
  }
}

/** Upload via XHR (supabase-js has no upload progress). 409 = already uploaded. */
export async function uploadObject(
  path: string,
  blob: Blob,
  contentType: string,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  if (!supabase || !isSupabaseConfigured) throw new MemoryError('not_configured', 'Supabase not configured')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new MemoryError('session', 'No session')

  const base = import.meta.env.VITE_SUPABASE_URL as string
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  const encoded = path.split('/').map(encodeURIComponent).join('/')

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${base}/storage/v1/object/${BUCKET}/${encoded}`)
    xhr.setRequestHeader('apikey', key)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('Content-Type', contentType)
    xhr.setRequestHeader('cache-control', 'max-age=31536000')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()
      if (xhr.status === 409) return resolve()
      if (xhr.status === 401 || xhr.status === 403) return reject(new MemoryError('session', xhr.responseText))
      if (xhr.status === 413) return reject(new MemoryError('file_too_large', xhr.responseText))
      reject(new MemoryError('upload_failed', `${xhr.status} ${xhr.responseText}`))
    }
    xhr.onerror = () => reject(new MemoryError('interrupted', 'network error'))
    xhr.onabort = () => reject(new MemoryError('cancelled', 'aborted'))
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    if (signal?.aborted) return reject(new MemoryError('cancelled', 'aborted'))
    xhr.send(blob)
  })
}

export async function removeObjects(paths: string[]): Promise<void> {
  if (!supabase || paths.length === 0) return
  await supabase.storage.from(BUCKET).remove(paths)
}

const SIGN_SECONDS = 3600
const signedCache = new Map<string, { url: string; expires: number }>()

/** Batch-sign private storage paths; results are cached until 5 min before expiry. */
export async function signPaths(paths: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  if (!supabase || paths.length === 0) return out
  const now = Date.now()
  const need = [...new Set(paths)].filter((p) => {
    const hit = signedCache.get(p)
    return !hit || hit.expires - now < 5 * 60 * 1000
  })
  if (need.length > 0) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(need, SIGN_SECONDS)
    if (error) throw error
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) {
        signedCache.set(item.path, { url: item.signedUrl, expires: now + SIGN_SECONDS * 1000 })
      }
    }
  }
  for (const p of paths) {
    const hit = signedCache.get(p)
    if (hit) out[p] = hit.url
  }
  return out
}
