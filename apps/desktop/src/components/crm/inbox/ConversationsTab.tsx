import { useNavigate } from 'react-router-dom'
import {
  IconMessageCircle,
  IconBrandWhatsapp,
  IconBrandApple,
  IconMail,
  IconPhone,
  IconArrowUpRight,
} from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useContactConversations } from '@/hooks/useConversations'
import type { Channel } from '@/types/portal'

const CHANNEL_ICON: Record<Channel, typeof IconMessageCircle> = {
  sms: IconMessageCircle,
  whatsapp: IconBrandWhatsapp,
  imessage: IconBrandApple,
  email: IconMail,
  voice: IconPhone,
}

interface ConversationsTabProps {
  contactId: string
  onClose: () => void
}

/** Per-contact conversations tab for the ContactDetailDrawer. Renders a
 *  compact list of every thread the contact has ever had (no virtualization
 *  — contacts typically carry only a handful of threads). Clicking a row
 *  closes the drawer and deep-links to /crm/inbox/:threadId. */
export function ConversationsTab({ contactId, onClose }: ConversationsTabProps) {
  const navigate = useNavigate()
  const { data, isLoading } = useContactConversations(contactId)

  const open = (threadId: string) => {
    onClose()
    navigate(`/crm/inbox/${encodeURIComponent(threadId)}`)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  const conversations = data?.conversations ?? []

  if (conversations.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
        No conversations yet. Outbound messages will start a thread.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {conversations.map((conv) => {
        const Icon = CHANNEL_ICON[conv.channel] ?? IconMessageCircle
        return (
          <Button
            key={conv.id}
            type="button"
            variant="ghost"
            onClick={() => open(conv.id)}
            className={cn(
              'flex h-auto w-full justify-start items-center gap-3 rounded-md border border-border/40 bg-card/30',
              'px-3 py-2 text-left transition-colors hover:bg-white/[0.04]',
            )}
            data-clickable
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card/60 text-muted-foreground">
              <Icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium capitalize">
                  {conv.channel}
                </span>
                <span className="text-xs text-muted-foreground">· {conv.provider}</span>
                <Badge
                  variant={conv.status === 'open' ? 'default' : 'secondary'}
                  className="ml-auto text-[10px] capitalize"
                >
                  {conv.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                {conv.lastInboundAt
                  ? `Last inbound ${formatTimeAgo(conv.lastInboundAt)}`
                  : conv.lastOutboundAt
                    ? `Last outbound ${formatTimeAgo(conv.lastOutboundAt)}`
                    : 'No messages yet'}
                {conv.unreadCount > 0 && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">
                    {conv.unreadCount} unread
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" tabIndex={-1} className="h-8 w-8">
              <IconArrowUpRight size={14} />
            </Button>
          </Button>
        )
      })}
    </div>
  )
}

function formatTimeAgo(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = Date.now() - t
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}
