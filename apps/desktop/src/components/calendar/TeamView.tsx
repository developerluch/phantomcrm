import { useState, useMemo, useRef, useEffect } from 'react'
import { format, isToday } from 'date-fns'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Command, CommandInput, CommandList, CommandItem } from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { IconUsers, IconCheck, IconCalendarOff } from '@tabler/icons-react'
import { useAgents } from '@/hooks/useAgents'
import { useScheduleEvents } from '@/hooks/useSchedule'
import EventBlock from './EventBlock'
import {
  HOURS,
  HOUR_HEIGHT_PX,
  WORK_START_HOUR,
  computeOverlapGroups,
  scheduleEventToCalendarEvent,
} from './constants'
import type { CalendarEvent } from './constants'

interface TeamViewProps {
  selectedDate: Date
  events: CalendarEvent[]
  selectedAgentIds: string[]
  onAgentSelect: (ids: string[]) => void
  onSelectEvent: (eventId: string) => void
}

// Current time indicator for the time grid
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
      <div className="h-[2px] bg-red-500 w-full" />
    </div>
  )
}

// Per-agent column that fetches schedule events
function AgentColumn({
  agentId,
  agentName,
  selectedDate,
  globalEvents,
  onSelectEvent,
}: {
  agentId: string
  agentName: string
  selectedDate: Date
  globalEvents: CalendarEvent[]
  onSelectEvent: (id: string) => void
}) {
  const dayKey = format(selectedDate, 'yyyy-MM-dd')
  const isDayToday = isToday(selectedDate)

  // Fetch schedule events for this agent
  const { data: scheduleData } = useScheduleEvents(agentId, {
    start: `${dayKey}T00:00:00Z`,
    end: `${dayKey}T23:59:59Z`,
  })

  // Merge global events (filtered for this agent) + schedule events
  const columnEvents = useMemo(() => {
    const events: CalendarEvent[] = []

    // Agent's events from global merged events
    const agentGlobalEvents = globalEvents.filter(
      (e) => e.startTime.slice(0, 10) === dayKey && e.agentId === agentId,
    )
    events.push(...agentGlobalEvents)

    // Schedule events for this agent
    if (scheduleData && scheduleData.length > 0) {
      const scheduleCalEvents = scheduleData.map(e => scheduleEventToCalendarEvent(e))
      // Avoid duplicates by id
      const existingIds = new Set(events.map((e) => e.id))
      for (const se of scheduleCalEvents) {
        if (!existingIds.has(se.id)) events.push(se)
      }
    }

    return events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }, [globalEvents, scheduleData, dayKey, agentId])

  const overlaps = useMemo(() => computeOverlapGroups(columnEvents), [columnEvents])

  return (
    <div className="flex-1 min-w-[160px]">
      {/* Agent header */}
      <div className="border-b border-border/30 py-2 px-2 text-center">
        <p className="text-xs font-semibold text-foreground truncate">{agentName}</p>
        <p className="text-[9px] text-muted-foreground">{columnEvents.length} events</p>
      </div>

      {/* Time grid */}
      <div className={cn('relative border-l border-border/20', isDayToday && 'bg-blue-600/[0.02]')}>
        {HOURS.map((hour) => (
          <div
            key={hour}
            className="border-t border-border/10"
            style={{ height: HOUR_HEIGHT_PX }}
          />
        ))}

        {/* Events */}
        <div className="absolute inset-0 px-0.5" style={{ top: 0 }}>
          {columnEvents.map((event) => (
            <EventBlock
              key={event.id}
              event={event}
              variant="time-block"
              onSelect={onSelectEvent}
              overlap={overlaps.get(event.id)}
            />
          ))}
        </div>

        {/* Current time */}
        {isDayToday && <CurrentTimeIndicator />}
      </div>
    </div>
  )
}

// Find Free Time overlay
function FreeTimeOverlay({
  selectedDate,
  agentColumns,
}: {
  selectedDate: Date
  agentColumns: { agentId: string; events: CalendarEvent[] }[]
}) {
  // Check each 30-min slot
  const freeSlots = useMemo(() => {
    if (agentColumns.length === 0) return []

    const slots: number[] = []
    const dayKey = format(selectedDate, 'yyyy-MM-dd')

    for (let minute = 0; minute < 24 * 60; minute += 30) {
      const slotStart = new Date(`${dayKey}T00:00:00`)
      slotStart.setMinutes(minute)
      const slotEnd = new Date(slotStart)
      slotEnd.setMinutes(slotEnd.getMinutes() + 30)

      const allFree = agentColumns.every((col) =>
        col.events.every((e) => {
          const eStart = new Date(e.startTime).getTime()
          const eEnd = new Date(e.endTime).getTime()
          return slotStart.getTime() >= eEnd || slotEnd.getTime() <= eStart
        }),
      )

      if (allFree) slots.push(minute)
    }

    return slots
  }, [selectedDate, agentColumns])

  return (
    <>
      {freeSlots.map((minute) => (
        <div
          key={minute}
          className="absolute left-0 right-0 bg-emerald-500/[0.06] border-y border-emerald-500/10 pointer-events-none"
          style={{
            top: (minute / 60) * HOUR_HEIGHT_PX,
            height: (30 / 60) * HOUR_HEIGHT_PX,
          }}
        />
      ))}
    </>
  )
}

export default function TeamView({
  selectedDate,
  events,
  selectedAgentIds,
  onAgentSelect,
  onSelectEvent,
}: TeamViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { data: agentsData } = useAgents()
  const agents = agentsData?.agents ?? []

  // Auto-scroll to work start
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = WORK_START_HOUR * HOUR_HEIGHT_PX - 20
    }
  }, [])

  function toggleAgent(id: string) {
    if (selectedAgentIds.includes(id)) {
      onAgentSelect(selectedAgentIds.filter((a) => a !== id))
    } else {
      onAgentSelect([...selectedAgentIds, id])
    }
  }

  const totalHeight = 24 * HOUR_HEIGHT_PX

  return (
    <div className="flex flex-col h-full">
      {/* Agent Selector */}
      <div className="flex items-center gap-2 p-3 border-b border-border/30">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              <IconUsers size={14} />
              {selectedAgentIds.length === 0
                ? 'Select Agents'
                : `${selectedAgentIds.length} agent${selectedAgentIds.length !== 1 ? 's' : ''}`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-64" align="start">
            <Command>
              <CommandInput placeholder="Search agents..." />
              <CommandList>
                {agents.map((agent) => {
                  const id = String(agent.discord_id)
                  const selected = selectedAgentIds.includes(id)
                  return (
                    <CommandItem
                      key={id}
                      onSelect={() => toggleAgent(id)}
                      className="flex items-center gap-2"
                    >
                      <div
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center',
                          selected ? 'bg-primary border-primary' : 'border-border',
                        )}
                      >
                        {selected && <IconCheck size={10} className="text-primary-foreground" />}
                      </div>
                      <span className="text-xs truncate">
                        {agent.full_name || `Agent ${agent.discord_id}`}
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selectedAgentIds.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            {selectedAgentIds.slice(0, 5).map((id) => {
              const agent = agents.find((a) => String(a.discord_id) === id)
              return (
                <Badge key={id} variant="outline" className="text-[9px]">
                  {agent?.full_name || `#${id}`}
                </Badge>
              )
            })}
            {selectedAgentIds.length > 5 && (
              <Badge variant="outline" className="text-[9px]">
                +{selectedAgentIds.length - 5}
              </Badge>
            )}
          </div>
        )}

        {selectedAgentIds.length >= 2 && (
          <Badge className="text-[9px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30 ml-auto">
            Free time highlighted
          </Badge>
        )}
      </div>

      {/* Team Grid */}
      {selectedAgentIds.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <IconCalendarOff size={32} className="text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Select agents to compare schedules</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Use the selector above to pick team members
            </p>
          </div>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-auto">
          <div className="flex" style={{ height: totalHeight }}>
            {/* Time axis */}
            <div className="w-14 shrink-0 relative">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="absolute w-full pr-1 text-right text-[9px] text-muted-foreground/60"
                  style={{ top: hour * HOUR_HEIGHT_PX - 6 }}
                >
                  {hour === 0 ? '' : format(new Date(2000, 0, 1, hour), 'h a')}
                </div>
              ))}
            </div>

            {/* Agent columns */}
            <div className="flex flex-1 relative">
              {selectedAgentIds.map((agentId) => {
                const agent = agents.find((a) => String(a.discord_id) === agentId)
                return (
                  <AgentColumn
                    key={agentId}
                    agentId={agentId}
                    agentName={agent?.full_name || `Agent ${agentId}`}
                    selectedDate={selectedDate}
                    globalEvents={events}
                    onSelectEvent={onSelectEvent}
                  />
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
