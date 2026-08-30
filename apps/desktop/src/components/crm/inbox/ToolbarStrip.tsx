import { useState } from 'react'
import { IconClockHour4, IconArchive } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  useCloseConversation,
  useSnoozeConversation,
} from '@/hooks/useConversations'
import { useContact } from '@/hooks/useContacts'
import type { Conversation } from '@/types/portal'
import { CHANNEL_ICON, CHANNEL_LABEL, CHANNEL_TINT } from './channel-tint'
import { SnoozeDurationDialog } from './SnoozeDurationDialog'

interface ToolbarStripProps {
  conversation: Conversation
}

/** ToolbarStrip — horizontal action bar above the message scroll.
 *  Left: snooze / close actions that are backed by current conversation APIs.
 *  Right: contact-name · channel · provider breadcrumb. */
export function ToolbarStrip({ conversation }: ToolbarStripProps) {
  const [snoozeOpen, setSnoozeOpen] = useState(false)
  const { data: contact } = useContact(conversation.contactId)

  const snoozeMutation = useSnoozeConversation()
  const closeMutation = useCloseConversation()

  const Icon = CHANNEL_ICON[conversation.channel]
  const tint = CHANNEL_TINT[conversation.channel]
  const channelLabel = CHANNEL_LABEL[conversation.channel]

  const handleSnoozePick = (snoozeUntilIso: string) => {
    snoozeMutation.mutate({ id: conversation.id, snoozeUntil: snoozeUntilIso })
  }

  const handleClose = () => {
    closeMutation.mutate(conversation.id)
  }

  return (
    <>
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/50 bg-card/30 px-3 backdrop-blur">
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSnoozeOpen(true)}
                aria-label="Snooze conversation"
              >
                <IconClockHour4 size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Snooze</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleClose}
                aria-label="Close conversation"
              >
                <IconArchive size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="max-w-[180px] truncate font-medium text-foreground/80">
            {contact?.fullName ?? conversation.contactId}
          </span>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <Icon size={12} style={{ color: tint }} />
            {channelLabel}
          </span>
          <span aria-hidden>·</span>
          <span className="lowercase">{conversation.provider}</span>
        </div>
      </div>

      <SnoozeDurationDialog
        open={snoozeOpen}
        onOpenChange={setSnoozeOpen}
        onPick={handleSnoozePick}
      />
    </>
  )
}
