import { useState } from 'react'
import { useAppointments, useUpcomingAppointments, useCreateAppointment, useUpdateAppointmentStatus, useDeleteAppointment } from '../hooks/useAppointments'
import { useAgents } from '../hooks/useAgents'
import { toast } from 'sonner'
import {
  IconCalendarEvent,
  IconPlus,
  IconTrash,
  IconLoader2,
  IconClock,
  IconLink,
  IconChevronLeft,
  IconChevronRight,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { Label } from '@/components/ui/label'
import EmptyState from '../components/EmptyState'

const STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show'] as const
const STATUS_COLORS: Record<string, string> = {
  scheduled: '#3b82f6',
  completed: '#22c55e',
  cancelled: '#ef4444',
  no_show: '#f59e0b',
}

export default function AppointmentsPage() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  // Create form
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState<Date | undefined>()
  const [endDate, setEndDate] = useState<Date | undefined>()
  const [agentId, setAgentId] = useState('')
  const [meetingLink, setMeetingLink] = useState('')

  const { data: upcoming = [] } = useUpcomingAppointments()
  const { data, isLoading, isError } = useAppointments({ page, perPage: 20, status: statusFilter || undefined })
  const createAppointment = useCreateAppointment()
  const updateStatus = useUpdateAppointmentStatus()
  const deleteAppointment = useDeleteAppointment()
  const { data: agentsData } = useAgents()
  const agents = agentsData?.agents ?? []

  const appointments = data?.appointments ?? []
  const pageCount = data?.pageCount ?? 1

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return toast.error('Title is required')
    if (!agentId) return toast.error('Select an agent')
    if (!startDate || !endDate) return toast.error('Start and end dates are required')
    if (endDate <= startDate) return toast.error('End date must be after start date')
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
        onSuccess: () => {
          toast.success('Appointment created')
          setShowCreate(false)
          setTitle('')
          setDescription('')
          setStartDate(undefined)
          setEndDate(undefined)
          setAgentId('')
          setMeetingLink('')
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to create'),
      }
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-44 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted/30 rounded-xl animate-pulse" />
        <div className="h-96 bg-muted/30 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Failed to load appointments.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Appointments</h1>
          <p className="text-sm text-muted-foreground mt-1">Schedule and manage meetings with agents</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <IconPlus size={16} className="mr-1.5" />
          New Appointment
        </Button>
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Upcoming (Next 7 Days)</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {upcoming.map((apt) => (
              <div
                key={apt.id}
                className="min-w-[220px] rounded-xl border border-border p-3"
                style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}
              >
                <p className="text-sm font-medium text-foreground truncate">{apt.title}</p>
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                  <IconClock size={12} />
                  {new Date(apt.startTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                {apt.agent && (
                  <p className="text-xs text-muted-foreground mt-1">{apt.agent.firstName} {apt.agent.lastName}</p>
                )}
                {apt.meetingLink && (
                  <a href={apt.meetingLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-400 mt-1.5 hover:underline">
                    <IconLink size={12} /> Join Meeting
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter || "_all"} onValueChange={(v) => { setStatusFilter(v === "_all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Appointments List */}
      <div className="space-y-2">
        {appointments.map((apt) => {
          const color = STATUS_COLORS[apt.status] ?? '#6b7280'
          return (
            <div key={apt.id} className="rounded-xl border border-border p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{apt.title}</p>
                  <Badge className="text-[10px] shrink-0" style={{ background: `${color}20`, color, borderColor: `${color}40` }}>
                    {apt.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{new Date(apt.startTime).toLocaleString()} — {new Date(apt.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {apt.agent && <span>{apt.agent.firstName} {apt.agent.lastName}</span>}
                </div>
              </div>
              <Select value={apt.status} onValueChange={(v) => updateStatus.mutate({ id: apt.id, status: v }, {
                  onSuccess: () => toast.success('Status updated'),
                  onError: () => toast.error('Failed to update'),
                })}>
                <SelectTrigger className="text-[11px] h-7 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteAppointment.mutate(apt.id, {
                  onSuccess: () => toast.success('Deleted'),
                  onError: () => toast.error('Failed to delete'),
                })}
                className="h-7 w-7 text-muted-foreground hover:text-red-400 shrink-0"
              >
                <IconTrash size={14} />
              </Button>
            </div>
          )
        })}
        {appointments.length === 0 && (
          <EmptyState
            icon={IconCalendarEvent}
            title="No appointments found"
            description="Create your first appointment to get started."
          />
        )}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <IconChevronLeft size={14} />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
            <IconChevronRight size={14} />
          </Button>
        </div>
      )}

      {/* Create Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <IconCalendarEvent size={20} className="text-blue-400" />
              </div>
              <div>
                <DialogTitle>New Appointment</DialogTitle>
                <DialogDescription>Schedule a meeting</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Title *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meeting title" />
            </div>
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
            <div>
              <Label className="mb-1.5 block">Meeting Link</Label>
              <Input value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)} placeholder="https://meet.google.com/..." />
            </div>
            <div>
              <Label className="mb-1.5 block">Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional notes..." className="h-16" />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={createAppointment.isPending || !title.trim() || !startDate || !endDate || !agentId}>
                {createAppointment.isPending ? <span className="flex items-center gap-2"><IconLoader2 size={14} className="animate-spin" />Creating...</span> : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
