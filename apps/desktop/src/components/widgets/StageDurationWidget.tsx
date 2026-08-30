import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { useStageDurationAnalytics } from '../../hooks/useAnalytics'
import { useDateStore } from '../../store/date-store'

const COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4', '#22c55e', '#ef4444', '#10b981']

const durationConfig = {
  avgDays: { label: 'Avg Days', color: '#f59e0b' },
} satisfies ChartConfig

interface StageDuration {
  stage?: string
  label?: string
  avgDays?: number
  average_days?: number
}

export default function StageDurationWidget() {
  const { current } = useDateStore()
  const { data: analytics, isLoading } = useStageDurationAnalytics({ dateFrom: current.from, dateTo: current.to })

  const chartData = useMemo(() => {
    if (!analytics || !Array.isArray(analytics)) return []
    return analytics.map((d: StageDuration) => ({
      stage: d.label || d.stage || 'Unknown',
      avgDays: d.avgDays ?? d.average_days ?? 0,
    }))
  }, [analytics])

  if (isLoading) return <div className="h-full rounded-xl bg-muted/50 animate-pulse" />
  if (chartData.length === 0) return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No stage duration data</div>

  return (
    <ChartContainer config={durationConfig} className="h-full w-full">
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 20, bottom: 4, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="stage" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={90} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="avgDays" radius={[0, 4, 4, 0]}>
          {chartData.map((_: unknown, i: number) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
