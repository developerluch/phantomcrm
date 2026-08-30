import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { Conversation } from '@/types/portal'
import { CHANNEL_ICON, CHANNEL_TINT } from './channel-tint'

interface ThreadRowProps {
  conversation: Conversation
  selected: boolean
  isChecked: boolean
  bulkActive: boolean
  onSelect: () => void
  onToggleCheck: (e: { shiftKey: boolean }) => void
}

export function ThreadRow({
  conversation,
  selected,
  isChecked,
  bulkActive,
  onSelect,
  onToggleCheck,
}: ThreadRowProps) {
  const Icon = CHANNEL_ICON[conversation.channel]
  const tint = CHANNEL_TINT[conversation.channel]
  const initials = initialsOf(conversation.contactId)
  const snippet = conversation.channel
  const providerLabel = providerLabelOf(conversation.provider)
  const timestamp = conversation.lastInboundAt
    ? formatTimeAgo(conversation.lastInboundAt)
    : ''

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onSelect()
        } else if (e.key === ' ' || e.code === 'Space') {
          e.preventDefault()
          onToggleCheck({ shiftKey: e.shiftKey })
        }
      }}
      className={cn(
        'group relative flex h-16 w-full items-center gap-3 px-3 text-left',
        'cursor-pointer border-l-2 border-transparent transition-colors',
        'hover:bg-accent/20',
        'focus-visible:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        selected && 'bg-accent/30 hover:bg-accent/30 focus-visible:bg-accent/30',
        !selected && isChecked && 'bg-white/[0.06]',
      )}
      style={selected ? { borderLeftColor: tint } : undefined}
      data-clickable
      data-selected={isChecked || undefined}
    >
      <span
        className={cn(
          'shrink-0 transition-opacity duration-150 motion-reduce:transition-none',
          bulkActive || isChecked
            ? 'opacity-100'
            : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
        )}
        onClick={(e) => {
          e.stopPropagation()
          onToggleCheck({ shiftKey: e.shiftKey })
        }}
      >
        <Checkbox checked={isChecked} onCheckedChange={() => { /* handled by span onClick to capture shiftKey */ }} aria-hidden tabIndex={-1} />
      </span>
      <div className="relative shrink-0">
        <Avatar
          className="size-8"
          style={{ backgroundColor: tint, color: 'hsl(var(--background))' }}
        >
          <AvatarFallback
            style={{ backgroundColor: tint, color: 'hsl(var(--background))' }}
            className="text-xs font-semibold"
          >
            {initials}
          </AvatarFallback>
        </Avatar>
        <span
          className="absolute -bottom-0.5 -right-0.5 flex size-[14px] items-center justify-center rounded-full bg-card ring-1 ring-border"
          aria-hidden
        >
          <Icon className="size-2.5" style={{ color: tint }} />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium">
              {conversation.contactId}
            </span>
            {providerLabel && (
              <Badge
                variant="secondary"
                className="h-4 shrink-0 px-1.5 py-0 text-[10px] font-medium"
              >
                {providerLabel}
              </Badge>
            )}
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">
            {timestamp}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">
            {snippet.length > 50 ? `${snippet.slice(0, 50)}…` : snippet}
          </span>
          {conversation.unreadCount > 0 && (
            <Badge variant="secondary" className="shrink-0">
              {conversation.unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

function providerLabelOf(provider: string): string | null {
  if (provider === 'twilio') return 'Twilio'
  if (provider === 'telnyx') return 'Telnyx'
  return null
}

function initialsOf(label: string): string {
  return (
    label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

function formatTimeAgo(iso: string): string {
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return ''
  const diff = Date.now() - t
  if (diff < 60_000) return 'now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`
  return `${Math.floor(diff / 86_400_000)}d`
}
