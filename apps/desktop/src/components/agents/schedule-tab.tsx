import { useState, useMemo } from 'react'
import { useScheduleEvents, useCreateScheduleEvent, useDeleteScheduleEvent } from '../../hooks/useSchedule'
import { EVENT_TYPES } from '../../types/portal'
import type { AgentScheduleEvent } from '../../types/portal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IconPlus, IconTrash, IconLoader2, IconList, IconCalendar } from '@tabler/icons-react'
import { toast } from 'sonner'

const TYPE_COLORS: Record<string, string> = {
  meeting: 'bg-blue-500/20 text-blue-400',
  training: 'bg-purple-500/20 text-purple-400',
  call: 'bg-green-500/20 text-green-400',
  other: 'bg-slate-500/20 text-muted-foreground',
}

export function ScheduleTab({ agentId }: { agentId: string }) {
  const { data: events, isLoading } = useScheduleEvents(agentId)
  const createEvent = useCreateScheduleEvent()
  const deleteEvent = useDeleteScheduleEvent()

  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [type, setType] = useState('meeting')

  function handleCreate() {
    if (!title.trim() || !startTime || !endTime) return
    createEvent.mutate(
      {
        agentId,
        data: {
          title: title.trim(),
          description: description || undefined,
          startTime: new Date(startTime).toISOString(),
          endTime: new Date(endTime).toISOString(),
          type,
        },
      },
      {
        onSuccess: () => {
          toast.success('Event created')
          setTitle('')
          setDescription('')
          setStartTime('')
          setEndTime('')
          setType('meeting')
          setShowForm(false)
        },
        onError: () => toast.error('Failed to create event'),
      }
    )
  }

  function handleDelete(eventId: string) {
    if (!confirm('Delete this event?')) return
    deleteEvent.mutate(
      { agentId, eventId },
      {
        onSuccess: () => toast.success('Event deleted'),
        onError: () => toast.error('Failed to delete event'),
      }
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <IconLoader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tabs value={view} onValueChange={(v) => setView(v as 'list' | 'calendar')}>
          <TabsList className="h-8">
            <TabsTrigger value="list" className="px-2 py-1">
              <IconList size={16} />
            </TabsTrigger>
            <TabsTrigger value="calendar" className="px-2 py-1">
              <IconCalendar size={16} />
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={() => setShowForm(!showForm)} variant="outline" size="sm" className="flex items-center gap-1">
          <IconPlus size={14} />
          Add Event
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border/50 bg-popover p-4 space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" />
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Start</label>
              <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">End</label>
              <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button onClick={handleCreate} variant="gradient" size="sm" disabled={!title.trim() || !startTime || !endTime || createEvent.isPending}>
              {createEvent.isPending ? 'Creating...' : 'Create'}
            </Button>
            <Button onClick={() => setShowForm(false)} variant="outline" size="sm">Cancel</Button>
          </div>
        </div>
      )}

      {view === 'list' ? (
        <ListView events={events ?? []} onDelete={handleDelete} />
      ) : (
        <CalendarView events={events ?? []} onDelete={handleDelete} />
      )}
    </div>
  )
}

function ListView({ events, onDelete }: { events: AgentScheduleEvent[]; onDelete: (id: string) => void }) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-popover p-12 text-center">
        <p className="text-muted-foreground">No events scheduled.</p>
      </div>
    )
  }

  const sorted = [...events].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  return (
    <div className="space-y-2">
      {sorted.map((event) => (
        <div key={event.id} className="rounded-xl border border-border/50 bg-popover p-4">
          <div className="flex items-center gap-3">
            <div className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[event.type] ?? TYPE_COLORS.other}`}>
              {event.type}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{event.title}</p>
              {event.description && (
                <p className="text-xs text-muted-foreground truncate">{event.description}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted-foreground">
                {new Date(event.startTime).toLocaleDateString()}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {' - '}
                {new Date(event.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(event.id)}
              className="h-7 w-7 text-muted-foreground hover:text-red-400"
            >
              <IconTrash size={14} />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

function CalendarView({ events, onDelete }: { events: AgentScheduleEvent[]; onDelete: (id: string) => void }) {
  const weekDays = useMemo(() => {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    monday.setHours(0, 0, 0, 0)

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
  }, [])

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  function getEventsForDay(day: Date) {
    const dayStart = new Date(day)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(day)
    dayEnd.setHours(23, 59, 59, 999)
    return events.filter((e) => {
      const start = new Date(e.startTime)
      return start >= dayStart && start <= dayEnd
    })
  }

  return (
    <div className="rounded-xl border border-border/50 bg-popover overflow-hidden">
      <div className="grid grid-cols-7">
        {weekDays.map((day, i) => (
          <div key={i} className="border-r border-border/30 last:border-r-0">
            <div className="border-b border-border/30 px-2 py-2 text-center">
              <div className="text-xs text-muted-foreground">{dayNames[i]}</div>
              <div className="text-sm text-foreground font-medium">{day.getDate()}</div>
            </div>
            <div className="min-h-[200px] p-1 space-y-1">
              {getEventsForDay(day).map((event) => (
                <div
                  key={event.id}
                  className={`rounded px-1.5 py-1 text-[10px] leading-tight cursor-pointer group ${TYPE_COLORS[event.type] ?? TYPE_COLORS.other}`}
                >
                  <div className="flex items-start justify-between gap-0.5">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{event.title}</p>
                      <p className="opacity-70">
                        {new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(event.id)}
                      className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-0 hover:bg-transparent text-current"
                    >
                      <IconTrash size={10} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
