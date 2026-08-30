import { useMemo } from 'react'
import { format, isToday, isTomorrow, parseISO, isPast } from 'date-fns'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { IconCalendarEvent, IconCalendarOff } from '@tabler/icons-react'
import { containerVariants, itemVariants } from '@/lib/motion'
import EventBlock from './EventBlock'
import OutcomePrompt from './OutcomePrompt'
import type { CalendarEvent } from './constants'

interface AgendaPanelProps {
  events: CalendarEvent[]
  onSelectEvent: (eventId: string) => void
  onOutcome: (eventId: string, outcome: string) => void
}

function dayLabel(dateStr: string): string {
  const d = parseISO(dateStr)
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'EEE, MMM d')
}

export default function AgendaPanel({ events, onSelectEvent, onOutcome }: AgendaPanelProps) {
  // Group events by day
  const groupedEvents = useMemo(() => {
    const groups: Record<string, CalendarEvent[]> = {}
    for (const event of events) {
      const key = event.startTime.slice(0, 10)
      if (!groups[key]) groups[key] = []
      groups[key].push(event)
    }
    return groups
  }, [events])

  const dayKeys = Object.keys(groupedEvents).sort()

  // Active statuses that can receive outcomes
  const activeStatuses = new Set(['accepted', 'confirmed', 'scheduled', 'pending'])

  return (
    <Card className="border-border/30 h-full bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold flex items-center gap-2">
          <IconCalendarEvent size={14} className="text-purple-400" />
          Agenda
          <Badge variant="outline" className="text-[9px] ml-auto">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-y-auto max-h-[calc(100vh-280px)] space-y-4">
        {dayKeys.length === 0 ? (
          <div className="text-center py-8">
            <IconCalendarOff size={28} className="text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No events in this view</p>
          </div>
        ) : (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
            {dayKeys.map((day) => (
              <motion.div key={day} variants={itemVariants}>
                {/* Day header */}
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {dayLabel(day)}
                  </h4>
                  <div className="flex-1 h-px bg-border/30" />
                  <Badge variant="outline" className="text-[9px]">
                    {groupedEvents[day].length}
                  </Badge>
                </div>

                {/* Event cards */}
                <div className="space-y-1.5">
                  {groupedEvents[day].map((event) => {
                    const eventEnd = new Date(event.endTime)
                    const isPastEvent = isPast(eventEnd)
                    const needsOutcome = isPastEvent && activeStatuses.has(event.status) && event.source === 'manual'

                    return (
                      <div key={event.id}>
                        <EventBlock
                          event={event}
                          variant="agenda-card"
                          onSelect={onSelectEvent}
                        />
                        {needsOutcome && (
                          <OutcomePrompt event={event} onOutcome={onOutcome} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}
