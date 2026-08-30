import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { usePipelineValue } from '../../hooks/useDashboard'
import { useDateStore } from '../../store/date-store'

const STAGE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4', '#22c55e', '#10b981', '#ef4444']

const pipelineConfig = {
  count: { label: 'Count', color: '#3b82f6' },
} satisfies ChartConfig

export default function PipelineWidget() {
  const { current } = useDateStore()
  const { data: pipeline, isLoading } = usePipelineValue({ dateFrom: current.from, dateTo: current.to })

  if (isLoading) return <div className="h-full rounded-xl bg-muted/50 animate-pulse" />
  if (!pipeline || pipeline.length === 0) return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No pipeline data</div>

  return (
    <ChartContainer config={pipelineConfig} className="h-full w-full">
      <BarChart data={pipeline} margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="stage" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} allowDecimals={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {pipeline.map((_: unknown, i: number) => (
            <Cell key={i} fill={STAGE_COLORS[i % STAGE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
