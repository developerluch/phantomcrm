import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { useSales } from '@/hooks/useSales'
import { getAnnualizedPremium } from '@/lib/premium'
import { AXIS_TICK, GRID_PROPS, fmtCompact$ } from '@/components/charts/chart-constants'
import { apTimeConfig } from './policy-constants'
import PolicyWidgetEmptyState from './PolicyWidgetEmptyState'

export default function PremiumOverTimeWidget() {
  const { data: salesData, isLoading } = useSales({ page: 1 })
  const sales = salesData?.sales ?? []

  const monthlyData = useMemo(() => {
    const now = new Date()
    const months: { month: string; premium: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-US', { month: 'short' })
      const monthSales = sales.filter(s => (s.createdAt || s.submittedAt)?.startsWith(key))
      const total = monthSales.reduce((sum, s) => sum + getAnnualizedPremium(s), 0)
      months.push({ month: label, premium: total })
    }
    return months
  }, [sales])

  if (isLoading) {
    return <div className="h-[220px] rounded-xl bg-muted/30 animate-pulse" />
  }

  const hasPremium = monthlyData.some((month) => month.premium > 0)
  if (!hasPremium) {
    return (
      <PolicyWidgetEmptyState
        title="No premium trend yet"
        description="This chart appears once submitted business has premium values across time."
        learnTitle="How premium trends work"
        learnBody="Premium Over Time reads submitted policy dates and annualized premium. Once policies are submitted or imported, this widget shows the last six months of production."
      />
    )
  }

  return (
    <ChartContainer config={apTimeConfig} className="h-[220px] w-full">
      <AreaChart data={monthlyData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
        <defs>
          <linearGradient id="apGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-premium)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-premium)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="month" tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={fmtCompact$} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="premium"
          stroke="var(--color-premium)"
          fill="url(#apGrad)"
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  )
}
