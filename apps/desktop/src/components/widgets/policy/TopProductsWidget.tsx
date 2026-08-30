import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { useSales } from '@/hooks/useSales'
import { getAnnualizedPremium } from '@/lib/premium'
import { AXIS_TICK, GRID_PROPS, fmtCompact$ } from '@/components/charts/chart-constants'
import PolicyWidgetEmptyState from './PolicyWidgetEmptyState'

const productsConfig = {
  premium: { label: 'Annual Premium', color: '#7DD3FC' },
} satisfies ChartConfig

export default function TopProductsWidget() {
  const { data: salesData, isLoading } = useSales({ page: 1 })
  const sales = salesData?.sales ?? []

  const productData = useMemo(() => {
    const grouped: Record<string, { name: string; premium: number; count: number }> = {}
    for (const s of sales) {
      const product = s.productName || s.policyType || 'Unknown'
      if (!grouped[product]) grouped[product] = { name: product, premium: 0, count: 0 }
      grouped[product].premium += getAnnualizedPremium(s)
      grouped[product].count++
    }
    return Object.values(grouped)
      .sort((a, b) => b.premium - a.premium)
      .slice(0, 8)
  }, [sales])

  if (isLoading) {
    return <div className="h-[220px] rounded-xl bg-muted/30 animate-pulse" />
  }

  if (productData.length === 0) {
    return (
      <PolicyWidgetEmptyState
        title="No product data yet"
        description="Product rankings appear once policies include product or policy type details."
        learnTitle="How top products works"
        learnBody="This widget groups policies by product or policy type and ranks them by annualized premium so you can spot production patterns."
      />
    )
  }

  return (
    <ChartContainer config={productsConfig} className="h-[220px] w-full">
      <BarChart data={productData} layout="vertical" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} horizontal={false} />
        <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={fmtCompact$} />
        <YAxis type="category" dataKey="name" tick={AXIS_TICK} tickLine={false} axisLine={false} width={90} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="premium" fill="var(--color-premium)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
