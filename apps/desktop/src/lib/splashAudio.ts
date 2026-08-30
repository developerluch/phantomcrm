// Synthesized whoosh/swell played on splash mount.
// No binary asset — built from white noise + low-pass sweep + cosine envelope
// via the Web Audio API. Mute preference persisted in localStorage.

const MUTE_KEY = 'phantom:splashMuted'
const DURATION_S = 1.4
const PEAK_GAIN = 0.18
const FILTER_START_HZ = 2000
const FILTER_END_HZ = 400

let audioContext: AudioContext | null = null
let activeGain: GainNode | null = null
let activeSource: AudioBufferSourceNode | null = null

function getContext(): AudioContext | null {
  if (audioContext) return audioContext
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    audioContext = new Ctor()
    return audioContext
  } catch {
    return null
  }
}

export function getSplashMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function setSplashMuted(muted: boolean): void {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // ignore — quota or denied access
  }
  if (muted) stopSplashSwell()
}

export function playSplashSwell(): void {
  if (getSplashMuted()) return
  const ctx = getContext()
  if (!ctx) return

  try {
    const sampleRate = ctx.sampleRate
    const noiseLen = Math.floor(sampleRate * (DURATION_S + 0.1))
    const noise = ctx.createBuffer(1, noiseLen, sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < noiseLen; i++) data[i] = Math.random() * 2 - 1

    const source = ctx.createBufferSource()
    source.buffer = noise

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.Q.value = 0.7

    const gain = ctx.createGain()

    const now = ctx.currentTime
    filter.frequency.setValueAtTime(FILTER_START_HZ, now)
    filter.frequency.exponentialRampToValueAtTime(FILTER_END_HZ, now + DURATION_S)

    // Cosine half-wave envelope across the full duration: 0 → peak → 0
    const samples = 64
    const curve = new Float32Array(samples)
    for (let i = 0; i < samples; i++) {
      const t = i / (samples - 1)
      curve[i] = PEAK_GAIN * (0.5 - 0.5 * Math.cos(t * Math.PI * 2))
    }
    gain.gain.setValueAtTime(0, now)
    gain.gain.setValueCurveAtTime(curve, now, DURATION_S)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    source.start(now)
    source.stop(now + DURATION_S + 0.05)

    activeGain = gain
    activeSource = source

    source.onended = () => {
      if (activeSource === source) {
        activeSource = null
        activeGain = null
      }
    }
  } catch {
    // autoplay-policy rejection or unsupported environment — never crash boot
  }
}

export function stopSplashSwell(): void {
  const ctx = audioContext
  if (!ctx) return
  try {
    if (activeGain) {
      const now = ctx.currentTime
      activeGain.gain.cancelScheduledValues(now)
      activeGain.gain.setValueAtTime(activeGain.gain.value, now)
      activeGain.gain.linearRampToValueAtTime(0, now + 0.02)
    }
    if (activeSource) {
      try {
        activeSource.stop(ctx.currentTime + 0.05)
      } catch {
        // already stopped
      }
    }
  } catch {
    // ignore
  }
  activeGain = null
  activeSource = null
}
