import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { useSales } from '@/hooks/useSales'
import { getAnnualizedPremium } from '@/lib/premium'
import { AXIS_TICK, GRID_PROPS, fmtCompact$ } from '@/components/charts/chart-constants'
import { carrierConfig } from './policy-constants'
import PolicyWidgetEmptyState from './PolicyWidgetEmptyState'

export default function CarrierDistributionWidget() {
  const { data: salesData, isLoading } = useSales({ page: 1 })
  const sales = salesData?.sales ?? []

  const carrierData = useMemo(() => {
    const grouped: Record<string, number> = {}
    for (const s of sales) {
      const carrier = s.carrier || 'Unknown'
      grouped[carrier] = (grouped[carrier] ?? 0) + getAnnualizedPremium(s)
    }
    return Object.entries(grouped)
      .map(([name, premium]) => ({ name, premium }))
      .sort((a, b) => b.premium - a.premium)
      .slice(0, 8)
  }, [sales])

  if (isLoading) {
    return <div className="h-[220px] rounded-xl bg-muted/30 animate-pulse" />
  }

  if (carrierData.length === 0) {
    return (
      <PolicyWidgetEmptyState
        title="No carrier distribution yet"
        description="Carrier volume appears when policies include carrier and premium details."
        learnTitle="How carrier distribution works"
        learnBody="This widget ranks carriers by annualized premium so you can see concentration and production mix by carrier."
      />
    )
  }

  return (
    <ChartContainer config={carrierConfig} className="h-[220px] w-full">
      <BarChart data={carrierData} layout="vertical" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={fmtCompact$} />
        <YAxis type="category" dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={false} width={90} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="premium" fill="var(--color-premium)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
