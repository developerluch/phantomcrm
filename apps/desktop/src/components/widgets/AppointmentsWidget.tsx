import { formatDistanceToNow } from 'date-fns'
import { IconCalendar } from '@tabler/icons-react'
import { useUpcomingAppointments } from '../../hooks/useAppointments'
import { useDateStore } from '../../store/date-store'

interface Appointment {
  id: string
  title?: string
  scheduledAt?: string
  agentName?: string
}

export default function AppointmentsWidget() {
  const { current } = useDateStore()
  const { data, isLoading } = useUpcomingAppointments(current.from, current.to)

  const appointments: Appointment[] = Array.isArray(data)
    ? data.slice(0, 5)
    : ((data as unknown as { appointments?: Appointment[] })?.appointments ?? []).slice(0, 5)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 rounded-lg bg-muted/50 animate-pulse" />)}
      </div>
    )
  }

  if (appointments.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2">
        <IconCalendar size={24} className="text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No upcoming appointments</p>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {appointments.map((apt, i) => (
        <div key={apt.id || i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30 border border-border/30">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <IconCalendar size={16} className="text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{apt.title || 'Appointment'}</p>
            <p className="text-xs text-muted-foreground">
              {apt.scheduledAt ? formatDistanceToNow(new Date(apt.scheduledAt), { addSuffix: true }) : 'No date'}
              {apt.agentName ? ` · ${apt.agentName}` : ''}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
