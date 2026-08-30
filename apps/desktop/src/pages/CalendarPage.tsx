import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { api } from '../services/api'
import { useCalcomStatus, useCalcomEventTypes, useCalcomBookings } from '../hooks/useCalcom'
import { useUpcomingAppointments, useUpdateAppointmentStatus } from '../hooks/useAppointments'
import { useGoogleCalendarStatus, useGoogleCalendarEvents, useGoogleCalendarAccounts } from '../hooks/useGoogleCalendar'
import { useCalendarDragDrop } from '@/hooks/useCalendarDragDrop'
import { useAgents } from '../hooks/useAgents'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { containerVariants, itemVariants } from '@/lib/motion'
import { IconPlus, IconCalendarEvent, IconRefresh } from '@tabler/icons-react'
import { toast } from 'sonner'

import CalendarGrid from '@/components/calendar/CalendarGrid'
import AgendaPanel from '@/components/calendar/AgendaPanel'
import CreateEventDialog from '@/components/calendar/CreateEventDialog'
import EventDetailPopover from '@/components/calendar/EventDetailPopover'
import TeamView from '@/components/calendar/TeamView'
import QuickStatsStrip from '@/components/calendar/QuickStatsStrip'
import EventTypesPopover from '@/components/calendar/EventTypesPopover'
import type {
  CalendarViewType,
  CalendarEvent,
  RightPanelMode,
  CreateDialogDefaults,
} from '@/components/calendar/constants'
import {
  computeVisibleRange,
  calcomBookingToEvent,
  appointmentToEvent,
  googleEventToCalendarEvent,
  EVENT_CATEGORY_LABELS,
} from '@/components/calendar/constants'
import type { EventCategory } from '@/components/calendar/constants'
import { useCalendarSettingsStore } from '@/store/calendar-settings-store'
import { Badge } from '@/components/ui/badge'

// ── Main Component ───────────────────────────────────

export default function CalendarPage() {
  // View state
  const [currentView, setCurrentView] = useState<CalendarViewType>('week')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createDialogDefaults, setCreateDialogDefaults] = useState<CreateDialogDefaults | null>(null)
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([])
  const [secondaryTimezone] = useState(() => localStorage.getItem('calendar-secondary-tz') ?? '')
  const { eventColors, hiddenCategories, toggleCategory } = useCalendarSettingsStore()

  // ── Drag-Drop ──
  const { handleDrop, pendingConfirmation, confirmDrop, cancelDrop, isUpdating } = useCalendarDragDrop()

  // ── Data Fetching (reuse existing hooks) ──

  const { data: calcomStatus } = useCalcomStatus()
  const isCalcomConnected = calcomStatus?.connected ?? false

  const visibleRange = useMemo(
    () => computeVisibleRange(currentView, selectedDate),
    [currentView, selectedDate],
  )

  const { data: calBookingsData } = useCalcomBookings(
    { afterStart: visibleRange.start.toISOString(), beforeEnd: visibleRange.end.toISOString() },
    isCalcomConnected,
  )
  const { data: eventTypesData } = useCalcomEventTypes(isCalcomConnected)
  const { data: legacyAppointments = [] } = useUpcomingAppointments()

  // Google Calendar integration
  const { data: googleStatus, isFetching: isGoogleSyncing } = useGoogleCalendarStatus()
  const googleConnected = googleStatus?.connected ?? false

  const showGoogleEvents = useMemo(() => {
    try {
      const prefs = JSON.parse(localStorage.getItem('phantom-gcal-preferences') ?? '{}')
      return prefs.showGoogleEvents ?? true
    } catch { return true }
  }, [])

  const { data: googleEvents = [] } = useGoogleCalendarEvents(
    { timeMin: visibleRange.start.toISOString(), timeMax: visibleRange.end.toISOString() },
    googleConnected && showGoogleEvents,
  )

  const { data: googleAccounts = [] } = useGoogleCalendarAccounts()

  // Microsoft status (for connected calendars indicator)
  const { data: microsoftStatus } = useQuery({
    queryKey: ['integration-microsoft-status'],
    queryFn: () => api.getMicrosoftStatus(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const { data: agentsData } = useAgents()

  // ── Merge & Filter Events ──

  const mergedEvents = useMemo(() => {
    const events: CalendarEvent[] = []

    // Cal.com bookings
    if (calBookingsData?.data) {
      events.push(...calBookingsData.data.map((b) => calcomBookingToEvent(b, eventColors)))
    }

    // Legacy manual appointments
    for (const a of legacyAppointments) {
      events.push(appointmentToEvent(a, eventColors))
    }

    // Google Calendar events
    if (googleEvents.length > 0) {
      events.push(...googleEvents.map((ge) => googleEventToCalendarEvent(ge, eventColors)))
    }

    // Filter to visible range and hidden categories
    const rangeStart = visibleRange.start.getTime()
    const rangeEnd = visibleRange.end.getTime()

    return events
      .filter((e) => {
        const t = new Date(e.startTime).getTime()
        return t >= rangeStart && t <= rangeEnd && !hiddenCategories.has(e.category)
      })
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  }, [calBookingsData, legacyAppointments, googleEvents, visibleRange, eventColors, hiddenCategories])

  // Mutations
  const updateStatus = useUpdateAppointmentStatus()

  // Event types
  const eventTypes = eventTypesData?.data ?? []
  const calcomUsername = calcomStatus?.username ?? ''

  // ── Handlers ──

  function handleCreateAtSlot(date: Date, hour: number) {
    setCreateDialogDefaults({ date, startHour: hour })
    setShowCreateDialog(true)
  }

  function handleOutcome(eventId: string, outcome: string) {
    const event = mergedEvents.find((e) => e.id === eventId)
    if (!event) return

    if (event.source === 'calcom') {
      toast.info('Update this booking status directly in Cal.com')
      return
    }
    if (event.source === 'google') {
      toast.info('Edit this event in Google Calendar')
      return
    }

    updateStatus.mutate(
      { id: eventId, status: outcome },
      {
        onSuccess: () => toast.success(`Marked as ${outcome.replace('_', ' ')}`),
        onError: () => toast.error('Failed to update status'),
      },
    )
  }

  // ── Render ──

  return (
    <TooltipProvider>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-4 h-full flex flex-col pt-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-foreground">Calendar</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Your schedule, bookings, and event types
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Event Types Popover */}
            <EventTypesPopover
              eventTypes={eventTypes}
              username={calcomUsername}
              connected={isCalcomConnected}
            >
              <Button variant="outline" size="sm" className="text-xs gap-1.5">
                <IconCalendarEvent size={14} />
                Event Types
              </Button>
            </EventTypesPopover>

            <Button size="sm" onClick={() => { setCreateDialogDefaults(null); setShowCreateDialog(true) }}>
              <IconPlus size={14} className="mr-1.5" />
              New Event
            </Button>
          </div>
        </motion.div>

        {/* Category Legend */}
        <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(eventColors) as EventCategory[]).map((category) => (
            <Badge
              key={category}
              variant="outline"
              className={`cursor-pointer gap-1.5 transition-opacity ${hiddenCategories.has(category) ? 'opacity-30' : ''}`}
              onClick={() => toggleCategory(category)}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: eventColors[category] }}
              />
              {EVENT_CATEGORY_LABELS[category]}
            </Badge>
          ))}
        </motion.div>

        {/* Main Content: Grid + Right Panel */}
        <div className="flex gap-6 flex-1 min-h-0">
          {/* Left: Calendar Grid */}
          <CalendarGrid
            currentView={currentView}
            selectedDate={selectedDate}
            events={mergedEvents}
            onViewChange={setCurrentView}
            onSelectDate={setSelectedDate}
            onSelectEvent={setSelectedEventId}
            onCreateAtSlot={handleCreateAtSlot}
            secondaryTimezone={secondaryTimezone}
            onEventDrop={handleDrop}
            teamViewSlot={
              <TeamView
                selectedDate={selectedDate}
                events={mergedEvents}
                selectedAgentIds={selectedAgentIds}
                onAgentSelect={setSelectedAgentIds}
                onSelectEvent={setSelectedEventId}
              />
            }
          />

          {/* Right: Panel */}
          <div className="w-80 shrink-0 hidden lg:flex flex-col space-y-3">
            <div className="flex-1 min-h-0">
              <AgendaPanel
                events={mergedEvents}
                onSelectEvent={setSelectedEventId}
                onOutcome={handleOutcome}
              />
            </div>
          </div>
        </div>

        {/* Create Event Dialog */}
        <CreateEventDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          defaults={createDialogDefaults}
          existingEvents={mergedEvents}
        />

        {/* Event Detail Popover */}
        {selectedEventId && (
          <EventDetailPopover
            event={mergedEvents.find((e) => e.id === selectedEventId)}
            onClose={() => setSelectedEventId(null)}
            calcomUsername={calcomStatus?.username}
          />
        )}

        {/* Drag-Drop Confirmation Dialog */}
        <Dialog open={!!pendingConfirmation} onOpenChange={(open) => { if (!open) cancelDrop() }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reschedule Google Event?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This will update the event on your Google Calendar.
              {pendingConfirmation && (
                <> Move to <span className="font-medium text-foreground">{format(pendingConfirmation.newStart, 'EEE, MMM d @ h:mm a')}</span>?</>
              )}
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={cancelDrop}>Cancel</Button>
              <Button onClick={confirmDrop} disabled={isUpdating}>
                {isUpdating ? 'Updating...' : 'Reschedule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bottom Stats Strip */}
        <QuickStatsStrip events={mergedEvents} />
      </motion.div>
    </TooltipProvider>
  )
}
