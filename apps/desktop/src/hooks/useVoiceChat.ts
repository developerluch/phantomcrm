import { useState, useRef, useCallback } from 'react'
import { useSendMessage } from './useChat'

export type VoiceChatState = 'idle' | 'listening' | 'thinking' | 'speaking'

export function useVoiceChat() {
  const [state, setState] = useState<VoiceChatState>('idle')
  const [transcript, setTranscript] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  // TTS is muted by default; persisted in localStorage under 'ai-chat.tts'
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem('ai-chat.tts') !== 'on'
  })
  const [error, setError] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)

  const sendMessage = useSendMessage()
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const isMutedRef = useRef(isMuted)
  const conversationIdRef = useRef(conversationId)
  // stateRef lets timeout callbacks read the current state without stale closures
  const stateRef = useRef(state)

  // Keep refs in sync so callback closures see the latest values
  isMutedRef.current = isMuted
  conversationIdRef.current = conversationId
  stateRef.current = state

  const isSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  const speakResponse = useCallback(async (rawText: string) => {
    // Stop any currently playing audio first
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    speechSynthesis.cancel()

    // Strip markdown formatting so it doesn't read "asterisk asterisk" etc.
    const text = rawText
      .replace(/\*\*(.*?)\*\*/g, '$1')  // **bold** → bold
      .replace(/\*(.*?)\*/g, '$1')       // *italic* → italic
      .replace(/__(.*?)__/g, '$1')       // __underline__ → underline
      .replace(/~~(.*?)~~/g, '$1')       // ~~strike~~ → strike
      .replace(/`(.*?)`/g, '$1')         // `code` → code
      .replace(/^#{1,6}\s+/gm, '')       // ### headers → plain text
      .replace(/^[-*]\s+/gm, '')         // - bullet points → plain text
      .replace(/^\d+\.\s+/gm, '')        // 1. numbered lists → plain text
      .trim()

    if (!text) { setState('idle'); return }

    setState('speaking')

    // Browser TTS fallback — used when the backend voice proxy is
    // unconfigured or unreachable. No third-party keys in the renderer.
    const speakWithBrowserTTS = () => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.0
      utterance.pitch = 1.0

      const voices = speechSynthesis.getVoices()
      const preferred = voices.find(v => v.name.includes('Samantha'))
        || voices.find(v => v.name.includes('Google US English'))
        || voices.find(v => v.name.includes('Google UK English'))
        || voices.find(v => v.name.includes('Daniel'))
        || voices.find(v => v.lang.startsWith('en') && v.localService)
      if (preferred) utterance.voice = preferred

      utterance.onend = () => setState('idle')
      utterance.onerror = () => setState('idle')
      speechSynthesis.speak(utterance)
    }

    // SECURITY: TTS goes through the backend proxy (POST /api/v1/voice/tts)
    // with server-side credentials. The renderer never holds a provider key
    // (the old VITE_ELEVENLABS_API_KEY path shipped the secret in the
    // bundle). Backend returns 503 when unconfigured → browser TTS.
    try {
      const [{ getApiBaseUrl }, { getAccessToken }] = await Promise.all([
        import('../services/config'),
        import('../services/tokenVault'),
      ])
      const base = (getApiBaseUrl() || '').replace(/\/$/, '')
      const token = await getAccessToken()
      if (!token) { speakWithBrowserTTS(); return }

      const res = await fetch(`${base}/api/v1/voice/tts`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) {
        // 503 = server-side voice disabled; anything else = degraded.
        speakWithBrowserTTS()
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio // Track current audio so we can stop it
      audio.onended = () => {
        URL.revokeObjectURL(url)
        audioRef.current = null
        setState('idle')
      }
      audio.onerror = () => {
        URL.revokeObjectURL(url)
        audioRef.current = null
        setState('idle')
      }
      audio.play()
    } catch {
      speakWithBrowserTTS()
    }
  }, [])

  const sendToAI = useCallback(
    async (text: string) => {
      setState('thinking')
      setError(null)
      try {
        const result = await sendMessage.mutateAsync({
          message: text,
          conversationId: conversationIdRef.current ?? undefined,
        })
        // result.message is a plain string (backend returns { conversationId, message, role })
        const response = (result as any).message ?? ''
        if ((result as any).conversationId) {
          setConversationId((result as any).conversationId)
        }
        setAiResponse(response)
        if (!isMutedRef.current && response) {
          await speakResponse(response)
        } else {
          setState('idle')
        }
      } catch {
        setError('Failed to get AI response')
        setState('idle')
      }
    },
    [sendMessage, speakResponse],
  )

  const startListening = useCallback(async () => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser')
      return
    }

    setError(null)
    setTranscript('')

    // Stop any in-flight TTS before starting to listen
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    speechSynthesis.cancel()

    // Pre-flight mic permission probe — avoids showing "listening" when mic is blocked
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop()) // release the stream immediately
    } catch {
      setError('Microphone access denied — allow mic in browser settings')
      setState('idle')
      return
    }

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const recognition = new SpeechRecognitionCtor() as SpeechRecognition

    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    // 2-second safety timeout: if onstart never fires we abort cleanly
    const startTimeout = setTimeout(() => {
      if (stateRef.current !== 'listening') {
        try { recognition.abort() } catch { /* ignore */ }
        setError('Could not start microphone — try again')
        setState('idle')
      }
    }, 2000)

    // Set state to 'listening' only once the browser confirms the mic is active
    recognition.onstart = () => {
      clearTimeout(startTimeout)
      setState('listening')
    }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = ''
      let interimText = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        } else {
          interimText += result[0].transcript
        }
      }
      const combined = finalText || interimText
      setTranscript(combined)

      if (finalText) {
        sendToAI(finalText)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      clearTimeout(startTimeout)
      if (event.error === 'aborted') return
      const friendlyMessages: Record<string, string> = {
        network: 'Network error — check your connection and try again',
        'not-allowed': 'Microphone access denied — allow mic in browser settings',
        'no-speech': 'No speech detected — try again',
        'audio-capture': 'No microphone found',
        'service-not-available': 'Speech service unavailable — try again later',
      }
      setError(friendlyMessages[event.error] ?? `Speech recognition error: ${event.error}`)
      setState('idle')
    }

    recognition.onend = () => {
      clearTimeout(startTimeout)
      // Only reset to idle if we are still in "listening" state
      // (if sendToAI was called, state will already be 'thinking')
      setState((prev) => (prev === 'listening' ? 'idle' : prev))
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [isSupported, sendToAI])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    // Also stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    speechSynthesis.cancel()
  }, [])

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev
      if (typeof window !== 'undefined') {
        localStorage.setItem('ai-chat.tts', next ? 'off' : 'on')
      }
      return next
    })
  }, [])

  const resetConversation = useCallback(() => {
    setConversationId(null)
    setTranscript('')
    setAiResponse('')
    setError(null)
    setState('idle')
  }, [])

  return {
    state,
    transcript,
    aiResponse,
    error,
    isSupported,
    isMuted,
    conversationId,
    startListening,
    stopListening,
    sendToAI,
    toggleMute,
    resetConversation,
  }
}
