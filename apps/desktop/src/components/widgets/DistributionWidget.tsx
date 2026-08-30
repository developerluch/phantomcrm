import { useMemo } from 'react'
import { PieChart, Pie, Cell } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { useSummary } from '../../hooks/useDashboard'
import { useDateStore } from '../../store/date-store'

const COLORS = ['#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4']

export default function DistributionWidget() {
  const { current } = useDateStore()
  const { data: summary, isLoading } = useSummary({ dateFrom: current.from, dateTo: current.to })

  const chartData = useMemo(() => {
    if (!summary) return []
    return [
      { name: 'Active', value: summary.active_agents || 0 },
      { name: 'At Risk', value: summary.at_risk_count || 0 },
      { name: 'Other', value: Math.max(0, (summary.total_agents || 0) - (summary.active_agents || 0) - (summary.at_risk_count || 0)) },
    ].filter(d => d.value > 0)
  }, [summary])

  const chartConfig = useMemo(() => {
    const cfg: Record<string, { label: string; color: string }> = {}
    chartData.forEach((d, i) => { cfg[d.name.toLowerCase()] = { label: d.name, color: COLORS[i % COLORS.length] } })
    return cfg as ChartConfig
  }, [chartData])

  if (isLoading) return <div className="h-full rounded-xl bg-muted/50 animate-pulse" />
  if (chartData.length === 0) return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No distribution data</div>

  return (
    <div className="h-full flex items-center justify-center">
      <ChartContainer config={chartConfig} className="h-full w-full max-w-[250px]">
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <ChartTooltip content={<ChartTooltipContent />} />
        </PieChart>
      </ChartContainer>
    </div>
  )
}
