import { useMemo, useState } from 'react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
} from 'date-fns'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { containerVariants, itemVariants } from '@/lib/motion'
import EventBlock from './EventBlock'
import { DAYS_OF_WEEK } from './constants'
import type { CalendarEvent } from './constants'
import { DRAG_MIME, parseDragPayload } from './drag-utils'
import type { DragEventPayload } from './drag-utils'

interface MonthViewProps {
  selectedDate: Date
  events: CalendarEvent[]
  onSelectDate: (date: Date) => void
  onSelectEvent: (eventId: string) => void
  onEventDrop?: (payload: DragEventPayload, newStart: Date, newEnd: Date) => void
}

const MAX_VISIBLE_EVENTS = 3

export default function MonthView({ selectedDate, events, onSelectDate, onSelectEvent, onEventDrop }: MonthViewProps) {
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)

  // Build the grid of days (including padding days from prev/next months)
  const gridDays = useMemo(() => {
    const monthStart = startOfMonth(selectedDate)
    const monthEnd = endOfMonth(selectedDate)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [selectedDate])

  // Map events to day keys for fast lookup
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of events) {
      const key = event.startTime.slice(0, 10)
      const existing = map.get(key)
      if (existing) {
        existing.push(event)
      } else {
        map.set(key, [event])
      }
    }
    return map
  }, [events])

  return (
    <div className="select-none">
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day}
            className="text-center text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-7 border-t border-l border-border/30"
      >
        {gridDays.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const dayEvents = eventsByDay.get(key) ?? []
          const isCurrentMonth = isSameMonth(day, selectedDate)
          const isSelected = isSameDay(day, selectedDate)
          const isDayToday = isToday(day)
          const overflow = dayEvents.length - MAX_VISIBLE_EVENTS

          return (
            <motion.div
              key={key}
              variants={itemVariants}
              className={cn(
                'border-r border-b border-border/30 min-h-[100px] p-1.5 cursor-pointer transition-colors',
                isCurrentMonth ? 'bg-transparent hover:bg-white/[0.02]' : 'bg-muted/5',
                isSelected && 'bg-primary/5 ring-1 ring-primary/20',
                dragOverDay === key && 'ring-2 ring-primary/50',
              )}
              onClick={() => onSelectDate(day)}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setDragOverDay(key)
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverDay(null)
                }
              }}
              onDrop={(e) => {
                e.preventDefault()
                const raw = e.dataTransfer.getData(DRAG_MIME)
                const payload = parseDragPayload(raw)
                if (!payload || !onEventDrop) return

                // Keep same time, change only the date
                const originalStart = new Date(payload.startTime)
                const newStart = new Date(day)
                newStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0)
                const durationMs = new Date(payload.endTime).getTime() - originalStart.getTime()
                const newEnd = new Date(newStart.getTime() + durationMs)
                onEventDrop(payload, newStart, newEnd)
                setDragOverDay(null)
              }}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={cn(
                    'text-xs font-medium leading-none',
                    !isCurrentMonth && 'text-muted-foreground/40',
                    isCurrentMonth && !isDayToday && 'text-foreground',
                    isDayToday &&
                      'bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold',
                  )}
                >
                  {format(day, 'd')}
                </span>
                {dayEvents.length > 0 && (
                  <span className="text-[9px] text-muted-foreground/50">{dayEvents.length}</span>
                )}
              </div>

              {/* Event bars */}
              <div className="space-y-0.5">
                {dayEvents.slice(0, MAX_VISIBLE_EVENTS).map((event) => (
                  <EventBlock
                    key={event.id}
                    event={event}
                    variant="month-bar"
                    onSelect={onSelectEvent}
                  />
                ))}
                {overflow > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[9px] py-0 px-1 h-4 cursor-pointer hover:bg-muted/20"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectDate(day)
                    }}
                  >
                    +{overflow} more
                  </Badge>
                )}
              </div>
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}
