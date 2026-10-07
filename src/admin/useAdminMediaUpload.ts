import { useCallback, useEffect, useRef, useState } from 'react'
import type { NewMediaInput } from '../lib/g4uMemories'
import { IMAGE_TYPES, LIMITS, processImage, removeObjects, uploadObject } from '../lib/supabaseStorage'
import { parseYouTubeId } from '../lib/youtube'
import type { UploadItem, VideoLink } from '../memories/hooks/useCreateMemory'
import { audioExtension, type Recording } from '../memories/hooks/useVoiceRecorder'
import type { MediaRow } from '../types/g4u-memory'
import { insertMedia } from './adminApi'

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * The admin edit screen's "add media" — same upload mechanics as the public add-memory form
 * (useCreateMemory), but appending to an EXISTING memory instead of minting a new one, so there's
 * no concurrency/retry queue to coordinate with a final memory insert: one admin, one file at a
 * time, uploaded straight into the memory's existing owner/id storage folder.
 */
export function useAdminMediaUpload(memoryId: string, authorUserId: string, startSortOrder: number) {
  const [items, setItems] = useState<UploadItem[]>([])
  const [videos, setVideos] = useState<VideoLink[]>([])

  const itemsRef = useRef<UploadItem[]>([])
  const videosRef = useRef<VideoLink[]>([])
  const seq = useRef(0)
  const chain = useRef<Promise<void>>(Promise.resolve())

  const commit = useCallback((next: UploadItem[]) => {
    itemsRef.current = next
    setItems(next)
  }, [])
  const patchItem = useCallback(
    (id: string, patch: Partial<UploadItem>) => {
      commit(itemsRef.current.map((it) => (it.id === id ? { ...it, ...patch } : it)))
    },
    [commit],
  )

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((it) => URL.revokeObjectURL(it.previewUrl))
    }
  }, [])

  const uploadOne = useCallback(
    async (item: UploadItem) => {
      const base = `${authorUserId}/${memoryId}`
      const n = pad(item.seq)
      patchItem(item.id, { status: 'processing', progress: 0, error: undefined })
      try {
        if (item.kind === 'audio') {
          const mime = item.file.type || 'audio/webm'
          const path = `${base}/voice-${n}.${audioExtension(mime)}`
          patchItem(item.id, { status: 'uploading', progress: 0 })
          await uploadObject(path, item.file, mime, (f) => patchItem(item.id, { progress: f }))
          patchItem(item.id, {
            status: 'done',
            progress: 1,
            result: {
              mediaType: 'audio',
              storagePath: path,
              thumbnailPath: null,
              originalFilename: item.file.name,
              mimeType: mime,
              fileSize: item.file.size,
              duration: Math.max(0.5, Math.min(item.seconds ?? 1, 300)),
            },
          })
          return
        }
        const img = await processImage(item.file)
        const mainPath = `${base}/photo-${n}.${img.ext}`
        const thumbPath = `${base}/thumb-photo-${n}.webp`
        patchItem(item.id, { status: 'uploading', progress: 0 })
        await uploadObject(mainPath, img.blob, img.blob.type, (f) => patchItem(item.id, { progress: f }))
        await uploadObject(thumbPath, img.thumb, img.thumb.type || 'image/webp')
        patchItem(item.id, {
          status: 'done',
          progress: 1,
          result: {
            mediaType: 'image',
            storagePath: mainPath,
            thumbnailPath: thumbPath,
            originalFilename: item.file.name,
            mimeType: img.blob.type,
            fileSize: img.blob.size,
            width: img.width,
            height: img.height,
          },
        })
      } catch (err) {
        patchItem(item.id, { status: 'error', error: err instanceof Error ? err.message : 'Tải lên thất bại.' })
      }
    },
    [authorUserId, memoryId, patchItem],
  )

  const runUploads = useCallback(() => {
    chain.current = chain.current.catch(() => undefined).then(async () => {
      for (const it of itemsRef.current) {
        const current = itemsRef.current.find((x) => x.id === it.id)
        if (current?.status === 'queued') await uploadOne(current)
      }
    })
    return chain.current
  }, [uploadOne])

  const addFiles = useCallback(
    (files: File[]): string[] => {
      const rejected: string[] = []
      const next = [...itemsRef.current]
      for (const file of files) {
        if (!IMAGE_TYPES.includes(file.type)) {
          rejected.push(`${file.name}: định dạng chưa được hỗ trợ (chỉ nhận ảnh JPG, PNG, WebP).`)
          continue
        }
        if (file.size > LIMITS.imageBytes) {
          rejected.push(`${file.name}: vượt quá ${LIMITS.imageBytes / 1024 / 1024} MB.`)
          continue
        }
        if (next.filter((i) => i.kind === 'image').length >= LIMITS.maxImages) {
          rejected.push(`${file.name}: tối đa ${LIMITS.maxImages} ảnh cho mỗi kỷ niệm.`)
          continue
        }
        next.push({
          id: crypto.randomUUID(),
          kind: 'image',
          seq: ++seq.current,
          file,
          status: 'queued',
          progress: 0,
          previewUrl: URL.createObjectURL(file),
        })
      }
      commit(next)
      void runUploads()
      return rejected
    },
    [commit, runUploads],
  )

  const addVoice = useCallback(
    (recording: Recording): string | null => {
      if (itemsRef.current.filter((i) => i.kind === 'audio').length >= LIMITS.maxVoiceNotes)
        return `Tối đa ${LIMITS.maxVoiceNotes} đoạn ghi âm cho mỗi kỷ niệm.`
      if (recording.blob.size > LIMITS.audioBytes) return 'Đoạn ghi âm quá dài. Hãy ghi ngắn hơn.'
      const file = new File([recording.blob], `ghi-am.${audioExtension(recording.mime)}`, { type: recording.mime })
      commit([
        ...itemsRef.current,
        {
          id: crypto.randomUUID(),
          kind: 'audio',
          seconds: recording.seconds,
          seq: ++seq.current,
          file,
          status: 'queued',
          progress: 0,
          previewUrl: URL.createObjectURL(file),
        },
      ])
      void runUploads()
      return null
    },
    [commit, runUploads],
  )

  const removeItem = useCallback(
    (id: string) => {
      const target = itemsRef.current.find((i) => i.id === id)
      if (target) {
        URL.revokeObjectURL(target.previewUrl)
        const paths = [target.result?.storagePath, target.result?.thumbnailPath].filter(Boolean) as string[]
        if (paths.length > 0) void removeObjects(paths)
      }
      commit(itemsRef.current.filter((i) => i.id !== id))
    },
    [commit],
  )

  const retryUploads = useCallback(() => {
    commit(itemsRef.current.map((it) => (it.status === 'error' ? { ...it, status: 'queued', error: undefined, progress: 0 } : it)))
    void runUploads()
  }, [commit, runUploads])

  const addVideoLink = useCallback((raw: string): string | null => {
    const videoId = parseYouTubeId(raw)
    if (!videoId) return 'Đây chưa phải link YouTube hợp lệ (ví dụ: https://youtu.be/…).'
    if (videosRef.current.some((v) => v.videoId === videoId)) return 'Video này đã được thêm.'
    if (videosRef.current.length >= LIMITS.maxVideos) return `Tối đa ${LIMITS.maxVideos} video cho mỗi kỷ niệm.`
    const next = [...videosRef.current, { id: crypto.randomUUID(), videoId, url: raw.trim() }]
    videosRef.current = next
    setVideos(next)
    return null
  }, [])

  const removeVideo = useCallback((id: string) => {
    const next = videosRef.current.filter((v) => v.id !== id)
    videosRef.current = next
    setVideos(next)
  }, [])

  const hasPending = items.length > 0 || videos.length > 0

  /** Waits for any uploads still running, then writes everything finished as new media on the memory. */
  const commitMedia = useCallback(async (): Promise<MediaRow[]> => {
    await runUploads()
    await chain.current
    const unfinished = itemsRef.current.find((it) => it.status !== 'done' || !it.result)
    if (unfinished) throw new Error(unfinished.error ?? 'Ảnh hoặc ghi âm chưa tải lên xong. Hãy thử lại.')

    const photos: NewMediaInput[] = itemsRef.current.map((it, i) => ({ ...it.result!, sortOrder: startSortOrder + i }))
    const clips: NewMediaInput[] = videosRef.current.map((v, i) => ({
      mediaType: 'video',
      storagePath: null,
      thumbnailPath: null,
      provider: 'youtube',
      externalId: v.videoId,
      sortOrder: startSortOrder + photos.length + i,
    }))
    if (photos.length === 0 && clips.length === 0) return []

    const rows = await insertMedia(memoryId, [...photos, ...clips])
    commit([])
    videosRef.current = []
    setVideos([])
    return rows
  }, [commit, memoryId, runUploads, startSortOrder])

  return { items, videos, hasPending, addFiles, addVoice, removeItem, addVideoLink, removeVideo, retryUploads, commitMedia }
}
