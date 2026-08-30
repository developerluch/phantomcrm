import {
  animate,
  motion,
  useAnimationControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type TargetAndTransition,
  type Variants,
} from 'framer-motion';
import { useCallback, useEffect, useId, useState, type CSSProperties } from 'react';

export type PhantomMarkVariant = 'intro' | 'static';

// Single source of truth for the silhouette path — used by the visible
// outline stroke and by the shimmer mask so they're guaranteed identical.
const GHOST_OUTLINE_D =
  'M256 36 L406 154 V284 L452 324 L414 408 V350 L384 380 V452 L337 500 V425 L304 459 V556 L256 606 L208 556 V459 L175 425 V500 L128 452 V380 L98 350 V408 L60 324 L106 284 V154 Z';

interface PhantomMarkProps {
  /** 'intro' = stroke-draw entrance for splash; 'static' = fully drawn */
  variant?: PhantomMarkVariant;
  /** Pixel width — height auto-scales to viewBox ratio (~1.21x) */
  size?: number;
  /** stroke + fill source — defaults to currentColor so callers can use Tailwind text-* */
  color?: string;
  /** When true, runs continuous post-intro animations (eye blink + subtle breath). */
  live?: boolean;
  /** When true, eyes do a one-shot brightness flash 700ms after mount.
   *  Used for the splash beat-2 "wake up" moment. */
  eyeFlash?: boolean;
  /** When true, a soft white sheen sweeps across the silhouette every 12s
   *  (4s active, 8s rest) — the "chrome being polished" effect. */
  shimmer?: boolean;
  /** Optional shared-element transition id. When two PhantomMark instances share
   *  the same layoutId across mounts/unmounts, framer-motion morphs position +
   *  size between them — used for the splash → login handoff. */
  layoutId?: string;
  /** Forwarded to the motion.svg's `exit` prop. Used by Splash to give the
   *  ghost a scale-0.95 anticipation beat before the layoutId hand-off. */
  exit?: TargetAndTransition;
  /** Forwarded to the motion.svg. Fires when the SVG's layout animation
   *  (e.g. a layoutId morph) completes. AuthBrandPanel uses this to trigger
   *  the settling beat after the ghost arrives at its left-panel position. */
  onLayoutAnimationComplete?: () => void;
  className?: string;
  style?: CSSProperties;
}

// Element-level orchestration — main outline draws first, then energy strokes
// stagger in, then orbs/eyes/mouth fade in last (the "awakening").
const container: Variants = {
  intro: { transition: { staggerChildren: 0.05, delayChildren: 0.2 } },
  static: {},
};

const outline: Variants = {
  intro: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: { duration: 0.9, ease: [0.65, 0, 0.35, 1] },
  },
  static: { pathLength: 1, opacity: 1 },
};

const stroke: Variants = {
  intro: {
    pathLength: [0, 1],
    opacity: [0, 1],
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  static: { pathLength: 1, opacity: 1 },
};

const fade: Variants = {
  intro: {
    opacity: [0, 1],
    scale: [0.7, 1],
    transition: { duration: 0.35, ease: 'easeOut' },
  },
  static: { opacity: 1, scale: 1 },
};

export function PhantomMark({
  variant = 'static',
  size = 200,
  color = 'currentColor',
  live = false,
  eyeFlash = false,
  shimmer = false,
  layoutId,
  exit,
  onLayoutAnimationComplete,
  className,
  style,
}: PhantomMarkProps) {
  const reduce = useReducedMotion();
  // useId returns ":r3:"-style strings; SVG ids tolerate them in modern
  // browsers, but stripping the colons keeps CSS-selector usage safe too.
  const reactId = useId().replace(/:/g, '');
  const shimmerGradId = `phantom-shimmer-${reactId}`;
  const shimmerMaskId = `phantom-shimmer-mask-${reactId}`;
  const active: PhantomMarkVariant = reduce ? 'static' : variant;
  const liveActive = live && !reduce;
  const flashActive = eyeFlash && !reduce;
  const shimmerActive = shimmer && !reduce;

  // Two channels of imperative eye animation:
  // - blinkControls drives opacity (slow blink + double-blink) and the
  //   one-shot eyeFlash filter burst. Mounted on the inner motion.g.
  // - lookAroundControls drives the eye triangles' x-translation. Mounted
  //   on the outer motion.g so it composes with blink without fighting
  //   it on a single transform/style channel.
  const blinkControls = useAnimationControls();
  const lookAroundControls = useAnimationControls();
  // Glitch channel — drives x-jitter + opacity flicker on a wrapping
  // motion.g so it composes cleanly above the look-around / blink stack
  // for the eyes and the static silhouette / strokes / orbs / mouth.
  const glitchControls = useAnimationControls();
  // hasArrived flips true after the first layoutId morph completes (or
  // immediately for instances without a layoutId). Used to gate the
  // glitch loop so it cannot fire during the splash → auth-panel
  // morph window where its opacity dips to 0.5 multiplied with the
  // spring's transform interpolation produces visible flicker.
  const [hasArrived, setHasArrived] = useState<boolean>(() => !layoutId);
  const handleLayoutComplete = useCallback(() => {
    setHasArrived(true);
    onLayoutAnimationComplete?.();
  }, [onLayoutAnimationComplete]);
  // Halo pulse alpha drives an inline drop-shadow filter on motion.svg.
  // Behaviour differs by live state:
  // - live=true: rests at 0.08 (the auth-panel's resting halo alpha) and
  //   pulses to 0.32 during halo-pulse events. Always returns a defined
  //   filter string so the inline filter stays continuous across the
  //   pulse cycle — no className/inline switch, no per-pulse flicker.
  // - live=false (splash): stays at 0 and useTransform yields undefined,
  //   so the inline filter is unset and the parent's className-applied
  //   drop-shadow renders normally (different blur radius and alpha for
  //   the splash variant).
  const haloAlpha = useMotionValue(liveActive ? 0.08 : 0);
  const haloFilter = useTransform(haloAlpha, (a) =>
    a > 0 ? `drop-shadow(0 0 60px rgba(255,255,255,${a}))` : undefined,
  );

  // Eye flash — one-shot brightness burst 700ms after mount.
  useEffect(() => {
    if (!flashActive) return;
    const timer = window.setTimeout(() => {
      blinkControls.start({
        filter: [
          'drop-shadow(0 0 0 rgba(255,255,255,0)) brightness(1)',
          'drop-shadow(0 0 12px rgba(255,255,255,0.95)) brightness(2.4)',
          'drop-shadow(0 0 0 rgba(255,255,255,0)) brightness(1)',
        ],
        transition: { duration: 0.25, ease: 'easeOut' },
      });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [flashActive, blinkControls]);

  // Slow blink — single ~180ms close every 4.5–6.5s.
  useEffect(() => {
    if (!liveActive) return;
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    (async () => {
      // Random initial offset so two PhantomMark instances don't sync.
      await wait(Math.random() * 5000);
      while (!cancelled) {
        await wait(4500 + Math.random() * 2000);
        if (cancelled) break;
        await blinkControls.start({
          opacity: [1, 0, 1],
          transition: { duration: 0.18, times: [0, 0.5, 1], ease: 'easeInOut' },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveActive, blinkControls]);

  // Double-blink — two quick blinks 200ms apart, every 18–26s.
  useEffect(() => {
    if (!liveActive) return;
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    (async () => {
      await wait(Math.random() * 22000);
      while (!cancelled) {
        await wait(18000 + Math.random() * 8000);
        if (cancelled) break;
        await blinkControls.start({
          opacity: [1, 0, 1],
          transition: { duration: 0.15, times: [0, 0.5, 1], ease: 'easeInOut' },
        });
        await wait(200);
        if (cancelled) break;
        await blinkControls.start({
          opacity: [1, 0, 1],
          transition: { duration: 0.15, times: [0, 0.5, 1], ease: 'easeInOut' },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveActive, blinkControls]);

  // Look-around — eye triangles glance left then right over 1.2s every 30–46s.
  useEffect(() => {
    if (!liveActive) return;
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    (async () => {
      await wait(Math.random() * 38000);
      while (!cancelled) {
        await wait(30000 + Math.random() * 16000);
        if (cancelled) break;
        await lookAroundControls.start({
          x: [0, -3, 3, 0],
          transition: { duration: 1.2, times: [0, 0.25, 0.75, 1], ease: 'easeInOut' },
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveActive, lookAroundControls]);

  // Glitch — random atmospheric distortion every 7–13s. Two intensity
  // tiers chosen at random per event:
  //   - Mild (≈67% of events): brief ±1.5px x-jitter + opacity dip to
  //     0.65 over 180ms. Reads as a quiet signal flutter.
  //   - Strong (≈33%): three-step ±3px x-jitter + deeper opacity dips
  //     (0.5 → 0.9 → 0.6) over 320ms. Reads as a digital-tear glitch.
  // Gated on hasArrived: opacity dips during the layoutId morph
  // composed multiplicatively with the spring's transform animation,
  // producing visible flicker. After arrival, the morph is settled
  // and the glitch is purely additive atmospheric texture.
  // No translation persists between events. Skip under reduce.
  useEffect(() => {
    if (!liveActive || !hasArrived) return;
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    (async () => {
      await wait(Math.random() * 9000);
      while (!cancelled) {
        await wait(7000 + Math.random() * 6000);
        if (cancelled) break;
        const isStrong = Math.random() < 0.33;
        if (isStrong) {
          await glitchControls.start({
            x: [0, -3, 3, -1, 2, 0],
            opacity: [1, 0.5, 0.9, 0.6, 1, 1],
            transition: {
              duration: 0.32,
              times: [0, 0.15, 0.35, 0.55, 0.8, 1],
              ease: 'easeOut',
            },
          });
        } else {
          await glitchControls.start({
            x: [0, -1.5, 1.5, 0],
            opacity: [1, 0.65, 0.95, 1],
            transition: {
              duration: 0.18,
              times: [0, 0.3, 0.7, 1],
              ease: 'easeInOut',
            },
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveActive, hasArrived, glitchControls]);

  // Halo pulse — drop-shadow alpha 0.18 → 0.32 → 0.18 → 0.08 over 2s
  // every 14–20s. The trailing return to the resting 0.08 (instead of 0)
  // keeps the inline filter continuously defined; the parent's className
  // drop-shadow never has to take back over, eliminating the one-frame
  // switch flicker that the previous "alpha → 0 → undefined" sequence
  // produced.
  useEffect(() => {
    if (!liveActive) return;
    let cancelled = false;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    (async () => {
      await wait(Math.random() * 17000);
      while (!cancelled) {
        await wait(14000 + Math.random() * 6000);
        if (cancelled) break;
        const playback = animate(haloAlpha, [0.18, 0.32, 0.18, 0.08], {
          duration: 2,
          times: [0, 0.5, 0.99, 1],
          ease: 'easeInOut',
        });
        await playback;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [liveActive, haloAlpha]);

  return (
    <motion.svg
      layoutId={layoutId}
      width={size}
      height={(size * 620) / 512}
      viewBox="0 0 512 620"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      // haloFilter is a MotionValue; framer-motion subscribes and updates the
      // inline filter as the halo pulse animates. When idle, it resolves to
      // undefined so the parent's className drop-shadow is what's rendered.
      style={{ ...style, filter: haloFilter }}
      initial={variant === 'intro' && !reduce ? 'static' : false}
      animate={active}
      exit={exit}
      onLayoutAnimationComplete={handleLayoutComplete}
      variants={container}
      // Spring physics give the morph weight — the ghost feels like it has
      // mass instead of being interpolated linearly. Tuned values: stiffness
      // 100 / damping 22 / mass 0.9 settle in ~750ms with a single soft
      // overshoot on arrival. Reference: Apple keynote shared-element
      // transitions land in ~600–800ms.
      // Gated on `!reduce` for accessibility — under prefers-reduced-motion
      // we leave the layout transition undefined so framer-motion uses its
      // default 0-duration snap instead of running the full spring.
      transition={
        layoutId && !reduce
          ? { layout: { type: 'spring', stiffness: 100, damping: 22, mass: 0.9 } }
          : undefined
      }
      role="img"
      aria-label="Phantom"
    >
      <title>Phantom</title>

      {shimmerActive && (
        <defs>
          <motion.linearGradient
            id={shimmerGradId}
            y1="0%"
            y2="0%"
            initial={{ x1: '-100%', x2: '0%' }}
            animate={{ x1: ['-100%', '200%'], x2: ['0%', '300%'] }}
            transition={{
              duration: 4,
              delay: 0.7,
              repeat: Infinity,
              repeatDelay: 8,
              ease: 'easeInOut',
            }}
          >
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="50%" stopColor="white" stopOpacity="0.45" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </motion.linearGradient>
          <mask id={shimmerMaskId}>
            <path d={GHOST_OUTLINE_D} fill="white" />
          </mask>
        </defs>
      )}

      {/* Glitch wrapper — applies x-jitter + opacity flicker to the
          entire visible silhouette so a single motion.g moves all
          paths/orbs/eyes/mouth as one. Composes above the look-around
          + blink stack for the eyes (which still get their own
          transforms underneath this one). */}
      <motion.g animate={glitchControls}>
        {/* Main silhouette */}
        <motion.path
          d={GHOST_OUTLINE_D}
          stroke={color}
          strokeWidth={16}
          strokeLinecap="round"
          strokeLinejoin="round"
          variants={outline}
        />

        {/* Six vertical energy strokes — stagger inward from edges */}
        <motion.path d="M146 338 V452" stroke={color} strokeWidth={10} strokeLinecap="round" variants={stroke} />
        <motion.path d="M366 338 V452" stroke={color} strokeWidth={10} strokeLinecap="round" variants={stroke} />
        <motion.path d="M184 404 V540" stroke={color} strokeWidth={10} strokeLinecap="round" variants={stroke} />
        <motion.path d="M328 404 V540" stroke={color} strokeWidth={10} strokeLinecap="round" variants={stroke} />
        <motion.path d="M218 468 V586" stroke={color} strokeWidth={8}  strokeLinecap="round" variants={stroke} />
        <motion.path d="M294 468 V586" stroke={color} strokeWidth={8}  strokeLinecap="round" variants={stroke} />

        {/* Lower orbs */}
        <motion.circle cx={146} cy={480} r={13} stroke={color} strokeWidth={10} fill="none" variants={fade} />
        <motion.circle cx={366} cy={480} r={13} stroke={color} strokeWidth={10} fill="none" variants={fade} />

        {/* Eye triangles. Two nested motion groups separate the
            animation channels so they compose without conflict:
            - Outer g (lookAroundControls): x-translation for the
              look-around glance. Fires every ~38s.
            - Inner g (blinkControls): opacity + filter for the slow
              blink, double-blink, and one-shot eyeFlash burst.
              Splash uses flash; auth-panel uses the live blink loops.
            The eye paths still inherit the intro/static fade variant
            via the parent motion.svg's variants context. */}
        <motion.g animate={lookAroundControls}>
          <motion.g animate={blinkControls}>
            <motion.path d="M158 218 L224 254 L128 238 Z" fill={color} stroke="none" variants={fade} />
            <motion.path d="M354 218 L288 254 L384 238 Z" fill={color} stroke="none" variants={fade} />
          </motion.g>
        </motion.g>

        {/* Mouth */}
        <motion.path d="M246 500 V536" stroke={color} strokeWidth={6} strokeLinecap="round" variants={fade} />
        <motion.path d="M266 500 V536" stroke={color} strokeWidth={6} strokeLinecap="round" variants={fade} />
      </motion.g>

      {shimmerActive && (
        <rect
          x="0"
          y="0"
          width="512"
          height="620"
          fill={`url(#${shimmerGradId})`}
          mask={`url(#${shimmerMaskId})`}
          pointerEvents="none"
        />
      )}
    </motion.svg>
  );
}
