const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be'])
const ID = /^[A-Za-z0-9_-]{11}$/

/** Extracts the video id from a YouTube link, or null if it isn't a valid one. */
export function parseYouTubeId(input: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (!HOSTS.has(url.hostname.toLowerCase())) return null

  let id: string | null = null
  if (url.hostname.toLowerCase().endsWith('youtu.be')) {
    id = url.pathname.split('/')[1] ?? null
  } else if (url.pathname === '/watch') {
    id = url.searchParams.get('v')
  } else {
    const [, kind, value] = url.pathname.split('/')
    if (['embed', 'shorts', 'live', 'v'].includes(kind)) id = value ?? null
  }
  return id && ID.test(id) ? id : null
}

export const youtubeThumbnail = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`

/**
 * Privacy-enhanced domain: no tracking cookies until the viewer presses play.
 * `muted` exists because a browser only allows an iframed player to autoplay with sound once
 * that specific frame has its own history of user interaction — unmuted autoplay from a tour
 * that never touched the frame directly is routinely blocked, muted autoplay always works.
 */
export const youtubeEmbedUrl = (id: string, autoplay = false, muted = false) =>
  `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1${autoplay ? '&autoplay=1' : ''}${muted ? '&mute=1' : ''}`
