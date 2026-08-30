import { useMemo } from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { useSalesPipeline } from '@/hooks/useSales'
import { AXIS_TICK, GRID_PROPS, fmtPct } from '@/components/charts/chart-constants'
import PolicyWidgetEmptyState from './PolicyWidgetEmptyState'

const pipelineConfig = {
  count: { label: 'Policies', color: '#7DD3FC' },
} satisfies ChartConfig

const STAGE_COLORS = ['#3b82f6', '#8b5cf6', '#7DD3FC', '#22c55e', '#06b6d4']

export default function PolicyPipelineWidget() {
  const { data: pipeline, isLoading } = useSalesPipeline()

  const stages = useMemo(() => {
    if (!pipeline) return []
    return [
      { name: 'Submitted', count: pipeline.submitted.count, color: STAGE_COLORS[0] },
      { name: 'Approved', count: pipeline.approved.count, color: STAGE_COLORS[1] },
      { name: 'Issued', count: pipeline.issued.count, color: STAGE_COLORS[2] },
      { name: 'On Books', count: pipeline.onBooks.count, color: STAGE_COLORS[3] },
      { name: 'Paid', count: pipeline.paid.count, color: STAGE_COLORS[4] },
    ]
  }, [pipeline])

  if (isLoading) {
    return <div className="h-[220px] rounded-xl bg-muted/30 animate-pulse" />
  }

  if (!pipeline || stages.every((stage) => stage.count === 0)) {
    return (
      <PolicyWidgetEmptyState
        title="No pipeline data yet"
        description="Pipeline stages populate as policies move from submitted to paid."
        learnTitle="How policy pipeline works"
        learnBody="This widget tracks policy counts across submitted, approved, issued, on-books, and paid stages to reveal bottlenecks."
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          Close Rate: {fmtPct(pipeline.closeRate)}
        </Badge>
        <Badge variant="outline" className="text-[10px]">
          Persistency: {fmtPct(pipeline.persistencyRate)}
        </Badge>
      </div>
      <ChartContainer config={pipelineConfig} className="h-[180px] w-full">
        <BarChart data={stages} layout="vertical" margin={{ top: 0, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID_PROPS} horizontal={false} />
          <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={false} width={70} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {stages.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}
