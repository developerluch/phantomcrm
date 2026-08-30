import { IconRefresh, IconTemplate } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useResendMessage } from '@/hooks/useSendMessage'
import { useAuthStore } from '@/store'
import type { Contact, Message } from '@/types/portal'
import { CHANNEL_TINT } from './channel-tint'
import { MessageStatusBadge } from './MessageStatusBadge'
import { formatRelativeShort } from './relative-time'

interface MessageBubbleProps {
  message: Message
  contact?: Contact
}

/** Single message bubble with channel-tinted accent border + sender
 *  attribution. Direction picks side and accent edge:
 *    - inbound:  contact-name row above, 2px LEFT border in channel tint
 *    - outbound: status row + agent · time row below, 2px RIGHT border
 *  Status badge sits outside the bubble in its own row (between the
 *  bubble and the agent · time line) for outbound messages only. */
export function MessageBubble({ message, contact }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound'
  const user = useAuthStore((s) => s.user)
  const resend = useResendMessage()

  const tint = CHANNEL_TINT[message.channel]
  const isFailed =
    message.status === 'failed' || message.status === 'delivery_failed'

  const inboundLabel = contact?.fullName ?? 'Contact'

  const outboundLabel = (() => {
    if (message.sentByAutomationId) return 'Automation'
    if (
      user &&
      message.sentByAgentId &&
      (message.sentByAgentId === user.id || message.sentByAgentId === user.discordId)
    ) {
      return user.displayName
    }
    return 'Agent'
  })()

  return (
    <div className={cn('flex w-full flex-col', isOutbound ? 'items-end' : 'items-start')}>
      {!isOutbound && (
        <div className="mb-0.5 px-1 text-[10px] text-muted-foreground">
          {inboundLabel}
        </div>
      )}

      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm',
          isOutbound
            ? 'rounded-br-sm border-r-2 bg-primary/10 text-foreground'
            : 'rounded-bl-sm border-l-2 bg-card/80 text-foreground',
          isFailed && 'bg-destructive/20',
        )}
        style={{ [isOutbound ? 'borderRightColor' : 'borderLeftColor']: tint }}
      >
        {message.channel === 'whatsapp' && message.templateId && (
          <Badge
            variant="outline"
            className="mb-1.5 gap-1 text-[10px]"
            style={{ borderColor: CHANNEL_TINT.whatsapp + '80' }}
          >
            <IconTemplate size={10} />
            Template
          </Badge>
        )}
        {message.channel === 'email' && message.subject?.trim() && (
          <div className="mb-1 text-sm font-semibold leading-tight">
            {message.subject}
          </div>
        )}
        {message.body && (
          <div className="whitespace-pre-wrap break-words">{message.body}</div>
        )}
        {message.templateId && !message.body && message.channel !== 'whatsapp' && (
          <div className="text-xs italic opacity-80">
            Template: {message.templateId}
          </div>
        )}
        {message.errorMessage && (
          <div className="mt-1 text-xs text-destructive">{message.errorMessage}</div>
        )}
      </div>

      {isOutbound && (
        <div className="mt-0.5 flex items-center justify-end gap-1.5 px-1">
          <MessageStatusBadge
            status={message.status}
            errorCode={message.errorCode}
            errorMessage={message.errorMessage}
          />
          {isFailed && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 gap-1 px-1.5 text-[10px] text-destructive hover:text-destructive"
              onClick={() =>
                resend.mutate({
                  conversationId: message.conversationId,
                  messageId: message.id,
                })
              }
              disabled={resend.isPending}
            >
              <IconRefresh size={12} />
              Retry
            </Button>
          )}
        </div>
      )}

      {isOutbound && (
        <div className="mt-0.5 px-1 text-[10px] text-muted-foreground">
          {outboundLabel} · {formatRelativeShort(message.createdAt)}
        </div>
      )}
    </div>
  )
}
