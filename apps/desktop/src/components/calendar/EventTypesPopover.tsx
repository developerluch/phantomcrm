import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  IconCalendarEvent,
  IconCopy,
  IconExternalLink,
  IconCalendar,
} from '@tabler/icons-react'
import { toast } from 'sonner'
import type { CalcomEventType } from '../../types/portal'

interface EventTypesPopoverProps {
  eventTypes: CalcomEventType[]
  username: string
  connected: boolean
  children: React.ReactNode
}

export default function EventTypesPopover({
  eventTypes,
  username,
  connected,
  children,
}: EventTypesPopoverProps) {
  function copyBookingLink(slug: string) {
    const url = `https://cal.com/${username}/${slug}`
    navigator.clipboard.writeText(url)
    toast.success('Booking link copied!')
  }

  function openBookingPage(slug: string) {
    const url = `https://cal.com/${username}/${slug}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
      <Popover>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="end">
          <div className="p-3 border-b border-border/30">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <IconCalendarEvent size={12} className="text-purple-400" />
              Event Types
            </p>
          </div>

          <div className="p-2 max-h-64 overflow-y-auto">
            {!connected ? (
              <div className="text-center py-4">
                <IconCalendar size={20} className="text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Connect Cal.com in Settings</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 text-xs"
                  onClick={() => { window.location.hash = '#/settings' }}
                >
                  <IconExternalLink size={10} className="mr-1" />
                  Go to Settings
                </Button>
              </div>
            ) : eventTypes.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No event types configured
              </p>
            ) : (
              <div className="space-y-1">
                {eventTypes.map((et) => (
                  <div
                    key={et.id}
                    className="rounded-lg border border-border/30 p-2.5 hover:bg-muted/10 transition-colors cursor-pointer"
                    onClick={() => openBookingPage(et.slug)}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-foreground truncate">{et.title}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 shrink-0"
                        onClick={(e) => { e.stopPropagation(); copyBookingLink(et.slug) }}
                      >
                        <IconCopy size={10} />
                      </Button>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="outline" className="text-[9px]">{et.length} min</Badge>
                      {et.description && (
                        <span className="text-[9px] text-muted-foreground truncate">{et.description}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
  )
}
