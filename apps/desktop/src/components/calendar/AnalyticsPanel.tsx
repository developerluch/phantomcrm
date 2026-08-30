import React, { useMemo } from 'react'
import { startOfWeek, endOfWeek, isWithinInterval, isPast, format, eachDayOfInterval } from 'date-fns'
import { AreaChart, Area } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { IconChartBar, IconCalendarStats, IconUserOff, IconCircleCheck } from '@tabler/icons-react'
import { EVENT_CATEGORIES, EVENT_CATEGORY_COLORS } from './constants'
import type { CalendarEvent, EventCategory } from './constants'

const sparklineConfig = {
  count: {
    label: 'Events',
    color: '#3b82f6',
  },
} satisfies ChartConfig

interface AnalyticsPanelProps {
  events: CalendarEvent[]
}

export default function AnalyticsPanel({ events }: AnalyticsPanelProps) {
  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 0 })

  // Stats
  const stats = useMemo(() => {
    const thisWeek = events.filter((e) =>
      isWithinInterval(new Date(e.startTime), { start: weekStart, end: weekEnd }),
    )
    const pastEvents = events.filter((e) => isPast(new Date(e.endTime)))
    const completed = pastEvents.filter((e) => e.status === 'completed' || e.status === 'accepted')
    const noShows = pastEvents.filter((e) => e.status === 'no_show')

    const completionRate = pastEvents.length > 0 ? Math.round((completed.length / pastEvents.length) * 100) : 0
    const noShowRate = pastEvents.length > 0 ? Math.round((noShows.length / pastEvents.length) * 100) : 0

    return {
      thisWeekCount: thisWeek.length,
      completionRate,
      noShowRate,
    }
  }, [events, weekStart, weekEnd])

  // Weekly trend sparkline data
  const sparklineData = useMemo(() => {
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd })
    return days.map((day) => {
      const dayKey = format(day, 'yyyy-MM-dd')
      const count = events.filter((e) => e.startTime.slice(0, 10) === dayKey).length
      return { day: format(day, 'EEE'), count }
    })
  }, [events, weekStart, weekEnd])

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const event of events) {
      counts[event.category] = (counts[event.category] ?? 0) + 1
    }
    return EVENT_CATEGORIES
      .map((cat) => ({ ...cat, count: counts[cat.value] ?? 0 }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [events])

  const maxCategoryCount = Math.max(...categoryBreakdown.map((c) => c.count), 1)

  return (
    <Card
      className="border-border/30 h-full"
      style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}
    >
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent rounded-t-xl" />
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-semibold flex items-center gap-2">
          <IconChartBar size={14} className="text-blue-400" />
          Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stat Cards */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            icon={<IconCalendarStats size={14} className="text-blue-400" />}
            label="This Week"
            value={stats.thisWeekCount}
          />
          <StatCard
            icon={<IconCircleCheck size={14} className="text-emerald-400" />}
            label="Completion"
            value={`${stats.completionRate}%`}
          />
          <StatCard
            icon={<IconUserOff size={14} className="text-amber-400" />}
            label="No-Show"
            value={`${stats.noShowRate}%`}
          />
        </div>

        {/* Sparkline */}
        <div>
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
            Weekly Trend
          </p>
          <div className="h-16 w-full">
            <ChartContainer config={sparklineConfig} className="h-full w-full">
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id="sparkGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-count)"
                  strokeWidth={1.5}
                  fill="url(#sparkGradient)"
                />
              </AreaChart>
            </ChartContainer>
          </div>
          <div className="flex justify-between text-[8px] text-muted-foreground/40 mt-1">
            {sparklineData.map((d) => (
              <span key={d.day}>{d.day}</span>
            ))}
          </div>
        </div>

        {/* Category Breakdown */}
        {categoryBreakdown.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-2">
              By Category
            </p>
            <div className="space-y-2">
              {categoryBreakdown.map((cat) => (
                <div key={cat.value} className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: cat.color }}
                  />
                  <span className="text-[10px] text-foreground flex-1 truncate">{cat.label}</span>
                  <Progress
                    className="w-20 h-1.5 bg-muted/20"
                    value={(cat.count / maxCategoryCount) * 100}
                    indicatorClassName="[background:var(--bar-color)]"
                    style={{ '--bar-color': cat.color } as React.CSSProperties}
                  />
                  <Badge variant="outline" className="text-[8px] px-1 h-4">{cat.count}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-lg border border-border/30 bg-muted/5 p-2 text-center">
      <div className="flex items-center justify-center mb-1">{icon}</div>
      <p className="text-sm font-bold text-foreground">{value}</p>
      <p className="text-[8px] text-muted-foreground/60 uppercase tracking-wider">{label}</p>
    </div>
  )
}
