import { useMemo } from 'react'
import { Area, AreaChart, Cell, Pie, PieChart } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  LIFECYCLE_STAGE_COLORS,
  LIFECYCLE_STAGE_LABELS,
  type Contact,
  type LifecycleStage,
} from '@/types/portal'

interface ContactsHeaderStatsProps {
  contacts: Contact[]
  /** Optional history points for sparkline. If absent, computes a minimal trend from createdAt. */
  history?: { date: string; total: number }[]
}

/** FIXED card row — four glassmorphic stat cards. NOT a draggable widget grid.
 *  Every chart is wrapped in ChartContainer per hard rule. */
export function ContactsHeaderStats({ contacts, history }: ContactsHeaderStatsProps) {
  const stats = useMemo(() => {
    const total = contacts.length
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const newThisWeek = contacts.filter((c) => new Date(c.createdAt) >= weekAgo).length
    const dncCount = contacts.filter((c) => c.doNotSms || c.doNotEmail || c.doNotCall).length
    const byStage: Record<LifecycleStage, number> = {
      lead: 0, prospect: 0, customer: 0, agent: 0, churned: 0,
    }
    for (const c of contacts) {
      byStage[c.lifecycleStage] = (byStage[c.lifecycleStage] ?? 0) + 1
    }
    return { total, newThisWeek, dncCount, byStage }
  }, [contacts])

  const trendData = useMemo(() => {
    if (history && history.length > 0) {
      return history.map((h) => ({ x: h.date, y: h.total }))
    }
    // Fallback: bucket createdAt by day, last 7 days.
    const days: { x: string; y: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const cnt = contacts.filter((c) => c.createdAt.slice(0, 10) === key).length
      days.push({ x: key, y: cnt })
    }
    return days
  }, [contacts, history])

  const donutData = useMemo(
    () =>
      (Object.entries(stats.byStage) as [LifecycleStage, number][])
        .filter(([, v]) => v > 0)
        .map(([stage, value]) => ({
          stage,
          value,
          fill: `var(--color-${stage})`,
        })),
    [stats.byStage],
  )

  const donutConfig: ChartConfig = useMemo(() => {
    const cfg: ChartConfig = {}
    ;(Object.keys(stats.byStage) as LifecycleStage[]).forEach((s) => {
      cfg[s] = { label: LIFECYCLE_STAGE_LABELS[s], color: LIFECYCLE_STAGE_COLORS[s] }
    })
    return cfg
  }, [stats.byStage])

  const trendConfig: ChartConfig = {
    y: { label: 'Contacts', color: 'hsl(var(--chart-1))' },
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Contacts"
        value={stats.total}
        trend={
          <ChartContainer config={trendConfig} className="h-[48px] w-full">
            <AreaChart data={trendData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradTotal" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-y)" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="var(--color-y)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="y"
                stroke="var(--color-y)"
                fill="url(#gradTotal)"
                strokeWidth={2}
                isAnimationActive={false}
              />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            </AreaChart>
          </ChartContainer>
        }
      />

      <StatCard
        label="New This Week"
        value={stats.newThisWeek}
        trend={
          <ChartContainer config={trendConfig} className="h-[48px] w-full">
            <AreaChart data={trendData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <Area
                type="step"
                dataKey="y"
                stroke="var(--color-y)"
                fill="var(--color-y)"
                fillOpacity={0.15}
                strokeWidth={2}
                isAnimationActive={false}
              />
              <ChartTooltip content={<ChartTooltipContent hideLabel />} />
            </AreaChart>
          </ChartContainer>
        }
      />

      <StatCard
        label="By Lifecycle"
        value={stats.total}
        trend={
          donutData.length > 0 ? (
            <ChartContainer config={donutConfig} className="h-[48px] w-[48px] ml-auto">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="stage"
                  innerRadius={14}
                  outerRadius={22}
                  strokeWidth={1}
                >
                  {donutData.map((d) => (
                    <Cell key={d.stage} fill={d.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          ) : null
        }
      />

      <StatCard
        label="DNC"
        value={stats.dncCount}
        trend={
          <Badge variant="outline" className="ml-auto">
            {stats.total > 0 ? Math.round((stats.dncCount / stats.total) * 100) : 0}% of total
          </Badge>
        }
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  trend,
}: {
  label: string
  value: number
  trend?: React.ReactNode
}) {
  return (
    <Card className="bg-card/50 backdrop-blur">
      <CardContent className="p-4">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 flex items-center gap-3">
          <div className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</div>
          {trend && <div className="flex-1 min-w-0 flex items-center justify-end">{trend}</div>}
        </div>
      </CardContent>
    </Card>
  )
}
