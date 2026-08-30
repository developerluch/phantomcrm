import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { IconClock, IconLink } from '@tabler/icons-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { isDraggableSource, serializeDragPayload, setGrabOffsetY, DRAG_MIME } from './drag-utils'
import type { CalendarEvent, OverlapInfo } from './constants'
import { HOUR_HEIGHT_PX, STATUS_COLORS } from './constants'

// ── Variant Types ────────────────────────────────────

export type EventBlockVariant = 'month-dot' | 'month-bar' | 'time-block' | 'agenda-card'

interface EventBlockProps {
  event: CalendarEvent
  variant: EventBlockVariant
  onSelect?: (eventId: string) => void
  overlap?: OverlapInfo
}

// ── Month Dot ────────────────────────────────────────

function MonthDot({ event, onSelect }: { event: CalendarEvent; onSelect?: (id: string) => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="w-2 h-2 rounded-full shrink-0 cursor-pointer hover:scale-150 transition-transform p-0 min-w-0 min-h-0"
          style={{ background: event.color }}
          onClick={(e) => { e.stopPropagation(); onSelect?.(event.id) }}
        />
      </TooltipTrigger>
      <TooltipContent>{event.title}</TooltipContent>
    </Tooltip>
  )
}

// ── Month Bar ────────────────────────────────────────

function MonthBar({ event, onSelect }: { event: CalendarEvent; onSelect?: (id: string) => void }) {
  const barRef = useRef<HTMLButtonElement>(null)
  const eventRef = useRef(event)
  eventRef.current = event

  useEffect(() => {
    const el = barRef.current
    if (!el || !isDraggableSource(eventRef.current.source)) return
    const handleDragStart = (e: DragEvent) => {
      e.stopPropagation()
      const rect = el.getBoundingClientRect()
      const grabOffset = e.clientY - rect.top
      setGrabOffsetY(grabOffset)
      e.dataTransfer!.setData(DRAG_MIME, serializeDragPayload({
        eventId: eventRef.current.id,
        source: eventRef.current.source,
        startTime: eventRef.current.startTime,
        endTime: eventRef.current.endTime,
        googleEventId: eventRef.current.googleEventId,
        accountId: eventRef.current.accountId,
        grabOffsetY: grabOffset,
      }))
      e.dataTransfer!.effectAllowed = 'move'
    }
    el.addEventListener('dragstart', handleDragStart)
    return () => el.removeEventListener('dragstart', handleDragStart)
  }, [])

  return (
    <motion.button
      ref={barRef}
      type="button"
      whileHover={{ scale: 1.02 }}
      className="w-full text-left rounded px-2 py-1 text-[11px] font-medium truncate cursor-pointer"
      style={{ background: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))', borderLeft: `3px solid ${event.color}` }}
      onClick={(e) => { e.stopPropagation(); onSelect?.(event.id) }}
    >
      <span className="flex items-center gap-1">
        {format(new Date(event.startTime), 'h:mm')} {event.title}
        {event.source === 'google' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: event.color }} />
            </TooltipTrigger>
            <TooltipContent>Google Calendar</TooltipContent>
          </Tooltip>
        )}
      </span>
    </motion.button>
  )
}

// ── Time Block (Week / Day views) ────────────────────

function TimeBlock({
  event,
  onSelect,
  overlap,
}: {
  event: CalendarEvent
  onSelect?: (id: string) => void
  overlap?: OverlapInfo
}) {
  const [isDragging, setIsDragging] = useState(false)
  const blockRef = useRef<HTMLDivElement>(null)
  const eventRef = useRef(event)
  eventRef.current = event

  useEffect(() => {
    const el = blockRef.current
    if (!el || !isDraggableSource(eventRef.current.source)) return
    const handleDragStart = (e: DragEvent) => {
      const rect = el.getBoundingClientRect()
      const grabOffset = e.clientY - rect.top
      setGrabOffsetY(grabOffset)
      e.dataTransfer!.setData(DRAG_MIME, serializeDragPayload({
        eventId: eventRef.current.id,
        source: eventRef.current.source,
        startTime: eventRef.current.startTime,
        endTime: eventRef.current.endTime,
        googleEventId: eventRef.current.googleEventId,
        accountId: eventRef.current.accountId,
        grabOffsetY: grabOffset,
      }))
      e.dataTransfer!.effectAllowed = 'move'
      setIsDragging(true)
    }
    const handleDragEnd = () => setIsDragging(false)
    el.addEventListener('dragstart', handleDragStart)
    el.addEventListener('dragend', handleDragEnd)
    return () => {
      el.removeEventListener('dragstart', handleDragStart)
      el.removeEventListener('dragend', handleDragEnd)
    }
  }, [])

  const start = new Date(event.startTime)
  const end = new Date(event.endTime)
  const startMinutes = start.getHours() * 60 + start.getMinutes()
  const endMinutes = end.getHours() * 60 + end.getMinutes()
  const durationMinutes = Math.max(endMinutes - startMinutes, 15)

  const top = (startMinutes / 60) * HOUR_HEIGHT_PX
  const height = (durationMinutes / 60) * HOUR_HEIGHT_PX

  const overlapIndex = overlap?.index ?? 0
  const overlapTotal = overlap?.total ?? 1
  const widthPercent = 100 / overlapTotal
  const leftPercent = overlapIndex * widthPercent

  const block = (
    <motion.div
      ref={blockRef}
      whileHover={{ scale: 1.01, zIndex: 20 }}
      draggable={isDraggableSource(event.source)}
      className={cn(
        'absolute rounded-md border border-white/10 cursor-pointer overflow-hidden backdrop-blur-sm',
        isDragging && 'opacity-50 scale-95 ring-2 ring-primary/50',
      )}
      style={{
        top,
        height: Math.max(height, 20),
        width: `${widthPercent}%`,
        background: 'hsl(var(--card))',
        borderLeft: `4px solid ${event.color}`,
        zIndex: isDragging ? 50 : 10 + overlapIndex,
      }}
      onClick={(e) => { e.stopPropagation(); if (!isDragging) onSelect?.(event.id) }}
    >
      <div className={`h-full flex flex-col relative ${overlapTotal > 1 ? 'px-1 py-0.5' : 'px-2 py-1.5'}`}>
        {event.source === 'google' && (
          <span className="absolute top-1 right-1.5 text-[8px] font-bold" style={{ color: event.color }}>G</span>
        )}
        <p className={`font-semibold text-foreground truncate leading-snug ${height < 25 || overlapTotal > 1 ? 'text-[9px]' : 'text-[11px]'}`}>
          {event.title}
        </p>
        {height > 35 && (
          <p className="text-[9px] text-muted-foreground mt-1 leading-tight">
            {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
          </p>
        )}
        {height > 60 && overlapTotal <= 1 && event.attendee && (
          <p className="text-[9px] text-muted-foreground/50 truncate mt-0.5">{event.attendee}</p>
        )}
      </div>
    </motion.div>
  )

  if (event.source === 'calcom') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{block}</TooltipTrigger>
        <TooltipContent>Edit in Cal.com</TooltipContent>
      </Tooltip>
    )
  }

  return block
}

// ── Agenda Card (Right Panel) ────────────────────────

function AgendaCard({ event, onSelect }: { event: CalendarEvent; onSelect?: (id: string) => void }) {
  const start = new Date(event.startTime)
  const end = new Date(event.endTime)
  const duration = Math.round((end.getTime() - start.getTime()) / 60000)
  const statusColor = STATUS_COLORS[event.status] ?? '#6b7280'

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      className="rounded-xl border border-border/40 bg-card p-3 hover:bg-muted transition-colors cursor-pointer"
      onClick={() => onSelect?.(event.id)}
    >
      <div className="flex items-start gap-2.5">
        {/* Status dot */}
        <div
          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
          style={{ background: statusColor }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs font-semibold text-foreground truncate pr-2">{event.title}</p>
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium truncate shrink-0">
              {event.status.replace('_', ' ')}
            </span>
            <div className="flex items-center gap-1.5 ml-auto pl-2 shrink-0 border-l border-border/30">
              {event.source === 'calcom' && (
                <span className="text-[10px] text-purple-400 font-medium">Cal.com</span>
              )}
              {event.source === 'google' && (
                <span className="text-[10px] font-medium" style={{ color: event.color }}>
                  {event.accountEmail || 'Google'}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-0.5">
              <IconClock size={10} />
              {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
            </span>
            <Badge variant="outline" className="text-[9px]">{duration}m</Badge>
            {event.attendee && <span className="truncate">{event.attendee}</span>}
          </div>
        </div>
        {event.meetingLink && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-blue-400 hover:text-blue-300"
            onClick={(e) => { e.stopPropagation(); window.open(event.meetingLink!, '_blank') }}
          >
            <IconLink size={12} />
          </Button>
        )}
      </div>
    </motion.div>
  )
}

// ── Main Export ───────────────────────────────────────

export default function EventBlock({ event, variant, onSelect, overlap }: EventBlockProps) {
  switch (variant) {
    case 'month-dot':
      return <MonthDot event={event} onSelect={onSelect} />
    case 'month-bar':
      return <MonthBar event={event} onSelect={onSelect} />
    case 'time-block':
      return <TimeBlock event={event} onSelect={onSelect} overlap={overlap} />
    case 'agenda-card':
      return <AgendaCard event={event} onSelect={onSelect} />
  }
}
