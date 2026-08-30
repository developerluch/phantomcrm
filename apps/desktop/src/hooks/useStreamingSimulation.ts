import { useState, useEffect, useRef, useCallback } from 'react'

export interface StreamedWord {
  text: string
  isKeyData: boolean
  index: number
}

const KEY_DATA_REGEX = /^(\$[\d,.]+|[\d,.]+%|\d{1,3}(,\d{3})*(\.\d+)?)$/

export function useStreamingSimulation(
  fullText: string | null,
  isActive: boolean,
  speed = 30,
): { displayedWords: StreamedWord[]; isComplete: boolean } {
  const [revealedCount, setRevealedCount] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const wordsRef = useRef<StreamedWord[]>([])

  // Parse words whenever fullText changes
  const allWords = useCallback(() => {
    if (!fullText) return []
    return fullText.split(/\s+/).filter(Boolean).map((word, i) => ({
      text: word,
      isKeyData: KEY_DATA_REGEX.test(word),
      index: i,
    }))
  }, [fullText])

  useEffect(() => {
    wordsRef.current = allWords()
  }, [allWords])

  useEffect(() => {
    // Cleanup any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (!isActive || !fullText) {
      // Show all words immediately for historical messages
      setRevealedCount(wordsRef.current.length)
      return
    }

    // Start streaming
    setRevealedCount(0)
    const total = wordsRef.current.length

    intervalRef.current = setInterval(() => {
      setRevealedCount((prev) => {
        if (prev >= total) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          intervalRef.current = null
          return total
        }
        return prev + 1
      })
    }, speed)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isActive, fullText, speed])

  const displayed = wordsRef.current.slice(0, revealedCount)
  const isComplete = revealedCount >= wordsRef.current.length

  return { displayedWords: displayed, isComplete }
}
