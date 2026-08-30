import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { useLeadROI } from '../../hooks/useExpenses'
import { useDateStore } from '../../store/date-store'

const roiConfig = {
  cost: { label: 'Cost', color: '#ef4444' },
  revenue: { label: 'Revenue', color: '#22c55e' },
} satisfies ChartConfig

export default function LeadROIWidget() {
  const { current } = useDateStore()
  const { data: leadROI, isLoading } = useLeadROI({ dateFrom: current.from, dateTo: current.to })

  const chartData = useMemo(() => {
    if (!leadROI || !Array.isArray(leadROI)) return []
    return leadROI.map((r: { source: string; cost: number; revenue?: number }) => ({
      source: r.source,
      cost: r.cost,
      revenue: r.revenue ?? 0,
    }))
  }, [leadROI])

  if (isLoading) return <div className="h-full rounded-xl bg-muted/50 animate-pulse" />
  if (chartData.length === 0) return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No lead ROI data</div>

  return (
    <ChartContainer config={roiConfig} className="h-full w-full">
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 4, bottom: 4, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
        <YAxis type="category" dataKey="source" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} width={80} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="cost" fill="var(--color-cost)" radius={[0, 4, 4, 0]} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
