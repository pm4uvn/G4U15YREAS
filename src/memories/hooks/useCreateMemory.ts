import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ensureSession,
  insertMemory,
  toMemoryError,
  type NewMediaInput,
} from '../../lib/g4uMemories'
import { IMAGE_TYPES, LIMITS, processImage, removeObjects, uploadObject } from '../../lib/supabaseStorage'
import { parseYouTubeId } from '../../lib/youtube'
import type { MemoryVisibility } from '../../types/g4u-memory'
import { refreshJourneyCounts } from '../../timeline/journey'
import { reloadYear } from './useMemoriesByYear'
import { audioExtension, type Recording } from './useVoiceRecorder'

export type UploadStatus = 'queued' | 'processing' | 'uploading' | 'done' | 'error'

export interface UploadItem {
  id: string
  kind: 'image' | 'audio'
  /** Length of a voice note, in seconds. */
  seconds?: number
  /** Stable number used in the stored file name (photo-01, photo-02, …); never reused after a removal. */
  seq: number
  file: File
  status: UploadStatus
  progress: number
  error?: string
  previewUrl: string
  result?: Omit<NewMediaInput, 'sortOrder'>
}

/** A YouTube video attached by link — nothing is uploaded for these. */
export interface VideoLink {
  id: string
  videoId: string
  url: string
}

export interface MemoryFormValues {
  authorName: string
  title: string
  content: string
  memoryDate: string
  location: string
  visibility: MemoryVisibility
}

export type SubmitState = 'idle' | 'submitting' | 'success'

const pad = (n: number) => String(n).padStart(2, '0')
const CONCURRENCY = 2

export function useCreateMemory(year: number) {
  const [items, setItems] = useState<UploadItem[]>([])
  const [videos, setVideos] = useState<VideoLink[]>([])
  const [state, setState] = useState<SubmitState>('idle')
  const [error, setError] = useState<string | null>(null)

  const itemsRef = useRef<UploadItem[]>([])
  const videosRef = useRef<VideoLink[]>([])
  const memoryId = useRef(crypto.randomUUID())
  const seq = useRef(0)
  const controller = useRef<AbortController | null>(null)
  /** Uploads run one batch at a time so two batches never pick up the same photo. */
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

  const signal = useCallback(() => {
    controller.current ??= new AbortController()
    return controller.current.signal
  }, [])

  useEffect(() => {
    return () => {
      controller.current?.abort()
      itemsRef.current.forEach((it) => URL.revokeObjectURL(it.previewUrl))
    }
  }, [])

  const uploadItem = useCallback(
    async (item: UploadItem, userId: string, abortSignal: AbortSignal) => {
      patchItem(item.id, { status: 'processing', progress: 0, error: undefined })
      try {
        const base = `${userId}/${memoryId.current}`
        const n = pad(item.seq)

        if (item.kind === 'audio') {
          const mime = item.file.type || 'audio/webm'
          const path = `${base}/voice-${n}.${audioExtension(mime)}`
          patchItem(item.id, { status: 'uploading' })
          await uploadObject(path, item.file, mime, (f) => patchItem(item.id, { progress: f }), abortSignal)
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
        patchItem(item.id, { status: 'uploading' })
        await uploadObject(mainPath, img.blob, img.blob.type, (f) => patchItem(item.id, { progress: f }), abortSignal)
        await uploadObject(thumbPath, img.thumb, img.thumb.type || 'image/webp', undefined, abortSignal)
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
        const e = toMemoryError(err)
        if (e.code !== 'cancelled') console.error('[g4u] upload failed', item.file.name, e.detail ?? e)
        patchItem(item.id, { status: 'error', error: e.userMessage })
      }
    },
    [patchItem],
  )

  /**
   * Uploads every photo/recording that is still waiting. It never throws: anything that goes wrong is
   * written onto the affected items, so one bad batch cannot block the ones that follow.
   */
  const uploadWaiting = useCallback(async () => {
    const pending = itemsRef.current.filter((it) => it.status === 'queued')
    if (pending.length === 0) return
    const failAll = (err: unknown, what: string) => {
      const e = toMemoryError(err)
      console.error(`[g4u] ${what}`, e.detail ?? e)
      for (const it of pending) {
        const current = itemsRef.current.find((x) => x.id === it.id)
        if (current && current.status !== 'done') patchItem(it.id, { status: 'error', error: e.userMessage })
      }
    }
    try {
      let userId: string
      try {
        userId = (await ensureSession()).user.id
      } catch (err) {
        failAll(err, 'could not start an upload session')
        return
      }
      const abortSignal = signal()
      let cursor = 0
      const worker = async () => {
        while (cursor < pending.length && !abortSignal.aborted) {
          const it = itemsRef.current.find((x) => x.id === pending[cursor++].id)
          if (it && it.status === 'queued') await uploadItem(it, userId, abortSignal)
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker))
    } catch (err) {
      failAll(err, 'upload batch failed')
    }
  }, [patchItem, signal, uploadItem])

  const runUploads = useCallback(() => {
    // `.catch` keeps one failed batch from poisoning every later one.
    chain.current = chain.current.catch(() => undefined).then(uploadWaiting)
    return chain.current
  }, [uploadWaiting])

  /** Validates each photo, then starts uploading right away; returns rejections for the ones dropped. */
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

  /** Adds a finished recording as a voice note and starts uploading it. Returns an error message, or null. */
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
        // A photo that already reached storage but is no longer wanted should not be left behind.
        const paths = [target.result?.storagePath, target.result?.thumbnailPath].filter(Boolean) as string[]
        if (paths.length > 0) void removeObjects(paths)
      }
      commit(itemsRef.current.filter((i) => i.id !== id))
    },
    [commit],
  )

  /** Put failed photos back in the queue and try them again. */
  const retryUploads = useCallback(() => {
    commit(itemsRef.current.map((it) => (it.status === 'error' ? { ...it, status: 'queued', error: undefined, progress: 0 } : it)))
    void runUploads()
  }, [commit, runUploads])

  /** Returns an error message, or null when the link was accepted. */
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

  /** Waits for any photos still uploading, then writes the memory. Safe to call again to retry. */
  const submit = useCallback(
    async (values: MemoryFormValues) => {
      setError(null)
      const title = values.title.trim() || null
      const content = values.content.trim() || null
      if (!title && !content && itemsRef.current.length === 0 && videosRef.current.length === 0) {
        setError('Hãy viết vài dòng hoặc thêm ít nhất một ảnh/video.')
        return
      }
      if (!values.authorName.trim()) {
        setError('Hãy cho chúng tôi biết tên của bạn.')
        return
      }

      setState('submitting')
      try {
        const session = await ensureSession()
        const userId = session.user.id

        // Photos start uploading when chosen; retry any that failed, then wait for the rest.
        commit(itemsRef.current.map((it) => (it.status === 'error' ? { ...it, status: 'queued', error: undefined, progress: 0 } : it)))
        await runUploads()
        await chain.current

        if (controller.current?.signal.aborted) {
          setState('idle')
          return
        }
        // Every photo and recording must have reached storage before the memory is written.
        const unfinished = itemsRef.current.find((it) => it.status !== 'done' || !it.result)
        if (unfinished) {
          setError(unfinished.error ?? 'Ảnh hoặc ghi âm chưa tải lên xong. Hãy thử lại.')
          setState('idle')
          return
        }

        const photos: NewMediaInput[] = itemsRef.current.map((it, index) => ({ ...it.result!, sortOrder: index }))
        const clips: NewMediaInput[] = videosRef.current.map((v, index) => ({
          mediaType: 'video',
          storagePath: null,
          thumbnailPath: null,
          provider: 'youtube',
          externalId: v.videoId,
          sortOrder: photos.length + index,
        }))
        try {
          await insertMemory(
            {
              id: memoryId.current,
              userId,
              authorName: values.authorName.trim(),
              year,
              title,
              content,
              memoryDate: values.memoryDate || null,
              location: values.location.trim() || null,
              visibility: values.visibility,
            },
            [...photos, ...clips],
          )
        } catch (err) {
          void removeObjects(photos.flatMap((m) => [m.storagePath, m.thumbnailPath].filter(Boolean) as string[]))
          memoryId.current = crypto.randomUUID()
          // Uploaded files were cleaned up, so they must be sent again on retry.
          commit(itemsRef.current.map((it) => ({ ...it, status: 'queued', progress: 0, result: undefined })))
          throw err
        }

        await reloadYear(year)
        // The strings lengthen if this year now holds more memories than fit.
        void refreshJourneyCounts()
        setState('success')
      } catch (err) {
        const e = toMemoryError(err)
        console.error('[g4u] could not share memory', e.detail ?? e)
        setError(e.userMessage)
        setState('idle')
      }
    },
    [commit, runUploads, year],
  )

  const cancel = useCallback(() => {
    controller.current?.abort()
    controller.current = null
  }, [])

  return { items, videos, state, error, addFiles, addVoice, removeItem, addVideoLink, removeVideo, retryUploads, submit, cancel }
}
