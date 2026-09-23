/**
 * Procedural ambient pad — a placeholder for the real per-year guitar audio
 * planned for Phase 2. Synthesized entirely with the Web Audio API rather
 * than a shipped file, so there's no licensing/sourcing question for a
 * placeholder sound and nothing to fetch.
 *
 * Voiced as a spread E-minor guitar chord (E2 B2 E3 G3 B3) — the open-ish
 * shape a guitarist would actually ring out — run through a slowly
 * modulated lowpass filter and a short feedback delay for width.
 */
const CHORD_FREQUENCIES = [82.41, 123.47, 164.81, 196.0, 246.94] // E2 B2 E3 G3 B3
const FADE_SECONDS = 2.5
const TARGET_GAIN = 0.16

let ctx: AudioContext | null = null
let masterGain: GainNode | null = null
let filter: BiquadFilterNode | null = null
let built = false

function ensureContext(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new Ctor()
  }
  return ctx
}

function buildGraph(context: AudioContext) {
  masterGain = context.createGain()
  masterGain.gain.value = 0

  filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 900
  filter.Q.value = 0.6

  // A slow LFO on the filter cutoff gives the pad a gentle "breathing" motion.
  const lfo = context.createOscillator()
  lfo.frequency.value = 0.05
  const lfoGain = context.createGain()
  lfoGain.gain.value = 220
  lfo.connect(lfoGain)
  lfoGain.connect(filter.frequency)
  lfo.start()

  const delay = context.createDelay(2)
  delay.delayTime.value = 0.55
  const feedback = context.createGain()
  feedback.gain.value = 0.26
  delay.connect(feedback)
  feedback.connect(delay)

  CHORD_FREQUENCIES.forEach((freq, i) => {
    const osc = context.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = freq
    // Slight per-voice detune gives the chord a warm, chorused width.
    osc.detune.value = (i % 2 === 0 ? -1 : 1) * (4 + i * 1.5)

    const voiceGain = context.createGain()
    voiceGain.gain.value = 1 / CHORD_FREQUENCIES.length

    osc.connect(voiceGain)
    voiceGain.connect(filter!)
    osc.start()
  })

  filter.connect(masterGain)
  filter.connect(delay)
  delay.connect(masterGain)
  masterGain.connect(context.destination)
}

export function startAmbient() {
  const context = ensureContext()
  if (context.state === 'suspended') void context.resume()
  if (!built) {
    buildGraph(context)
    built = true
  }
  const now = context.currentTime
  masterGain!.gain.cancelScheduledValues(now)
  masterGain!.gain.setValueAtTime(masterGain!.gain.value, now)
  masterGain!.gain.linearRampToValueAtTime(TARGET_GAIN, now + FADE_SECONDS)
}

export function stopAmbient() {
  if (!ctx || !masterGain) return
  const now = ctx.currentTime
  masterGain.gain.cancelScheduledValues(now)
  masterGain.gain.setValueAtTime(masterGain.gain.value, now)
  masterGain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS)
}
