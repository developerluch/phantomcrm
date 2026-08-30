import { useMemo } from 'react'
import { format, startOfWeek, endOfWeek, addDays, addMonths, addWeeks, subMonths, subWeeks, subDays } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { tabContentVariants } from '@/lib/motion'
import MonthView from './MonthView'
import WeekView from './WeekView'
import DayView from './DayView'
import type { CalendarViewType, CalendarEvent } from './constants'
import type { DragEventPayload } from './drag-utils'

interface CalendarGridProps {
  currentView: CalendarViewType
  selectedDate: Date
  events: CalendarEvent[]
  onViewChange: (view: CalendarViewType) => void
  onSelectDate: (date: Date) => void
  onSelectEvent: (eventId: string) => void
  onCreateAtSlot: (date: Date, hour: number) => void
  secondaryTimezone: string
  teamViewSlot?: React.ReactNode
  onEventDrop?: (payload: DragEventPayload, newStart: Date, newEnd: Date) => void
}

export default function CalendarGrid({
  currentView,
  selectedDate,
  events,
  onViewChange,
  onSelectDate,
  onSelectEvent,
  onCreateAtSlot,
  secondaryTimezone,
  teamViewSlot,
  onEventDrop,
}: CalendarGridProps) {
  // Navigation label
  const displayLabel = useMemo(() => {
    switch (currentView) {
      case 'month':
        return format(selectedDate, 'MMMM yyyy')
      case 'week': {
        const ws = startOfWeek(selectedDate, { weekStartsOn: 0 })
        const we = endOfWeek(selectedDate, { weekStartsOn: 0 })
        return `${format(ws, 'MMM d')} – ${format(we, 'MMM d, yyyy')}`
      }
      case 'day':
        return format(selectedDate, 'EEEE, MMMM d, yyyy')
      case 'team':
        return format(selectedDate, 'EEEE, MMMM d, yyyy')
    }
  }, [currentView, selectedDate])

  function goToday() {
    onSelectDate(new Date())
  }

  function goBack() {
    switch (currentView) {
      case 'month':
        onSelectDate(subMonths(selectedDate, 1))
        break
      case 'week':
        onSelectDate(subWeeks(selectedDate, 1))
        break
      case 'day':
      case 'team':
        onSelectDate(subDays(selectedDate, 1))
        break
    }
  }

  function goForward() {
    switch (currentView) {
      case 'month':
        onSelectDate(addMonths(selectedDate, 1))
        break
      case 'week':
        onSelectDate(addWeeks(selectedDate, 1))
        break
      case 'day':
      case 'team':
        onSelectDate(addDays(selectedDate, 1))
        break
    }
  }

  // Direction for animation
  const direction = 1

  return (
    <div className="flex-1 min-w-0 flex flex-col">
      {/* Navigation bar */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Tabs
            value={currentView}
            onValueChange={(v) => onViewChange(v as CalendarViewType)}
          >
            <TabsList>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="day">Day</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goToday} className="text-xs">
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goBack}>
            <IconChevronLeft size={14} />
          </Button>
          <span className="text-sm font-medium text-foreground min-w-[180px] text-center">
            {displayLabel}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={goForward}>
            <IconChevronRight size={14} />
          </Button>
        </div>
      </div>

      {/* View content */}
      <div className="flex-1 min-h-0 rounded-xl border border-border/30 bg-card/30 backdrop-blur overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentView}
            custom={direction}
            variants={tabContentVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {currentView === 'month' && (
              <MonthView
                selectedDate={selectedDate}
                events={events}
                onSelectDate={onSelectDate}
                onSelectEvent={onSelectEvent}
                onEventDrop={onEventDrop}
              />
            )}
            {currentView === 'week' && (
              <WeekView
                selectedDate={selectedDate}
                events={events}
                onSelectDate={onSelectDate}
                onSelectEvent={onSelectEvent}
                onCreateAtSlot={onCreateAtSlot}
                secondaryTimezone={secondaryTimezone}
                onEventDrop={onEventDrop}
              />
            )}
            {currentView === 'day' && (
              <DayView
                selectedDate={selectedDate}
                events={events}
                onSelectEvent={onSelectEvent}
                onCreateAtSlot={onCreateAtSlot}
                secondaryTimezone={secondaryTimezone}
                onEventDrop={onEventDrop}
              />
            )}
            {currentView === 'team' && teamViewSlot}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
