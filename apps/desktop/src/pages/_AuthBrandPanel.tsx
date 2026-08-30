import { motion, useAnimationControls, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { PhantomMark } from '@/components/brand/PhantomMark'
import { useSplashGone } from '@/components/SplashGate'

const WORDMARK = 'PhantomCRM'
const TAGLINE = 'CRM for closers'

function AmbientPhantom() {
  const reduce = useReducedMotion()
  const splashGone = useSplashGone()
  // Inner-wrapper controls drive the one-shot scale "settle" played
  // when the ghost arrives at its left-panel position via the layoutId
  // morph from the splash. Outer wrapper keeps its independent breathing
  // loop so settle and breath co-exist.
  const settleControls = useAnimationControls()
  const hasSettled = useRef(false)

  function handleArrive() {
    if (reduce || hasSettled.current) return
    hasSettled.current = true
    settleControls.start({
      scale: [1, 1.03, 0.99, 1.0],
      transition: { duration: 0.5, times: [0, 0.33, 0.66, 1], ease: 'easeOut' },
    })
  }

  // Settle-on-splashGone fallback. The proper signal is the layoutId
  // morph's onLayoutAnimationComplete callback wired below, but that
  // callback can silently not fire when LayoutGroup correlates two
  // simultaneously-mounted layoutId elements (documented in
  // project_splash_arrival_signal_fragility.md). The first idempotent
  // caller wins via hasSettled.current.
  useEffect(() => {
    if (splashGone) handleArrive()
  }, [splashGone])

  return (
    <motion.div
      animate={
        reduce
          ? undefined
          : { y: [-3, 3, -3] }
      }
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      className="flex items-center justify-center"
    >
      <motion.div animate={settleControls}>
        <PhantomMark
          variant="static"
          live
          layoutId="phantom-mark"
          size={280}
          onLayoutAnimationComplete={handleArrive}
          className="text-white drop-shadow-[0_0_60px_rgba(255,255,255,0.08)]"
        />
      </motion.div>
    </motion.div>
  )
}

export function AuthBrandPanel() {
  const reduced = useReducedMotion()
  const splashGone = useSplashGone()

  return (
    <div className="hidden md:flex md:w-1/2 relative overflow-hidden items-center justify-center p-12 bg-black">
      {/* Static radial vignette — keeps the centred ghost as the focal
          point and softens the panel edges. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 0%, transparent 50%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-12">
        <AmbientPhantom />

        {/* Wordmark + tagline land just after the ghost arrives.
            Pure opacity fades — no y-translate. The morphing ghost
            already supplies the spatial motion in this window; having
            the wordmark also translate creates competing motion that
            draws the eye away from the ghost. Gated on splashGone so
            the entrance is anchored to the splash exit deterministically
            (no wall-clock coupling). */}
        <div className="text-center space-y-3">
          <motion.h1
            className="text-3xl font-light tracking-[0.4em] uppercase text-white select-none"
            initial={reduced ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: reduced || splashGone ? 1 : 0 }}
            transition={{ duration: 0.6, delay: reduced ? 0 : 0.1, ease: 'easeOut' }}
          >
            {WORDMARK}
          </motion.h1>
          <motion.p
            className="text-[11px] font-light tracking-[0.3em] uppercase text-zinc-400"
            initial={reduced ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: reduced || splashGone ? 1 : 0 }}
            transition={{ duration: 0.6, delay: reduced ? 0 : 0.25, ease: 'easeOut' }}
          >
            {TAGLINE}
          </motion.p>
        </div>
      </div>
    </div>
  )
}
