import { motion, useReducedMotion } from 'framer-motion';
import { useMemo } from 'react';

interface AmbientParticlesProps {
  /** Number of particles. Set to 0 to render nothing. Default 12. */
  count?: number;
  className?: string;
}

interface Particle {
  id: number;
  size: number;
  startXPct: number;
  driftX: number;
  duration: number;
  delay: number;
  peakOpacity: number;
}

function makeParticle(id: number): Particle {
  const duration = 8 + Math.random() * 6;
  return {
    id,
    size: 3 + Math.random(),
    startXPct: Math.random() * 100,
    driftX: (Math.random() - 0.5) * 80,
    duration,
    // Negative delay places each particle at a random point mid-loop on
    // mount, so the field is already populated instead of all 12 entering
    // from the bottom in lockstep.
    delay: -Math.random() * duration,
    peakOpacity: 0.12 + Math.random() * 0.13,
  };
}

/**
 * Drifting white-dot field used behind the splash + brand panel for
 * subtle atmospheric depth. Pure transform/opacity — compositor-friendly.
 * Returns null under prefers-reduced-motion.
 */
export function AmbientParticles({ count = 12, className }: AmbientParticlesProps) {
  const reduce = useReducedMotion();
  const particles = useMemo(
    () => Array.from({ length: count }, (_, i) => makeParticle(i)),
    [count],
  );

  if (reduce || count === 0) return null;

  return (
    <motion.div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ''}`}
      exit={{ opacity: 0, transition: { duration: 0.2, ease: 'easeOut' } }}
    >
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full bg-white"
          style={{
            width: p.size,
            height: p.size,
            left: `${p.startXPct}%`,
            top: 0,
          }}
          initial={{ y: '110vh', x: 0, opacity: 0 }}
          animate={{
            y: '-10vh',
            x: p.driftX,
            opacity: [0, p.peakOpacity, p.peakOpacity, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: 'linear',
            times: [0, 0.15, 0.85, 1],
          }}
        />
      ))}
    </motion.div>
  );
}
