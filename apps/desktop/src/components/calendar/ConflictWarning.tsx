import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { IconAlertTriangle } from '@tabler/icons-react'
import type { CalendarEvent } from './constants'

interface ConflictWarningProps {
  conflicts: CalendarEvent[]
}

export default function ConflictWarning({ conflicts }: ConflictWarningProps) {
  if (conflicts.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <div className="flex items-center gap-2 mb-2">
        <IconAlertTriangle size={14} className="text-amber-400 shrink-0" />
        <span className="text-xs font-semibold text-amber-400">
          {conflicts.length} scheduling conflict{conflicts.length !== 1 ? 's' : ''} detected
        </span>
      </div>
      <div className="space-y-1.5">
        {conflicts.map((event) => (
          <div key={event.id} className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ background: event.color }}
            />
            <span className="font-medium text-foreground truncate">{event.title}</span>
            <span className="shrink-0">
              {format(new Date(event.startTime), 'h:mm a')} – {format(new Date(event.endTime), 'h:mm a')}
            </span>
            {event.attendee && <span className="truncate text-muted-foreground/60">{event.attendee}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
