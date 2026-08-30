import { useMemo } from 'react'
import { isToday, isThisWeek } from 'date-fns'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { IconCalendar, IconCalendarEvent, IconClockHour3 } from '@tabler/icons-react'
import type { CalendarEvent } from './constants'

interface QuickStatsStripProps {
  events: CalendarEvent[]
}

export default function QuickStatsStrip({ events }: QuickStatsStripProps) {
  const stats = useMemo(() => {
    const now = new Date()
    const todayCount = events.filter((e) => isToday(new Date(e.startTime))).length
    const thisWeekCount = events.filter((e) => isThisWeek(new Date(e.startTime), { weekStartsOn: 0 })).length
    const upcomingCount = events.filter((e) => new Date(e.startTime).getTime() > now.getTime()).length

    return { todayCount, thisWeekCount, upcomingCount }
  }, [events])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="flex items-center gap-3 text-[10px] text-muted-foreground/60 border-t border-border/20 pt-2"
    >
      <span className="flex items-center gap-1">
        <IconCalendar size={10} />
        <strong className="text-foreground/80">{stats.todayCount}</strong> today
      </span>
      <Separator orientation="vertical" className="h-3" />
      <span className="flex items-center gap-1">
        <IconCalendarEvent size={10} />
        <strong className="text-foreground/80">{stats.thisWeekCount}</strong> this week
      </span>
      <Separator orientation="vertical" className="h-3" />
      <span className="flex items-center gap-1">
        <IconClockHour3 size={10} />
        <strong className="text-foreground/80">{stats.upcomingCount}</strong> upcoming
      </span>
    </motion.div>
  )
}
