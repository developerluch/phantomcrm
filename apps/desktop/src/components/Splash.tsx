import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useIsPresent } from 'framer-motion'
import { IconVolume, IconVolumeOff } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { AmbientParticles } from '@/components/brand/AmbientParticles'
import { PhantomMark } from '@/components/brand/PhantomMark'
import {
  playSplashSwell,
  stopSplashSwell,
  getSplashMuted,
  setSplashMuted,
} from '@/lib/splashAudio'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'

const WORDMARK = 'PHANTOMCRM'

// Cycling status labels under the loading bar. Sentence-case, plain
// sans-serif — not a terminal/CLI aesthetic. The last phrase holds
// until the splash exits (no looping back to the first), so the read
// is "Loading… Loading… Loading… ready" rather than an indefinite spin.
const LOADER_PHRASES = [
  'Loading APIs',
  'Loading backend',
  'Loading workspace',
] as const
// 280ms per phrase — fast enough to feel active during the loader's
// visible window, slow enough to read each phrase. Last phrase pins.
const LOADER_PHRASE_MS = 280

export function Splash() {
  const [muted, setMuted] = useState(getSplashMuted)
  const reduced = usePrefersReducedMotion()
  // Cycling phrase index for the loader label. Under reduced motion
  // we pin to the last phrase ("Loading workspace") immediately — no
  // swap animation. See the cycling effect below.
  const [phraseIdx, setPhraseIdx] = useState(0)
  // useIsPresent() returns false the moment AnimatePresence triggers
  // this component's exit. We use that to drop the particle field to
  // count=0 immediately on exit so 12 transform-animation loops don't
  // keep running invisibly underneath the fading splash for the full
  // 800ms exit duration.
  const isPresent = useIsPresent()

  // Per-letter random y-offset for the stage-2 glitch-out exit. Stable
  // across renders so the same letters always nudge the same direction.
  const wordmarkExitYs = useMemo(
    () => WORDMARK.split('').map(() => (Math.random() - 0.5) * 4),
    [],
  )

  useEffect(() => {
    if (reduced) return
    playSplashSwell()
    return () => stopSplashSwell()
  }, [reduced])

  // Cycle the loader phrase until we reach the last one, then pin.
  // Under reduced motion, jump straight to the last phrase — the swap
  // animation itself is the reason to skip cycling, not the cadence.
  useEffect(() => {
    if (reduced) {
      setPhraseIdx(LOADER_PHRASES.length - 1)
      return
    }
    if (phraseIdx >= LOADER_PHRASES.length - 1) return
    const t = window.setTimeout(
      () => setPhraseIdx((i) => i + 1),
      LOADER_PHRASE_MS,
    )
    return () => window.clearTimeout(t)
  }, [phraseIdx, reduced])

  function toggleMute() {
    const next = !muted
    setMuted(next)
    setSplashMuted(next)
  }

  return (
    <motion.div
      className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 1 }}
      exit={
        reduced
          ? {
              opacity: 0,
              // CRITICAL: drop pointer events the instant exit begins so the
              // fixed inset-0 z-[9999] splash never intercepts clicks aimed
              // at the auth surface bleeding in underneath. Without this,
              // any failure of onExitComplete to fire leaves the invisible
              // splash sitting in DOM and silently swallowing every click.
              pointerEvents: 'none',
              transition: { duration: 0.2, ease: 'easeOut' },
            }
          : {
              // 800ms total exit. bg-black holds full opacity through the
              // first 560ms (70%) so stage 1 children (halo, particles,
              // dots — 0–200ms) and stage 2 wordmark glitch (100–500ms)
              // both fully complete BEFORE the cross-fade begins. Then
              // 240ms (560–800ms) of bg fade-out lets the underlying
              // login surface bleed in as the ghost is mid-spring on its
              // layoutId morph. Previously held only 304ms (38%), causing
              // double-darkening as the wordmark glitch was still running
              // while the bg started fading.
              opacity: [1, 1, 0],
              // CRITICAL: see reduced branch above. pointerEvents flips to
              // 'none' as a step change the moment exit starts, so even if
              // onExitComplete misfires and the splash lingers in DOM
              // (documented fragility in project_splash_arrival_signal_fragility.md),
              // it cannot block clicks on the form once splashGone fires.
              pointerEvents: 'none',
              transition: { duration: 0.8, times: [0, 0.7, 1], ease: 'easeOut' },
            }
      }
    >
      {/* Static radial vignette — darkens the corners so the centred ghost
          and wordmark sit in the visual focal point. Above bg-black, below
          ambient particles + halo. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, transparent 50%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      {/* Ambient drifting particle field behind the halo.
          count drops to 0 the moment AnimatePresence starts the exit,
          so the 12 infinite transform loops stop wasting frames during
          the 800ms fade. */}
      <AmbientParticles count={isPresent ? 12 : 0} />

      {/* Beat 1 (0–1200ms): inner halo grows scale 0→1.
          Beat 2 (1200–1800ms): single pulse 1→1.15→1.
          Slower pacing reads as more deliberate / premium. */}
      <motion.div
        aria-hidden
        className="absolute h-[600px] w-[600px] rounded-full bg-white/[0.04] blur-3xl pointer-events-none"
        initial={reduced ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
        animate={
          reduced
            ? { opacity: 1, scale: 1 }
            : { opacity: [0, 1, 1, 1], scale: [0, 1, 1.15, 1] }
        }
        exit={{ opacity: 0, transition: { duration: 0.3, ease: 'easeOut' } }}
        transition={
          reduced
            ? { duration: 0.2, ease: 'easeOut' }
            : { duration: 1.8, times: [0, 0.667, 0.833, 1], ease: 'easeOut' }
        }
      />

      {/* Beat 1: subtle scan-line sweeps top→bottom once.
          Slower (1.4s) so it reads as a deliberate "system scan" pass
          rather than a quick flash. */}
      {!reduced && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 h-px bg-white"
          style={{ top: 0, opacity: 0.05, filter: 'blur(1px)' }}
          initial={{ y: '-10vh' }}
          animate={{ y: '110vh' }}
          transition={{ duration: 1.4, ease: 'easeOut' }}
        />
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute top-6 right-6 z-10 text-zinc-500 hover:text-zinc-200"
        onClick={toggleMute}
        aria-label={muted ? 'Unmute splash sound' : 'Mute splash sound'}
      >
        {muted ? <IconVolumeOff size={18} /> : <IconVolume size={18} />}
      </Button>

      <PhantomMark
        variant="intro"
        layoutId="phantom-mark"
        size={220}
        eyeFlash={!reduced}
        shimmer={!reduced}
        exit={reduced ? undefined : { scale: 0.95, transition: { duration: 0.3, ease: 'easeIn' } }}
        className="text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.18)]"
      />

      {/* Beat 4 (1400–2000ms): wordmark types in letter-by-letter at a
          slower, deliberate cadence (60ms stagger, 0.4s fade per letter).
          A single static text-shadow on className gives a soft luminous
          edge without the cost of a continuous keyframe loop (text-shadow
          is a paint operation, not a composite — looping it forces a
          full-element repaint per frame and the per-letter exits during
          stage 2 stack on top of those paints).
          Stage 2 exit (100–500ms): each letter glitches independently —
          random ±2px y-displacement, staggered 30ms apart. */}
      <h1 className="mt-8 text-2xl tracking-[0.4em] uppercase text-white font-light select-none [text-shadow:0_0_18px_rgba(255,255,255,0.18)]">
        {reduced
          ? WORDMARK
          : WORDMARK.split('').map((c, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  opacity: 0,
                  y: wordmarkExitYs[i],
                  transition: { duration: 0.2, delay: 0.1 + i * 0.03, ease: 'easeOut' },
                }}
                transition={{ delay: 1.4 + i * 0.06, duration: 0.4, ease: 'easeOut' }}
                style={{ display: 'inline-block' }}
              >
                {c}
              </motion.span>
            ))}
      </h1>

      {/* Beat 3 (1750ms): minimalist loading bar + cycling status label
          fade in. White-on-black premium tone — not a terminal/CLI
          aesthetic. The 40px pulse slides L→R inside a 144px track on
          a 1.2s infinite loop; the label cycles through three phrases
          (Loading APIs → Loading backend → Loading workspace) at 280ms
          intervals and pins on the last one until the splash exits. */}
      <motion.div
        className="mt-10 flex flex-col items-center gap-3"
        aria-hidden
        initial={reduced ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={reduced ? { duration: 0 } : { delay: 1.75, duration: 0.3, ease: 'easeOut' }}
        exit={reduced ? undefined : { opacity: 0, transition: { duration: 0.2, ease: 'easeOut' } }}
      >
        {/* Indeterminate progress track. Reduced motion renders a
            static half-opacity bar instead of the moving pulse. */}
        <div className="relative h-px w-36 overflow-hidden rounded-full bg-white/15">
          {reduced ? (
            <div className="absolute inset-0 bg-white/40" />
          ) : (
            <motion.div
              className="absolute inset-y-0 w-10 rounded-full bg-white/70"
              initial={{ x: '-100%' }}
              animate={{ x: ['-100%', '360%'] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>

        {/* Cycling label. AnimatePresence mode="wait" ensures the
            exiting phrase fully clears before the next mounts, so the
            two never visually overlap in the same line height. */}
        <div className="h-3 text-[10px] font-light tracking-wide text-zinc-500">
          {reduced ? (
            <span>{LOADER_PHRASES[LOADER_PHRASES.length - 1]}</span>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={phraseIdx}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="block"
              >
                {LOADER_PHRASES[phraseIdx]}
              </motion.span>
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
