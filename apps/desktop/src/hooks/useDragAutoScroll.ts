import { useRef, useCallback, useEffect } from 'react'

export function useDragAutoScroll(
  containerRef: React.RefObject<HTMLElement | null>,
  isDragging: boolean,
) {
  const rafRef = useRef<number>(0)
  const speedRef = useRef(0)

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const edgeZone = 60
      const maxSpeed = 12

      if (e.clientY > rect.bottom - edgeZone) {
        const proximity = 1 - (rect.bottom - e.clientY) / edgeZone
        speedRef.current = Math.min(proximity * maxSpeed, maxSpeed)
      } else if (e.clientY < rect.top + edgeZone) {
        const proximity = 1 - (e.clientY - rect.top) / edgeZone
        speedRef.current = -Math.min(proximity * maxSpeed, maxSpeed)
      } else {
        speedRef.current = 0
      }
    },
    [containerRef],
  )

  const tick = useCallback(() => {
    if (speedRef.current !== 0 && containerRef.current) {
      containerRef.current.scrollTop += speedRef.current
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [containerRef])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove)
      rafRef.current = requestAnimationFrame(tick)
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      cancelAnimationFrame(rafRef.current)
      speedRef.current = 0
    }
  }, [isDragging, onMouseMove, tick])
}
