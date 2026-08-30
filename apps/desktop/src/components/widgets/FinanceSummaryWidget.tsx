import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { useFinanceSummary } from '../../hooks/useExpenses'
import { useDateStore } from '../../store/date-store'

const financeConfig = {
  revenue: { label: 'Revenue', color: '#22c55e' },
  expenses: { label: 'Expenses', color: '#ef4444' },
  net: { label: 'Net', color: '#3b82f6' },
} satisfies ChartConfig

export default function FinanceSummaryWidget() {
  const { current } = useDateStore()
  const { data: summary, isLoading } = useFinanceSummary({ dateFrom: current.from, dateTo: current.to })

  const chartData = useMemo(() => {
    if (!summary?.byMonth) return []
    return summary.byMonth.slice(-6).map((m: { month: string; revenue: number; expenses: number; net: number }) => ({
      month: m.month,
      revenue: m.revenue,
      expenses: m.expenses,
      net: m.net,
    }))
  }, [summary])

  if (isLoading) return <div className="h-full rounded-xl bg-muted/50 animate-pulse" />
  if (chartData.length === 0) return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No finance data</div>

  return (
    <ChartContainer config={financeConfig} className="h-full w-full">
      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="net" fill="var(--color-net)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
