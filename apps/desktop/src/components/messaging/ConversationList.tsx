import { IconMessageCircle, IconLink } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { RECRUIT_STAGE_COLORS, RECRUIT_STAGE_LABELS, type RecruitStage } from '../../types/portal'

interface SmsConversation {
  agentId: string
  lastMessage: string
  lastAt: string
}

interface WhatsAppConversation {
  id: string
  contactPhone: string
  contactName: string | null
  lastMessageAt: string | null
  unreadCount: number
  lastMessage?: string
  lastAt?: string
  messageCount?: number
  recruitId?: string | null
}

interface Props {
  tab: 'sms' | 'whatsapp'
  smsConversations: SmsConversation[]
  whatsappConversations: WhatsAppConversation[]
  selectedId: string | null
  onSelect: (id: string) => void
  recruitStages?: Record<string, RecruitStage>
  onLinkRecruit?: (conversationId: string) => void
}

export default function ConversationList({ tab, smsConversations, whatsappConversations, selectedId, onSelect, recruitStages, onLinkRecruit }: Props) {
  if (tab === 'sms') {
    return (
      <div className="space-y-0.5">
        {smsConversations.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <IconMessageCircle size={24} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs">No SMS conversations</p>
          </div>
        )}
        {smsConversations.map((conv) => (
          <Button
            key={conv.agentId}
            variant="ghost"
            onClick={() => onSelect(conv.agentId)}
            className={`w-full text-left px-3 py-2.5 h-auto rounded-lg transition-colors justify-start flex-col items-start ${
              selectedId === conv.agentId ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
            }`}
          >
            <p className="text-sm text-foreground truncate font-medium">{conv.agentId.slice(0, 12)}...</p>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(conv.lastAt).toLocaleString()}</p>
          </Button>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {whatsappConversations.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <IconMessageCircle size={24} className="mx-auto mb-2 opacity-30" />
          <p className="text-xs">No WhatsApp conversations</p>
        </div>
      )}
      {whatsappConversations.map((conv) => {
        const stage = conv.recruitId && recruitStages ? recruitStages[conv.recruitId] : null
        return (
          <Button
            key={conv.id}
            variant="ghost"
            onClick={() => onSelect(conv.id)}
            className={`w-full text-left px-3 py-2.5 h-auto rounded-lg transition-colors justify-start flex-col items-stretch ${
              selectedId === conv.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <p className="text-sm text-foreground font-medium truncate">{conv.contactName || conv.contactPhone}</p>
              <div className="flex items-center gap-1 shrink-0">
                {stage && (
                  <Badge
                    className="text-[9px] px-1.5 py-0.5"
                    style={{ backgroundColor: `${RECRUIT_STAGE_COLORS[stage]}25`, color: RECRUIT_STAGE_COLORS[stage] }}
                  >
                    {RECRUIT_STAGE_LABELS[stage]}
                  </Badge>
                )}
                {!conv.recruitId && onLinkRecruit && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        onClick={(e) => { e.stopPropagation(); onLinkRecruit(conv.id) }}
                        className="text-muted-foreground hover:text-foreground cursor-pointer"
                      >
                        <IconLink size={12} />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Link to recruit</TooltipContent>
                  </Tooltip>
                )}
                {!stage && (
                  <span className="text-[10px] text-muted-foreground">{conv.unreadCount || conv.messageCount || 0}</span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.lastMessage}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleString() : ''}</p>
          </Button>
        )
      })}
    </div>
  )
}
