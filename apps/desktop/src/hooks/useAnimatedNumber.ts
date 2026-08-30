import { useState, useEffect } from 'react'

export function useAnimatedNumber(target: number, duration = 500) {
  const [display, setDisplay] = useState(target)
  useEffect(() => {
    const start = display
    const startTime = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(start + (target - start) * eased)
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration])
  return display
}
