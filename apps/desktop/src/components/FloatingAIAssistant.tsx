import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useVoiceChat } from '../hooks/useVoiceChat'
import { useAIStore } from '../store/ai-store'
import type { VoiceChatState } from '../hooks/useVoiceChat'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  IconMessage,
  IconX,
  IconMicrophone,
  IconKeyboard,
  IconVolume3,
  IconSend,
  IconVolume,
  IconRobot,
  IconUser,
  IconPlus,
} from '@tabler/icons-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

// ── Avatar gradient colors by state ─────────────────────────────────────────
const AVATAR_STYLES: Record<VoiceChatState, { gradient: string; shadow: string }> = {
  idle: {
    gradient: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    shadow: '0 0 20px rgba(59,130,246,0.2)',
  },
  listening: {
    gradient: 'linear-gradient(135deg, #ef4444, #f97316)',
    shadow: '0 0 30px rgba(239,68,68,0.35)',
  },
  thinking: {
    gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
    shadow: '0 0 30px rgba(59,130,246,0.35)',
  },
  speaking: {
    gradient: 'linear-gradient(135deg, #22c55e, #10b981)',
    shadow: '0 0 30px rgba(34,197,94,0.35)',
  },
}

const STATE_LABELS: Record<VoiceChatState, string> = {
  idle: 'Ready',
  listening: 'Listening...',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
}

// ── Waveform bars for listening state ────────────────────────────────────────
function WaveformBars({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const barCount = size === 'sm' ? 4 : 5
  return (
    <div className={`flex items-center gap-[3px] ${size === 'sm' ? 'h-3' : 'h-4'}`}>
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className={`${size === 'sm' ? 'w-[2px]' : 'w-[3px]'} rounded-full bg-red-400`}
          style={{
            animation: 'waveform 0.8s ease-in-out infinite alternate',
            animationDelay: `${i * 0.1}s`,
            height: '100%',
          }}
        />
      ))}
      <style>{`
        @keyframes waveform {
          0% { transform: scaleY(0.3); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  )
}

// ── Chat message type ────────────────────────────────────────────────────────
interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  content: string
  timestamp: number
}

export default function FloatingAIAssistant() {
  const { mode: aiMode, toggle: toggleAI } = useAIStore()
  const location = useLocation()
  const isOpen = aiMode === 'popup'
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('text')
  const [textInput, setTextInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const textInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const voice = useVoiceChat()

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, voice.state])

  // Sync voice transcript and AI response into message history
  useEffect(() => {
    if (voice.transcript && voice.state === 'thinking') {
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role === 'user' && last.content === voice.transcript) return prev
        return [...prev, { id: crypto.randomUUID(), role: 'user', content: voice.transcript, timestamp: Date.now() }]
      })
    }
  }, [voice.transcript, voice.state])

  useEffect(() => {
    if (voice.aiResponse && voice.state !== 'thinking') {
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last?.role === 'ai' && last.content === voice.aiResponse) return prev
        return [...prev, { id: crypto.randomUUID(), role: 'ai', content: voice.aiResponse, timestamp: Date.now() }]
      })
    }
  }, [voice.aiResponse, voice.state])

  // Focus text input when switching to text mode
  useEffect(() => {
    if (inputMode === 'text' && isOpen) {
      setTimeout(() => textInputRef.current?.focus(), 100)
    }
  }, [inputMode, isOpen])

  function handleTextSend() {
    const text = textInput.trim()
    if (!text || voice.state === 'thinking') return
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() },
    ])
    setTextInput('')
    voice.sendToAI(text)
  }

  function handleTextKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleTextSend()
    }
  }

  const avatarStyle = AVATAR_STYLES[voice.state]
  const shouldPulse = voice.state !== 'idle'

  // Hide when another AI surface is active — only one at a time
  if (aiMode === 'bar' || aiMode === 'fn-voice' || location.pathname === '/ai-chat') return null

  return (
    <>
      {/* Floating button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            onClick={() => toggleAI('popup')}
            className="fixed bottom-6 right-6 w-12 h-12 rounded-full shadow-lg hover:scale-105 transition-all duration-200 z-40 text-white"
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              boxShadow: isOpen
                ? '0 4px 20px rgba(59,130,246,0.4), 0 0 0 3px rgba(99,102,241,0.15)'
                : '0 4px 20px rgba(59,130,246,0.3)',
            }}
          >
            {isOpen ? <IconX size={22} /> : <IconMessage size={22} />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>AI Assistant</TooltipContent>
      </Tooltip>

      {/* Popup */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-6 w-[380px] rounded-2xl border border-border shadow-2xl bg-card z-50 overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 fade-in duration-200"
          style={{
            height: '560px',
            maxHeight: 'calc(100vh - 120px)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.35), 0 0 0 1px hsl(var(--border) / 0.3)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${shouldPulse ? 'animate-pulse' : ''}`}
                style={{ background: avatarStyle.gradient, boxShadow: avatarStyle.shadow }}
              >
                {voice.state === 'listening' ? (
                  <WaveformBars size="sm" />
                ) : voice.state === 'thinking' ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                ) : (
                  <IconRobot size={16} className="text-white" />
                )}
              </div>
              <div>
                <span className="text-sm font-semibold text-foreground">AI Assistant</span>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
                  {STATE_LABELS[voice.state]}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      voice.resetConversation()
                      setMessages([])
                      setTextInput('')
                    }}
                    className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <IconPlus size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New conversation</TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  voice.stopListening()
                  voice.resetConversation()
                  speechSynthesis.cancel()
                  toggleAI('popup')
                }}
                className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <IconX size={14} />
              </Button>
            </div>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && voice.state === 'idle' && (
              <div className="flex flex-col items-center justify-center h-full text-center px-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', opacity: 0.15 }}
                >
                  <IconRobot size={32} className="text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Hi, I'm your AI assistant</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ask me anything about your recruits, pipeline, or use voice to talk to me.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                    msg.role === 'user' ? 'bg-primary/15' : 'bg-emerald-500/15'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <IconUser size={12} className="text-primary" />
                  ) : (
                    <IconRobot size={12} className="text-emerald-400" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary/10 text-foreground border border-primary/10'
                      : 'bg-muted/60 text-foreground border border-border/50'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.role === 'ai' ? msg.content.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').replace(/`(.*?)`/g, '$1') : msg.content}</p>
                </div>
              </div>
            ))}

            {/* Thinking indicator */}
            {voice.state === 'thinking' && (
              <div className="flex gap-2.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 bg-emerald-500/15">
                  <IconRobot size={12} className="text-emerald-400" />
                </div>
                <div className="bg-muted/60 border border-border/50 rounded-xl px-3 py-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {voice.error && (
              <p className="text-xs text-red-400 text-center py-1">{voice.error}</p>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="shrink-0 border-t border-border px-3 py-3 space-y-2">
            {/* Text input */}
            <div className="flex items-center gap-2">
              <Input
                ref={textInputRef}
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={handleTextKeyDown}
                placeholder={inputMode === 'voice' ? 'Or type a message...' : 'Type a message...'}
                disabled={voice.state === 'thinking'}
                className="flex-1 h-9 rounded-lg border-border bg-muted/30 px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30 focus-visible:border-primary/40 transition-colors disabled:opacity-50"
              />
              <Button
                size="icon"
                onClick={handleTextSend}
                disabled={!textInput.trim() || voice.state === 'thinking'}
                className="w-9 h-9 rounded-lg shrink-0"
              >
                <IconSend size={14} />
              </Button>
            </div>

            {/* Bottom controls */}
            <div className="flex items-center justify-center gap-1.5">
              {/* Mic button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setInputMode('voice')
                      if (voice.state === 'listening') {
                        voice.stopListening()
                      } else if (voice.state === 'idle') {
                        voice.startListening()
                      }
                    }}
                    disabled={!voice.isSupported || voice.state === 'thinking' || voice.state === 'speaking'}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors h-auto ${
                      voice.state === 'listening'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : inputMode === 'voice'
                          ? 'bg-primary/10 text-primary border border-primary/20'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <IconMicrophone size={14} />
                    <span>{voice.state === 'listening' ? 'Stop' : 'Mic'}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{voice.state === 'listening' ? 'Stop listening' : 'Start listening'}</TooltipContent>
              </Tooltip>

              {/* Text mode button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setInputMode('text')
                      setTimeout(() => textInputRef.current?.focus(), 50)
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors h-auto ${
                      inputMode === 'text'
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <IconKeyboard size={14} />
                    <span>Text</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Text mode</TooltipContent>
              </Tooltip>

              {/* Mute toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    onClick={voice.toggleMute}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors h-auto ${
                      voice.isMuted
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {voice.isMuted ? <IconVolume3 size={14} /> : <IconVolume size={14} />}
                    <span>{voice.isMuted ? 'Muted' : 'Sound'}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{voice.isMuted ? 'Unmute TTS' : 'Mute TTS'}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
