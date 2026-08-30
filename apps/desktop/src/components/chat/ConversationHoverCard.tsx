import * as React from 'react'
import { useState } from 'react'
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from '@/components/ui/hover-card'
import { Separator } from '@/components/ui/separator'
import { useChatMessages } from '../../hooks/useChat'
import type { ChatConversation } from '../../types/portal'

interface ConversationHoverCardProps {
  conversation: ChatConversation
  children: React.ReactNode
}

function formatRelative(date: Date): string {
  const now = Date.now()
  const then = date.getTime()
  if (Number.isNaN(then)) return ''
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString()
}

function truncate(text: string, max: number): string {
  if (!text) return ''
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max).trimEnd()}…`
}

export default function ConversationHoverCard({
  conversation,
  children,
}: ConversationHoverCardProps) {
  const [open, setOpen] = useState(false)

  const { data, isLoading } = useChatMessages(open ? conversation.id : null)

  const messages = data?.messages ?? []
  const firstUserMsg = messages.find((m) => m.role === 'user')
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant')

  const createdAt = new Date(conversation.createdAt)
  const relative = formatRelative(createdAt)

  const hasPreview = !!(firstUserMsg || lastAssistantMsg)

  return (
    <HoverCard openDelay={300} closeDelay={100} open={open} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="w-80 bg-popover border-border rounded-lg shadow-lg p-3"
      >
        <div className="space-y-1">
          <p
            className="font-semibold text-foreground line-clamp-1"
            style={{ borderLeft: '2px solid #7dd3fc', paddingLeft: 8 }}
          >
            {conversation.title || 'Untitled conversation'}
          </p>
          <p className="text-xs text-muted-foreground">{relative}</p>
        </div>

        <Separator className="my-2" />

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-3 w-3/4 bg-muted/30 rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-muted/30 rounded animate-pulse" />
          </div>
        ) : hasPreview ? (
          <div className="space-y-1.5">
            {firstUserMsg && (
              <p className="text-xs">
                <span className="text-muted-foreground">You:</span>{' '}
                <span className="text-foreground">{truncate(firstUserMsg.content, 80)}</span>
              </p>
            )}
            {lastAssistantMsg && (
              <p className="text-xs">
                <span className="text-muted-foreground">AI:</span>{' '}
                <span className="text-foreground">{truncate(lastAssistantMsg.content, 100)}</span>
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs italic text-muted-foreground">Open to preview</p>
        )}
      </HoverCardContent>
    </HoverCard>
  )
}
