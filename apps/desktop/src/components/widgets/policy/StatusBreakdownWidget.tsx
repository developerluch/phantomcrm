import { useMemo } from 'react'
import { PieChart, Pie, Cell } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { useSales } from '@/hooks/useSales'
import { CHART_COLORS } from '@/components/charts/chart-constants'
import { getStatusGroup, STATUS_COLORS, statusConfig } from './policy-constants'
import PolicyWidgetEmptyState from './PolicyWidgetEmptyState'

export default function StatusBreakdownWidget() {
  const { data: salesData, isLoading } = useSales({ page: 1 })
  const sales = salesData?.sales ?? []

  const statusData = useMemo(() => {
    const grouped: Record<string, number> = {}
    for (const s of sales) {
      const group = getStatusGroup(s.status)
      grouped[group] = (grouped[group] ?? 0) + 1
    }
    return Object.entries(grouped).map(([name, value]) => ({ name, value }))
  }, [sales])

  if (isLoading) {
    return <div className="h-[220px] rounded-xl bg-muted/30 animate-pulse" />
  }

  if (statusData.length === 0) {
    return (
      <PolicyWidgetEmptyState
        title="No status mix yet"
        description="Status breakdown appears after policies enter submitted, issued, active, or cancelled states."
        learnTitle="How status breakdown works"
        learnBody="This widget groups policies into pending, issued, active, and cancelled buckets so you can quickly see where business stands."
      />
    )
  }

  return (
    <div>
      <ChartContainer config={statusConfig} className="h-[220px] w-full">
        <PieChart>
          <ChartTooltip content={<ChartTooltipContent />} />
          <Pie
            data={statusData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            strokeWidth={2}
            stroke="hsl(var(--background))"
          >
            {statusData.map(entry => (
              <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? CHART_COLORS.blue} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>
      <div className="flex flex-wrap justify-center gap-3 mt-2">
        {statusData.map(entry => (
          <div key={entry.name} className="flex items-center gap-1.5 text-[10px]">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[entry.name] ?? CHART_COLORS.blue }} />
            <span className="text-muted-foreground capitalize">{entry.name}</span>
            <span className="text-foreground font-medium">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
