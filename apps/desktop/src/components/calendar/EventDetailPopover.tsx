import { useState } from 'react'
import { format } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
import {
  IconClock,
  IconUser,
  IconCalendarEvent,
  IconLink,
  IconCircleCheck,
  IconCircleX,
  IconCalendarStats,
  IconCopy,
  IconExternalLink,
  IconTrash,
} from '@tabler/icons-react'
import { toast } from 'sonner'
import { useUpdateAppointmentStatus } from '@/hooks/useAppointments'
import { useDeleteGoogleEvent } from '@/hooks/useGoogleCalendar'
import QuickSharePopover from './QuickSharePopover'
import { STATUS_COLORS, EVENT_CATEGORY_COLORS } from './constants'
import type { CalendarEvent } from './constants'

interface EventDetailPopoverProps {
  event: CalendarEvent | undefined
  onClose: () => void
  calcomUsername: string | undefined
}

export default function EventDetailPopover({ event, onClose, calcomUsername }: EventDetailPopoverProps) {
  const updateStatus = useUpdateAppointmentStatus()
  const deleteGoogleEvent = useDeleteGoogleEvent()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (!event) return null

  // Capture in a const so TS narrows inside closures
  const evt = event
  const googleEventId = evt.googleEventId ?? evt.id.replace('google-', '')

  const start = new Date(evt.startTime)
  const end = new Date(evt.endTime)
  const duration = Math.round((end.getTime() - start.getTime()) / 60000)
  const statusColor = STATUS_COLORS[evt.status] ?? '#6b7280'
  const categoryColor = EVENT_CATEGORY_COLORS[evt.category] ?? '#6b7280'

  // Build booking URL for Cal.com events
  const bookingUrl =
    evt.source === 'calcom' && calcomUsername && evt.eventType
      ? `https://cal.com/${calcomUsername}`
      : null

  function handleStatusChange(newStatus: string) {
    if (evt.source === 'calcom') {
      toast.info('Update this booking status directly in Cal.com')
      return
    }
    updateStatus.mutate(
      { id: evt.id, status: newStatus },
      {
        onSuccess: () => {
          toast.success(`Status updated to ${newStatus.replace('_', ' ')}`)
          onClose()
        },
        onError: () => toast.error('Failed to update status'),
      },
    )
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center h-10 w-10 rounded-xl border"
              style={{ background: `${categoryColor}10`, borderColor: `${categoryColor}30` }}
            >
              <IconCalendarEvent size={20} style={{ color: categoryColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-sm">{event.title}</DialogTitle>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Badge
                  className="text-[9px]"
                  style={{ background: `${statusColor}20`, color: statusColor, borderColor: `${statusColor}40` }}
                >
                  {event.status.replace('_', ' ')}
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[9px]"
                  style={{ color: categoryColor, borderColor: `${categoryColor}40` }}
                >
                  {event.category.replace('_', ' ')}
                </Badge>
                {event.source === 'calcom' && (
                  <Badge variant="outline" className="text-[9px] text-purple-400 border-purple-500/30">
                    Cal.com
                  </Badge>
                )}
                {event.source === 'google' && (
                  <Badge variant="outline" className="text-[9px] text-red-400 border-red-500/30">
                    Google
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          {/* Time */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <IconClock size={14} />
            <span>
              {format(start, 'EEE, MMM d · h:mm a')} – {format(end, 'h:mm a')}
            </span>
            <Badge variant="outline" className="text-[9px]">{duration} min</Badge>
          </div>

          {/* Attendee */}
          {event.attendee && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <IconUser size={14} />
              <span>{event.attendee}</span>
            </div>
          )}

          {/* Event Type */}
          {event.eventType && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <IconCalendarStats size={14} />
              <span>{event.eventType}</span>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <>
              <Separator />
              <p className="text-xs text-muted-foreground">{event.description}</p>
            </>
          )}

          {/* Agent Context Card */}
          {event.agentName && (
            <>
              <Separator />
              <Card className="border-border/30">
                <CardContent className="p-3">
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1">Agent</p>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <IconUser size={12} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">{event.agentName}</p>
                      {event.agentId && (
                        <p className="text-[10px] text-muted-foreground">ID: {event.agentId}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Google Account Info */}
          {event.source === 'google' && event.accountEmail && (
            <>
              <Separator />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: event.color }} />
                <span>Google Account: {event.accountEmail}</span>
              </div>
            </>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Meeting Link */}
            {event.meetingLink && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => window.open(event.meetingLink!, '_blank')}
              >
                <IconLink size={12} className="mr-1" />
                Join Meeting
              </Button>
            )}

            {/* Quick Share */}
            {bookingUrl && (
              <QuickSharePopover bookingUrl={bookingUrl}>
                <Button variant="outline" size="sm" className="text-xs">
                  <IconCopy size={12} className="mr-1" />
                  Share Link
                </Button>
              </QuickSharePopover>
            )}

            {/* Status Actions */}
            <div className="flex-1" />
            {event.source === 'manual' && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-emerald-400 hover:text-emerald-300"
                  onClick={() => handleStatusChange('completed')}
                  disabled={updateStatus.isPending}
                >
                  <IconCircleCheck size={12} className="mr-1" />
                  Confirm
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-red-400 hover:text-red-300"
                  onClick={() => handleStatusChange('cancelled')}
                  disabled={updateStatus.isPending}
                >
                  <IconCircleX size={12} className="mr-1" />
                  Cancel
                </Button>
              </>
            )}
            {event.source === 'google' && !confirmingDelete && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    window.open(`https://calendar.google.com/calendar/r/eventedit/${googleEventId}`, '_blank')
                  }}
                >
                  <IconExternalLink size={12} className="mr-1" />
                  Edit in Google
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs text-red-400 hover:text-red-300"
                  onClick={() => setConfirmingDelete(true)}
                >
                  <IconTrash size={12} className="mr-1" />
                  Delete
                </Button>
              </>
            )}
          </div>

          {/* Google event delete confirmation */}
          {confirmingDelete && (
            <div className="space-y-3 p-3 rounded-lg border border-red-500/20 bg-red-500/5">
              <p className="text-xs text-muted-foreground">
                This will permanently delete &ldquo;{event.title}&rdquo; from your Google Calendar. Attendees will be notified.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs"
                  disabled={deleteGoogleEvent.isPending}
                  onClick={async () => {
                    try {
                      await deleteGoogleEvent.mutateAsync({ accountId: evt.accountId, eventId: googleEventId })
                      toast.success('Event deleted from Google Calendar')
                      onClose()
                    } catch {
                      toast.error('Failed to delete event')
                    }
                  }}
                >
                  {deleteGoogleEvent.isPending ? 'Deleting...' : 'Delete from Google'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
