import { forwardRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { IconRobot, IconUser, IconLoader2 } from '@tabler/icons-react'
import { useStreamingSimulation } from '../../hooks/useStreamingSimulation'
import { parseAIActions } from '../../types/ai-actions'
import AIActionCard from './AIActionCard'
import type { ChatMessage } from '../../types/portal'
import type { AIAction } from '../../types/ai-actions'

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
}

function messageMargin(messages: ChatMessage[], index: number): string {
  if (index === 0) return ''
  const prev = messages[index - 1]
  const curr = messages[index]
  return prev.role === curr.role ? 'mt-0.5' : 'mt-6'
}

// ── Streaming AI Message ──────────────────────────────────────────────────────

function StreamingAIMessage({ content }: { content: string }) {
  const { displayedWords, isComplete } = useStreamingSimulation(
    stripMarkdown(content),
    true,
    30,
  )

  return (
    <span className="whitespace-pre-wrap">
      {displayedWords.map((word) => (
        <span
          key={word.index}
          className={word.isKeyData && !isComplete ? 'key-data-glow' : ''}
        >
          {word.text}{' '}
        </span>
      ))}
    </span>
  )
}

// ── Focal Blur Loading ────────────────────────────────────────────────────────

function FocalBlurLoading() {
  return (
    <div className="flex items-start gap-3 px-4 max-w-[85%]">
      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
        <IconRobot size={14} className="text-[#7dd3fc]" />
      </div>
      <motion.div
        initial={{ filter: 'blur(10px)', opacity: 0.5 }}
        animate={{ filter: 'blur(0px)', opacity: 1 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        className="glass-response px-5 py-4 flex-1"
      >
        <div className="flex items-center gap-3">
          <IconLoader2 size={16} className="text-vipa-lime/60 animate-spin" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-white/[0.06] rounded-full w-3/4 animate-shimmer shimmer-line" />
            <div className="h-3 bg-white/[0.06] rounded-full w-1/2 animate-shimmer shimmer-line [animation-delay:0.1s]" />
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ── AI Message with Actions ──────────────────────────────────────────────────

function AIMessageWithActions({
  msg,
  isStreaming,
  actionStates,
  onConfirmAction,
  onDismissAction,
}: {
  msg: ChatMessage
  isStreaming: boolean
  actionStates?: Map<string, AIAction>
  onConfirmAction?: (action: AIAction) => void
  onDismissAction?: (action: AIAction) => void
}) {
  const parsed = useMemo(
    () => (isStreaming ? null : parseAIActions(msg.content, msg.toolCalls)),
    [msg.content, msg.toolCalls, isStreaming],
  )

  const displayText = parsed?.text ?? msg.content
  const actions = parsed?.actions ?? []

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, mass: 0.8 }}
      className="flex items-start gap-3 max-w-[85%]"
    >
      <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
        <IconRobot size={14} className="text-[#7dd3fc]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="glass-response px-5 py-4 text-sm leading-relaxed text-foreground dark:text-white/90 relative">
          <IconRobot
            size={32}
            className="absolute top-3 right-3 text-muted-foreground/[0.08]"
          />
          {isStreaming ? (
            <StreamingAIMessage content={msg.content} />
          ) : (
            <span className="whitespace-pre-wrap">
              {stripMarkdown(displayText)}
            </span>
          )}
        </div>
        {/* AI Action Cards */}
        {actions.map((action) => {
          const currentState = actionStates?.get(action.id) ?? action
          if (currentState.status === 'dismissed') return null
          return (
            <AIActionCard
              key={action.id}
              action={currentState}
              onConfirm={onConfirmAction ?? (() => {})}
              onDismiss={onDismissAction ?? (() => {})}
            />
          )
        })}
      </div>
    </motion.div>
  )
}

// ── Message List ──────────────────────────────────────────────────────────────

interface MessageListProps {
  messages: ChatMessage[]
  isThinking: boolean
  messagesLoading: boolean
  lastStreamingMessageId: string | null
  voiceError: string | null
  sendError: string | null
  actionStates?: Map<string, AIAction>
  onConfirmAction?: (action: AIAction) => void
  onDismissAction?: (action: AIAction) => void
}

const MessageList = forwardRef<HTMLDivElement, MessageListProps>(
  ({ messages, isThinking, messagesLoading, lastStreamingMessageId, voiceError, sendError, actionStates, onConfirmAction, onDismissAction }, ref) => {
    return (
      <>
        {messagesLoading && (
          <div className="flex justify-center py-8">
            <IconLoader2 size={24} className="text-primary animate-spin" />
          </div>
        )}

        {messages.map((msg, index) => {
          const isUser = msg.role === 'user'
          const isStreaming = msg.id === lastStreamingMessageId && msg.role === 'assistant'

          return (
            <div
              key={msg.id}
              className={`flex px-4 ${messageMargin(messages, index)} ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {/* AI message — glassmorphic card with avatar + action cards */}
              {!isUser && (
                <AIMessageWithActions
                  msg={msg}
                  isStreaming={isStreaming}
                  actionStates={actionStates}
                  onConfirmAction={onConfirmAction}
                  onDismissAction={onDismissAction}
                />
              )}

              {/* User message — right-aligned dark monochrome bubble */}
              {isUser && (
                <motion.div
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24, mass: 0.8 }}
                  className="flex items-start gap-3 max-w-[85%]"
                >
                  <div className="px-4 py-3 text-sm leading-relaxed bg-white/10 border border-white/[0.05] text-white rounded-2xl rounded-tr-sm">
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                    <IconUser size={14} className="text-muted-foreground dark:text-white/60" />
                  </div>
                </motion.div>
              )}
            </div>
          )
        })}

        {isThinking && <FocalBlurLoading />}

        {sendError && (
          <div className="flex justify-center py-2 px-4">
            <div className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {sendError}
            </div>
          </div>
        )}

        {voiceError && (
          <p className="text-xs text-red-400 text-center py-1 px-4">{voiceError}</p>
        )}

        <div ref={ref} />
      </>
    )
  },
)

MessageList.displayName = 'MessageList'

export default MessageList
