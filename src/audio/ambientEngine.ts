/**
 * Background music: a looping acoustic guitar track, faded in/out around the mute toggle. Nothing
 * is fetched until the first tap — browsers require playback to start from a real user gesture
 * anyway, so there is no benefit to loading it any earlier.
 */
const TRACK_URL = '/audio/alex-morgan-acoustic-guitar-sunrise-travel-573651.mp3'
const FADE_SECONDS = 2.5
const TARGET_GAIN = 0.5

let ctx: AudioContext | null = null
let gain: GainNode | null = null
let element: HTMLAudioElement | null = null
let built = false

function ensureContext(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new Ctor()
  }
  return ctx
}

function buildGraph(context: AudioContext) {
  element = new Audio(TRACK_URL)
  element.loop = true
  element.preload = 'auto'

  gain = context.createGain()
  gain.gain.value = 0
  context.createMediaElementSource(element).connect(gain)
  gain.connect(context.destination)
}

export function startAmbient() {
  const context = ensureContext()
  if (context.state === 'suspended') void context.resume()
  if (!built) {
    buildGraph(context)
    built = true
  }
  void element!.play().catch((err) => console.warn('[g4u] could not start the background music', err))

  const now = context.currentTime
  gain!.gain.cancelScheduledValues(now)
  gain!.gain.setValueAtTime(gain!.gain.value, now)
  gain!.gain.linearRampToValueAtTime(TARGET_GAIN, now + FADE_SECONDS)
}

export function stopAmbient() {
  if (!ctx || !gain || !element) return
  const now = ctx.currentTime
  gain.gain.cancelScheduledValues(now)
  gain.gain.setValueAtTime(gain.gain.value, now)
  gain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS)
  // Actually pause once silent, so a muted track isn't still decoding in the background.
  window.setTimeout(() => element?.pause(), FADE_SECONDS * 1000 + 100)
}
