import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { IconMessages } from '@tabler/icons-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useWebSocketContext } from '@/contexts/WebSocketContext'
import { useConversation } from '@/hooks/useConversation'
import { useReadConversation } from '@/hooks/useConversations'
import { useContact } from '@/hooks/useContacts'
import type { ConversationDetailResponse, MessageStatus } from '@/types/portal'
import { MessageBubble } from './MessageBubble'
import { Composer } from './Composer'
import { ToolbarStrip } from './ToolbarStrip'

interface ConversationViewProps {
  threadId: string | undefined
}

/** Conversation view + Composer. Auto-scrolls to bottom on new messages.
 *  Hits POST /read on mount/swap so unread_count clears in the inbox list. */
export function ConversationView({ threadId }: ConversationViewProps) {
  const { data, isLoading } = useConversation(threadId)
  const { data: contact } = useContact(data?.conversation.contactId)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const readMutation = useReadConversation()
  const qc = useQueryClient()
  const { subscribe } = useWebSocketContext()

  // Mark read on enter; the dependency on threadId means switching threads
  // re-marks the new one as read.
  useEffect(() => {
    if (threadId) {
      readMutation.mutate(threadId)
    }
    // We intentionally don't include readMutation in deps — react-query
    // mutation refs are stable but ESLint sometimes flags them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId])

  // Subscribe to delivery-status updates for the open thread. Backend WS
  // payload is snake_case at the API boundary; transform to camelCase when
  // writing to local cache. Graceful no-op if the event never fires.
  useEffect(() => {
    if (!threadId) return
    const unsub = subscribe('message:status_updated', (data: unknown) => {
      const evt = data as {
        conversation_id: string
        message_id: string
        status: string
        error_code?: string
        error_message?: string
        updated_at: string
      }
      if (evt.conversation_id !== threadId) return
      qc.setQueryData<ConversationDetailResponse>(
        ['crm', 'conversations', 'detail', threadId],
        (old) =>
          old
            ? {
                ...old,
                messages: old.messages.map((m) =>
                  m.id === evt.message_id
                    ? {
                        ...m,
                        status: evt.status as MessageStatus,
                        errorCode: evt.error_code,
                        errorMessage: evt.error_message,
                      }
                    : m,
                ),
              }
            : old,
      )
    })
    return unsub
  }, [threadId, subscribe, qc])

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [data?.messages.length])

  if (!threadId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card/40 text-muted-foreground/70">
          <IconMessages size={26} />
        </div>
        <p className="text-sm font-medium text-foreground/80">
          Select a conversation
        </p>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
          Pick a thread from the list to view its messages. Inbound and outbound history, templates, and the 24-hour WhatsApp window all appear here.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-3 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className={i % 2 ? 'h-12 w-2/3 self-end' : 'h-12 w-2/3'} />
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Conversation not found
      </div>
    )
  }

  // Backend returns messages newest-first (DESC). Reverse for top-to-bottom
  // chronological display.
  const messages = [...data.messages].reverse()

  return (
    <div className="flex h-full flex-col">
      <ToolbarStrip conversation={data.conversation} />
      <div
        ref={scrollRef}
        className="custom-scrollbar flex-1 overflow-y-auto px-4 py-3"
      >
        <div className="flex flex-col gap-2">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} contact={contact} />
          ))}
        </div>
      </div>
      <Composer conversation={data.conversation} contactId={data.conversation.contactId} />
    </div>
  )
}
