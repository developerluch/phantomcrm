import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'

const MIN_VISIBLE_MS = 150

export default function RouteProgressBar() {
  const { pathname } = useLocation()
  const [active, setActive] = useState(false)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    setActive(true)
    const t = window.setTimeout(() => setActive(false), MIN_VISIBLE_MS)
    return () => window.clearTimeout(t)
  }, [pathname])

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          aria-hidden
          className="fixed top-0 left-0 right-0 pointer-events-none"
          style={{ height: 2, zIndex: 60, transformOrigin: 'left' }}
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 0.7, opacity: 1, transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] } }}
          exit={{ scaleX: 1, opacity: 0, transition: { duration: 0.2, ease: 'easeOut' } }}
        >
          <div
            className="h-full w-full"
            style={{ background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)' }}
          />
          <div
            className="absolute top-0 right-0 h-full"
            style={{
              width: 60,
              transform: 'translateX(100%)',
              background: 'linear-gradient(90deg, rgba(139,92,246,0.6), rgba(139,92,246,0))',
              filter: 'blur(6px)',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
