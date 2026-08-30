import { useMemo, useRef, useEffect, useState } from 'react'
import { format, isToday } from 'date-fns'
import { cn } from '@/lib/utils'
import EventBlock from './EventBlock'
import { HOURS, HOUR_HEIGHT_PX, WORK_START_HOUR, computeOverlapGroups } from './constants'
import type { CalendarEvent } from './constants'
import { DRAG_MIME, parseDragPayload, getGrabOffsetY, computeNewTimes, computeSnapIndicatorTop } from './drag-utils'
import type { DragEventPayload } from './drag-utils'

interface DayViewProps {
  selectedDate: Date
  events: CalendarEvent[]
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

export default function DayView({
  selectedDate,
  events,
  onSelectEvent,
  onCreateAtSlot,
  secondaryTimezone,
  onEventDrop,
}: DayViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [dragOverActive, setDragOverActive] = useState(false)
  const [snapIndicatorTop, setSnapIndicatorTop] = useState<number | null>(null)
  const isDayToday = isToday(selectedDate)

  // Filter events for this specific day
  const dayEvents = useMemo(() => {
    const dayKey = format(selectedDate, 'yyyy-MM-dd')
    return events.filter((e) => e.startTime.slice(0, 10) === dayKey)
  }, [events, selectedDate])

  // Compute overlap groups
  const overlaps = useMemo(() => computeOverlapGroups(dayEvents), [dayEvents])

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
      {/* Day header */}
      <div className="flex border-b border-border/30">
        <div className="w-16 shrink-0" />
        <div className={cn('flex-1 py-3 px-4', isDayToday && 'bg-blue-600/5')}>
          <p className="text-sm font-semibold text-foreground">
            {format(selectedDate, 'EEEE')}
            {isDayToday && (
              <span className="ml-2 text-xs font-normal text-blue-400">Today</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(selectedDate, 'MMMM d, yyyy')}
          </p>
        </div>
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

          {/* Main column */}
          <div
            className={cn('flex-1 relative border-l border-border/20', isDayToday && 'bg-blue-600/[0.02]')}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setDragOverActive(true)
              const rect = e.currentTarget.getBoundingClientRect()
              const scrollTop = scrollRef?.current?.scrollTop ?? 0
              const offsetY = e.clientY - rect.top + scrollTop
              setSnapIndicatorTop(computeSnapIndicatorTop(offsetY, getGrabOffsetY()))
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragOverActive(false)
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
                selectedDate, offsetY, payload.grabOffsetY,
                payload.startTime, payload.endTime,
              )
              onEventDrop(payload, newStart, newEnd)
              setDragOverActive(false)
              setSnapIndicatorTop(null)
            }}
          >
            {/* Hour gridlines */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute w-full border-t border-border/10 cursor-pointer hover:bg-white/[0.02] transition-colors"
                style={{ top: hour * HOUR_HEIGHT_PX, height: HOUR_HEIGHT_PX }}
                onClick={() => onCreateAtSlot(selectedDate, hour)}
              />
            ))}

            {/* Events */}
            <div className="absolute inset-0 px-1">
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
            {dragOverActive && snapIndicatorTop !== null && (
              <div
                className="absolute left-0 right-0 z-40 pointer-events-none"
                style={{ top: snapIndicatorTop }}
              >
                <div className="h-0.5 bg-primary w-full rounded-full" />
              </div>
            )}
          </div>

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
