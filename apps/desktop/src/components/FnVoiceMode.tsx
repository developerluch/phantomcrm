import { useState, useEffect, useRef, useCallback } from 'react'
import { useVoiceChat, type VoiceChatState } from '../hooks/useVoiceChat'
import { useAIStore } from '../store/ai-store'
import { Button } from '@/components/ui/button'
import {
  IconX,
  IconMicrophone,
  IconVolume,
  IconVolume3,
  IconLoader2,
} from '@tabler/icons-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

// ── State colors & labels ────────────────────────────────────────────────────
const STATE_COLORS: Record<VoiceChatState, string> = {
  idle: '#6366f1',
  listening: '#ef4444',
  thinking: '#3b82f6',
  speaking: '#22c55e',
}

const STATE_LABELS: Record<VoiceChatState, string> = {
  idle: 'Ready',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
}

// ── FnVoiceMode ──────────────────────────────────────────────────────────────
export default function FnVoiceMode() {
  const { mode: aiMode, toggle: toggleAI, setMode } = useAIStore()
  const isOpen = aiMode === 'fn-voice'
  const voice = useVoiceChat()
  const lastF2Ref = useRef(0)
  const activationSourceRef = useRef<'fn-hold' | 'f2-toggle' | null>(null)
  const hasCompletedCycleRef = useRef(false)
  const fnReleasedRef = useRef(false)
  const barRef = useRef<HTMLDivElement>(null)
  const [fnAvailable, setFnAvailable] = useState(false)
  const [accessibilityError, setAccessibilityError] = useState(false)
  const [showError, setShowError] = useState(false)

  // Double-tap F2 detection + Escape to close
  const handleGlobalKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        voice.stopListening()
        setMode('closed')
        activationSourceRef.current = null
        return
      }
      if (e.key === 'F2') {
        const now = Date.now()
        if (now - lastF2Ref.current < 400) {
          e.preventDefault()
          if (!isOpen) activationSourceRef.current = 'f2-toggle'
          toggleAI('fn-voice')
          lastF2Ref.current = 0
        } else {
          lastF2Ref.current = now
        }
      }
    },
    [isOpen, toggleAI, setMode, voice]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKey)
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [handleGlobalKey])

  // Auto-start listening when opening
  useEffect(() => {
    if (isOpen && voice.state === 'idle' && voice.isSupported) {
      const timer = setTimeout(() => voice.startListening(), 300)
      return () => clearTimeout(timer)
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fn key native listener (macOS)
  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api?.onFnKey) return

    setFnAvailable(true)

    const unsubscribe = api.onFnKey((data: { pressed?: boolean; error?: string }) => {
      if (data.error === 'accessibility_permission_required') {
        setAccessibilityError(true)
        return
      }
      if (data.pressed) {
        // Fn held down → activate voice mode
        activationSourceRef.current = 'fn-hold'
        hasCompletedCycleRef.current = false
        fnReleasedRef.current = false
        setMode('fn-voice')
      } else {
        // Fn released → stop listening (triggers sendToAI via onresult callback)
        fnReleasedRef.current = true
        if (activationSourceRef.current === 'fn-hold') {
          voice.stopListening()
        }
      }
    })

    return unsubscribe
  }, [setMode, voice])

  // Auto-close after AI finishes speaking (Fn-hold mode only)
  useEffect(() => {
    if (!isOpen || activationSourceRef.current !== 'fn-hold') return

    if (voice.state === 'speaking') {
      hasCompletedCycleRef.current = true
    }

    const shouldClose =
      voice.state === 'idle' && (hasCompletedCycleRef.current || fnReleasedRef.current)

    if (shouldClose) {
      const delay = hasCompletedCycleRef.current ? 1500 : 300
      const timer = setTimeout(() => {
        setMode('closed')
        activationSourceRef.current = null
      }, delay)
      return () => clearTimeout(timer)
    }
  }, [voice.state, isOpen, setMode])

  // Click-outside-to-close (only when idle)
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node) && voice.state === 'idle') {
        voice.stopListening()
        setMode('closed')
        activationSourceRef.current = null
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, voice.state, setMode, voice])

  // Auto-dismiss accessibility error after 5s
  useEffect(() => {
    if (accessibilityError) {
      const timer = setTimeout(() => setAccessibilityError(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [accessibilityError])

  // Auto-clear error display after 5s
  useEffect(() => {
    if (voice.error) {
      setShowError(true)
      const timer = setTimeout(() => setShowError(false), 5000)
      return () => clearTimeout(timer)
    } else {
      setShowError(false)
    }
  }, [voice.error])

  if (!isOpen) return null

  const isExpanded =
    (voice.aiResponse && voice.state !== 'thinking') ||
    (voice.transcript && voice.state !== 'idle')

  return (
    <>
      {/* Floating bar */}
      <div
        ref={barRef}
        className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] w-[460px]"
        style={{ animation: 'voiceBarEnter 200ms ease-out forwards' }}
      >
        {/* Expanded content area (AI response / transcript) */}
        <div
          className="overflow-hidden transition-all duration-300 ease-out"
          style={{ maxHeight: isExpanded ? '200px' : '0px' }}
        >
          <div className="bg-black/70 backdrop-blur-xl border border-white/10 border-b-0 rounded-t-2xl px-4 py-3">
            <div className="max-h-[176px] overflow-y-auto text-sm text-white/80 leading-relaxed">
              {voice.transcript && voice.state !== 'idle' && (
                <p className="italic text-white/50 mb-2">&ldquo;{voice.transcript}&rdquo;</p>
              )}
              {voice.aiResponse && voice.state !== 'thinking' && (
                <p>{voice.aiResponse}</p>
              )}
            </div>
          </div>
        </div>

        {/* Main controls bar */}
        <div
          className={`flex items-center gap-3 px-4 h-14 bg-black/70 backdrop-blur-xl border border-white/10 shadow-2xl transition-all duration-300 ${
            isExpanded ? 'rounded-b-full' : 'rounded-full'
          }`}
          style={{
            borderColor: `${STATE_COLORS[voice.state]}20`,
          }}
        >
          {/* State dot */}
          <div className="relative flex-shrink-0">
            <div
              className="w-2 h-2 rounded-full transition-colors duration-300"
              style={{
                backgroundColor: STATE_COLORS[voice.state],
                boxShadow: voice.state === 'speaking' ? `0 0 8px ${STATE_COLORS[voice.state]}60` : 'none',
                animation: voice.state === 'listening' ? 'dotPulse 1.5s ease-in-out infinite' : 'none',
              }}
            />
          </div>

          {/* State label */}
          <span className="text-xs text-white/40 flex-shrink-0 w-20">
            {showError ? 'Error' : STATE_LABELS[voice.state]}
          </span>

          {/* Center: transcript preview or error */}
          <div className="flex-1 min-w-0">
            {showError && voice.error ? (
              <p className="text-xs text-red-400/80 truncate">{voice.error}</p>
            ) : voice.transcript ? (
              <p className="text-xs text-white/40 italic truncate">&ldquo;{voice.transcript}&rdquo;</p>
            ) : null}
          </div>

          {/* Accessibility error inline */}
          {accessibilityError && (
            <span className="text-[10px] text-amber-400/70 flex-shrink-0">
              Fn needs{' '}
              <Button
                variant="link"
                onClick={() => (window as any).electronAPI?.openExternal(
                  'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
                )}
                className="underline p-0 h-auto text-[10px] text-amber-400/70"
              >
                Accessibility
              </Button>
            </span>
          )}

          {/* Mic button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { if (voice.state === 'idle') voice.startListening() }}
                disabled={voice.state === 'thinking' || voice.state === 'speaking'}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors flex-shrink-0"
              >
                {voice.state === 'thinking' ? (
                  <IconLoader2 size={14} className="animate-spin" />
                ) : (
                  <IconMicrophone size={14} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Start listening</TooltipContent>
          </Tooltip>

          {/* Mute button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={voice.toggleMute}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors flex-shrink-0"
              >
                {voice.isMuted ? <IconVolume3 size={14} /> : <IconVolume size={14} />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{voice.isMuted ? 'Unmute' : 'Mute'}</TooltipContent>
          </Tooltip>

          {/* Close button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  voice.stopListening()
                  setMode('closed')
                  activationSourceRef.current = null
                }}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/60 hover:text-white transition-colors flex-shrink-0"
              >
                <IconX size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes voiceBarEnter {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes dotPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.6); opacity: 0.7; }
        }
      `}</style>
    </>
  )
}
