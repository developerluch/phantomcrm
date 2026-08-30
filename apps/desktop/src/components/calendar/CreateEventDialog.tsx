import { useState, useMemo, useEffect } from 'react'
import { addMinutes } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { Switch } from '@/components/ui/switch'
import { IconCalendarEvent, IconLoader2 } from '@tabler/icons-react'
import { toast } from 'sonner'
import { useAgents } from '@/hooks/useAgents'
import { useCreateAppointment } from '@/hooks/useAppointments'
import { useGoogleCalendarStatus, useCreateGoogleEvent } from '@/hooks/useGoogleCalendar'
import ConflictWarning from './ConflictWarning'
import {
  EVENT_CATEGORIES,
  QUICK_DURATIONS,
  REMINDER_OPTIONS,
  doTimesOverlap,
} from './constants'
import type { CalendarEvent, EventCategory, RecurrenceType, CreateDialogDefaults } from './constants'

interface CreateEventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaults: CreateDialogDefaults | null
  existingEvents: CalendarEvent[]
}

export default function CreateEventDialog({
  open,
  onOpenChange,
  defaults,
  existingEvents,
}: CreateEventDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<EventCategory>('other')
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [agentId, setAgentId] = useState('')
  const [meetingLink, setMeetingLink] = useState('')
  const [reminder, setReminder] = useState<string>('')
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none')
  const [syncToGoogle, setSyncToGoogle] = useState(false)
  const [addGoogleMeet, setAddGoogleMeet] = useState(false)

  const { data: agentsData } = useAgents()
  const agents = agentsData?.agents ?? []
  const createAppointment = useCreateAppointment()
  const { data: googleStatus } = useGoogleCalendarStatus()
  const googleConnected = googleStatus?.connected ?? false
  const createGoogleEvent = useCreateGoogleEvent()

  // Pre-fill from defaults when dialog opens
  useEffect(() => {
    if (open && defaults?.date) {
      const start = new Date(defaults.date)
      if (defaults.startHour !== undefined) {
        start.setHours(defaults.startHour, 0, 0, 0)
      }
      setStartDate(start)
      setEndDate(addMinutes(start, 30))
    }
  }, [open, defaults])

  // Reset form when closing
  useEffect(() => {
    if (!open) {
      setTitle('')
      setDescription('')
      setCategory('other')
      setStartDate(undefined)
      setEndDate(undefined)
      setAgentId('')
      setMeetingLink('')
      setReminder('')
      setRecurrence('none')
      setSyncToGoogle(false)
      setAddGoogleMeet(false)
    }
  }, [open])

  // Default sync toggle ON when Google is connected and dialog opens
  useEffect(() => {
    if (open && googleConnected) {
      setSyncToGoogle(true)
    }
  }, [open, googleConnected])

  // Quick duration handler
  function applyDuration(minutes: number) {
    if (!startDate) return
    setEndDate(addMinutes(startDate, minutes))
  }

  // Conflict detection
  const conflicts = useMemo(() => {
    if (!startDate || !endDate) return []
    const proposedStart = startDate.toISOString()
    const proposedEnd = endDate.toISOString()
    return existingEvents.filter((event) =>
      doTimesOverlap(proposedStart, proposedEnd, event.startTime, event.endTime),
    )
  }, [startDate, endDate, existingEvents])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return toast.error('Title is required')
    if (!agentId) return toast.error('Select an agent')
    if (!startDate || !endDate) return toast.error('Start and end dates are required')
    if (endDate <= startDate) return toast.error('End must be after start')

    createAppointment.mutate(
      {
        title: title.trim(),
        description: description.trim() || undefined,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        agentId,
        meetingLink: meetingLink.trim() || undefined,
      },
      {
        onSuccess: async () => {
          if (syncToGoogle && googleConnected) {
            try {
              await createGoogleEvent.mutateAsync({
                summary: title.trim(),
                description: description.trim() || undefined,
                startTime: startDate!.toISOString(),
                endTime: endDate!.toISOString(),
                addGoogleMeet: addGoogleMeet,
              })
              toast.success('Event created & synced to Google Calendar')
            } catch {
              toast.success('Event created locally')
              toast.error('Failed to sync to Google Calendar')
            }
          } else {
            toast.success('Event created')
          }
          onOpenChange(false)
        },
        onError: () => toast.error('Failed to create event'),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-visible">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <IconCalendarEvent size={20} className="text-blue-400" />
            </div>
            <DialogTitle>New Event</DialogTitle>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto max-h-[65vh] pr-1">
          {/* Title */}
          <div>
            <Label className="mb-1.5 block">Title *</Label>
            <Input
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              placeholder="Meeting title"
            />
          </div>

          {/* Category */}
          <div>
            <Label className="mb-1.5 block">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as EventCategory)}>
              <SelectTrigger>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {EVENT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
                      {cat.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Agent */}
          <div>
            <Label className="mb-1.5 block">Agent *</Label>
            <Select value={agentId || undefined} onValueChange={setAgentId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an agent..." />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.discord_id} value={String(agent.discord_id)}>
                    {agent.full_name || `Agent ${agent.discord_id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Start / End */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Start *</Label>
              <DateTimePicker value={startDate} onChange={setStartDate} placeholder="Pick start" />
            </div>
            <div>
              <Label className="mb-1.5 block">End *</Label>
              <DateTimePicker value={endDate} onChange={setEndDate} placeholder="Pick end" />
            </div>
          </div>

          {/* Quick Duration Buttons */}
          <div>
            <Label className="mb-1.5 block">Quick Duration</Label>
            <div className="flex gap-2">
              {QUICK_DURATIONS.map((dur) => (
                <Button
                  key={dur}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs flex-1"
                  onClick={() => applyDuration(dur)}
                  disabled={!startDate}
                >
                  {dur}m
                </Button>
              ))}
            </div>
          </div>

          {/* Conflict Warning */}
          <ConflictWarning conflicts={conflicts} />

          {/* Reminder */}
          <div>
            <Label className="mb-1.5 block">Reminder</Label>
            <Select value={reminder} onValueChange={setReminder}>
              <SelectTrigger>
                <SelectValue placeholder="No reminder" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No reminder</SelectItem>
                {REMINDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recurrence */}
          <div>
            <Label className="mb-1.5 block">Recurrence</Label>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as RecurrenceType)}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Google Calendar Sync */}
          {googleConnected && (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-border/30 bg-card/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-red-400">G</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Sync to Google Calendar</span>
                </div>
                <Switch checked={syncToGoogle} onCheckedChange={setSyncToGoogle} />
              </div>
              {syncToGoogle && (
                <div className="flex items-center justify-between rounded-lg border border-border/30 bg-card/30 px-3 py-2">
                  <span className="text-xs text-muted-foreground">Add Google Meet link</span>
                  <Switch checked={addGoogleMeet} onCheckedChange={setAddGoogleMeet} />
                </div>
              )}
            </div>
          )}

          {/* Meeting Link */}
          <div>
            <Label className="mb-1.5 block">Meeting Link</Label>
            <Input
              value={meetingLink}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMeetingLink(e.target.value)}
              placeholder="https://meet.google.com/..."
            />
          </div>

          {/* Description */}
          <div>
            <Label className="mb-1.5 block">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes..."
              className="h-16"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createAppointment.isPending || createGoogleEvent.isPending || !title.trim() || !startDate || !endDate || !agentId}
            >
              {createAppointment.isPending ? (
                <span className="flex items-center gap-2">
                  <IconLoader2 size={14} className="animate-spin" />
                  Creating...
                </span>
              ) : (
                'Create Event'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
