import { useState, useRef, useEffect, useCallback } from 'react'
import { useVoiceChat } from '../hooks/useVoiceChat'
import { useAIStore } from '../store/ai-store'
import type { VoiceChatState } from '../hooks/useVoiceChat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  IconMicrophone,
  IconSend,
  IconX,
  IconRobot,
  IconSparkles,
  IconVolume,
  IconVolume3,
} from '@tabler/icons-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

// ── Glow colors by state ──────────────────────────────────────────────────
const GLOW_COLORS: Record<VoiceChatState, { primary: string; secondary: string }> = {
  idle: { primary: '#6366f1', secondary: '#8b5cf6' },
  listening: { primary: '#ef4444', secondary: '#f97316' },
  thinking: { primary: '#3b82f6', secondary: '#06b6d4' },
  speaking: { primary: '#22c55e', secondary: '#10b981' },
}

const STATE_HINTS: Record<VoiceChatState, string> = {
  idle: 'Ask anything about your recruits, pipeline, or agents...',
  listening: 'Listening — speak now...',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
}

export default function AICommandBar() {
  const { mode: aiMode, toggle: toggleAI } = useAIStore()
  const isOpen = aiMode === 'bar'
  const [textInput, setTextInput] = useState('')
  const [response, setResponse] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const voice = useVoiceChat()

  // ── Global keyboard shortcut: Cmd+Shift+A (or Ctrl+Shift+A) ────────────
  const handleGlobalKey = useCallback(
    (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (mod && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        toggleAI('bar')
      }
      // Also close on Escape
      if (e.key === 'Escape' && isOpen) {
        toggleAI('bar')
      }
    },
    [isOpen, toggleAI],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKey)
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [handleGlobalKey])

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150)
    }
  }, [isOpen])

  // Sync AI response
  useEffect(() => {
    if (voice.aiResponse && voice.state !== 'thinking') {
      setResponse(voice.aiResponse)
    }
  }, [voice.aiResponse, voice.state])

  function handleSend() {
    const text = textInput.trim()
    if (!text || voice.state === 'thinking') return
    setTextInput('')
    setResponse('')
    voice.sendToAI(text)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const glowColor = GLOW_COLORS[voice.state]

  if (!isOpen) return null

  return (
    <>
      {/* Edge glow — left and right borders of the entire app */}
      <div
        className="fixed inset-0 pointer-events-none z-[60]"
        style={{
          boxShadow: `
            inset 4px 0 30px -8px ${glowColor.primary}40,
            inset -4px 0 30px -8px ${glowColor.secondary}40,
            inset 0 -4px 30px -8px ${glowColor.primary}30
          `,
          transition: 'box-shadow 400ms ease',
        }}
      />

      {/* Backdrop (subtle) */}
      <div
        className="fixed inset-0 z-[61]"
        onClick={() => toggleAI('bar')}
        style={{ background: 'rgba(0,0,0,0.2)' }}
      />

      {/* Command bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[62] px-4 pb-4"
        style={{
          animation: 'slideUpBar 250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        }}
      >
        <style>{`
          @keyframes slideUpBar {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes glowPulse {
            0%, 100% { opacity: 0.6; }
            50% { opacity: 1; }
          }
        `}</style>

        <div
          className="max-w-3xl mx-auto rounded-2xl border border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden"
          style={{
            boxShadow: `
              0 -8px 40px -8px ${glowColor.primary}25,
              0 0 0 1px ${glowColor.primary}15,
              0 20px 60px -12px rgba(0,0,0,0.5)
            `,
            transition: 'box-shadow 400ms ease',
          }}
        >
          {/* Response area (shows when there's a response) */}
          {(response || voice.state === 'thinking') && (
            <div className="px-5 pt-4 pb-2 max-h-48 overflow-y-auto">
              {voice.state === 'thinking' ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center bg-blue-500/15">
                    <IconRobot size={12} className="text-blue-400" />
                  </div>
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              ) : (
                <div className="flex gap-2.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center bg-emerald-500/15 shrink-0 mt-0.5">
                    <IconRobot size={12} className="text-emerald-400" />
                  </div>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{response}</p>
                </div>
              )}
            </div>
          )}

          {/* Input row */}
          <div className="flex items-center gap-3 px-4 py-3">
            {/* AI icon */}
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: `linear-gradient(135deg, ${glowColor.primary}, ${glowColor.secondary})`,
                boxShadow: `0 0 16px ${glowColor.primary}30`,
                animation: voice.state !== 'idle' ? 'glowPulse 2s ease-in-out infinite' : 'none',
                transition: 'background 300ms ease',
              }}
            >
              <IconSparkles size={16} className="text-white" />
            </div>

            {/* Text input */}
            <Input
              ref={inputRef}
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={STATE_HINTS[voice.state]}
              disabled={voice.state === 'thinking'}
              className="flex-1 h-9 border-0 bg-transparent px-0 text-sm text-foreground shadow-none placeholder:text-muted-foreground/60 focus-visible:ring-0 disabled:opacity-50"
            />

            {/* Mic button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (voice.state === 'listening') {
                      voice.stopListening()
                    } else if (voice.state === 'idle') {
                      voice.startListening()
                    }
                  }}
                  disabled={!voice.isSupported || voice.state === 'thinking' || voice.state === 'speaking'}
                  className={`w-8 h-8 rounded-lg transition-all ${
                    voice.state === 'listening'
                      ? 'bg-red-500/20 text-red-400'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <IconMicrophone size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Voice input</TooltipContent>
            </Tooltip>

            {/* Mute button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={voice.toggleMute}
                  className={`w-8 h-8 rounded-lg transition-all ${
                    voice.isMuted
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {voice.isMuted ? <IconVolume3 size={16} /> : <IconVolume size={16} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{voice.isMuted ? 'Unmute' : 'Mute'}</TooltipContent>
            </Tooltip>

            {/* Send button */}
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!textInput.trim() || voice.state === 'thinking'}
              className="w-8 h-8 rounded-lg"
            >
              <IconSend size={14} />
            </Button>

            {/* Close button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleAI('bar')}
                  className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <IconX size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close (Esc)</TooltipContent>
            </Tooltip>
          </div>

          {/* Keyboard hint */}
          <div className="flex items-center justify-center pb-2">
            <span className="text-[10px] text-muted-foreground/40">
              {navigator.platform.toUpperCase().includes('MAC') ? '⌘' : 'Ctrl'}+Shift+A to toggle
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
