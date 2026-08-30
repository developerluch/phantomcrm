import { useMemo, useRef, useEffect, useState } from 'react'
import { startOfWeek, addDays, format, isSameDay, isToday } from 'date-fns'
import { cn } from '@/lib/utils'
import EventBlock from './EventBlock'
import {
  HOURS,
  HOUR_HEIGHT_PX,
  WORK_START_HOUR,
  DAYS_OF_WEEK,
  computeOverlapGroups,
} from './constants'
import type { CalendarEvent } from './constants'
import { DRAG_MIME, parseDragPayload, getGrabOffsetY, computeNewTimes, computeSnapIndicatorTop } from './drag-utils'
import type { DragEventPayload } from './drag-utils'

interface WeekViewProps {
  selectedDate: Date
  events: CalendarEvent[]
  onSelectDate: (date: Date) => void
  onSelectEvent: (eventId: string) => void
  onCreateAtSlot: (date: Date, hour: number) => void
  secondaryTimezone: string
  onEventDrop?: (payload: DragEventPayload, newStart: Date, newEnd: Date) => void
}

function CurrentTimeIndicator() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes()
  const topPx = (minutesSinceMidnight / 60) * HOUR_HEIGHT_PX

  return (
    <div className="absolute left-0 right-0 z-30 pointer-events-none" style={{ top: topPx }}>
      <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-red-500" />
      <div className="h-[2px] bg-red-500 w-full" />
    </div>
  )
}

function formatSecondaryTz(hour: number, timezone: string): string {
  try {
    const d = new Date()
    d.setHours(hour, 0, 0, 0)
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
      hour12: true,
    }).format(d)
  } catch {
    return ''
  }
}

export default function WeekView({
  selectedDate,
  events,
  onSelectDate,
  onSelectEvent,
  onCreateAtSlot,
  secondaryTimezone,
  onEventDrop,
}: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [dragOverDay, setDragOverDay] = useState<string | null>(null)
  const [snapIndicatorTop, setSnapIndicatorTop] = useState<number | null>(null)
  const weekStart = useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 0 }), [selectedDate])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  // Group events by day
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const day of weekDays) {
      map.set(format(day, 'yyyy-MM-dd'), [])
    }
    for (const event of events) {
      const key = event.startTime.slice(0, 10)
      const existing = map.get(key)
      if (existing) existing.push(event)
    }
    return map
  }, [events, weekDays])

  // Compute overlap groups per day
  const overlapsByDay = useMemo(() => {
    const result = new Map<string, Map<string, { index: number; total: number }>>()
    for (const [dayKey, dayEvents] of eventsByDay) {
      result.set(dayKey, computeOverlapGroups(dayEvents))
    }
    return result
  }, [eventsByDay])

  // Auto-scroll to current time or work start
  useEffect(() => {
    if (scrollRef.current) {
      const scrollTarget = WORK_START_HOUR * HOUR_HEIGHT_PX - 20
      scrollRef.current.scrollTop = scrollTarget
    }
  }, [])

  const totalHeight = 24 * HOUR_HEIGHT_PX

  return (
    <div className="flex flex-col h-full">
      {/* Day headers */}
      <div className="flex border-b border-border/30">
        {/* Time axis spacer */}
        <div className="w-16 shrink-0" />
        {weekDays.map((day) => {
          const isDayToday = isToday(day)
          const isSelected = isSameDay(day, selectedDate)
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'flex-1 text-center py-2 cursor-pointer transition-colors border-l border-border/20',
                isDayToday && 'bg-blue-600/5',
                isSelected && 'bg-primary/5',
              )}
              onClick={() => onSelectDate(day)}
            >
              <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase">
                {DAYS_OF_WEEK[day.getDay()]}
              </p>
              <p
                className={cn(
                  'text-lg font-bold mt-0.5',
                  isDayToday ? 'text-blue-400' : 'text-foreground',
                )}
              >
                {format(day, 'd')}
              </p>
            </div>
          )
        })}
        {/* Secondary TZ spacer */}
        {secondaryTimezone && <div className="w-14 shrink-0" />}
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="flex" style={{ height: totalHeight }}>
          {/* Left time axis */}
          <div className="w-16 shrink-0 relative">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute w-full pr-2 text-right text-[10px] text-muted-foreground/60"
                style={{ top: hour * HOUR_HEIGHT_PX - 6 }}
              >
                {hour === 0 ? '' : format(new Date(2000, 0, 1, hour), 'h a')}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day) => {
            const dayKey = format(day, 'yyyy-MM-dd')
            const dayEvents = eventsByDay.get(dayKey) ?? []
            const overlaps = overlapsByDay.get(dayKey) ?? new Map()
            const isDayToday = isToday(day)

            return (
              <div
                key={dayKey}
                className={cn(
                  'flex-1 relative border-l border-border/20',
                  isDayToday && 'bg-blue-600/[0.02]',
                )}
                onDragOver={(e) => {
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'move'
                  setDragOverDay(dayKey)
                  const rect = e.currentTarget.getBoundingClientRect()
                  const scrollTop = scrollRef?.current?.scrollTop ?? 0
                  const offsetY = e.clientY - rect.top + scrollTop
                  setSnapIndicatorTop(computeSnapIndicatorTop(offsetY, getGrabOffsetY()))
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverDay(null)
                    setSnapIndicatorTop(null)
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const raw = e.dataTransfer.getData(DRAG_MIME)
                  const payload = parseDragPayload(raw)
                  if (!payload || !onEventDrop) return

                  const rect = e.currentTarget.getBoundingClientRect()
                  const scrollTop = scrollRef?.current?.scrollTop ?? 0
                  const offsetY = e.clientY - rect.top + scrollTop
                  const { newStart, newEnd } = computeNewTimes(
                    day, offsetY, payload.grabOffsetY,
                    payload.startTime, payload.endTime,
                  )
                  onEventDrop(payload, newStart, newEnd)
                  setDragOverDay(null)
                  setSnapIndicatorTop(null)
                }}
              >
                {/* Hour gridlines */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute w-full border-t border-border/10 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    style={{ top: hour * HOUR_HEIGHT_PX, height: HOUR_HEIGHT_PX }}
                    onClick={() => onCreateAtSlot(day, hour)}
                  />
                ))}

                {/* Events */}
                <div className="absolute inset-0 px-0.5">
                  {dayEvents.map((event) => (
                    <EventBlock
                      key={event.id}
                      event={event}
                      variant="time-block"
                      onSelect={onSelectEvent}
                      overlap={overlaps.get(event.id)}
                    />
                  ))}
                </div>

                {/* Current time indicator */}
                {isDayToday && <CurrentTimeIndicator />}

                {/* Drag snap indicator */}
                {dragOverDay === dayKey && snapIndicatorTop !== null && (
                  <div
                    className="absolute left-0 right-0 z-40 pointer-events-none"
                    style={{ top: snapIndicatorTop }}
                  >
                    <div className="h-0.5 bg-primary w-full rounded-full" />
                  </div>
                )}
              </div>
            )
          })}

          {/* Secondary timezone axis */}
          {secondaryTimezone && (
            <div className="w-14 shrink-0 relative border-l border-border/20">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute w-full pl-1 text-left text-[9px] text-muted-foreground/40"
                  style={{ top: hour * HOUR_HEIGHT_PX - 6 }}
                >
                  {hour === 0 ? '' : formatSecondaryTz(hour, secondaryTimezone)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
