import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { useConversionAnalytics } from '../../hooks/useAnalytics'
import { useDateStore } from '../../store/date-store'

const conversionConfig = {
  percentage: { label: 'Conversion %', color: '#22c55e' },
} satisfies ChartConfig

export default function ConversionWidget() {
  const { current } = useDateStore()
  const { data: analytics, isLoading } = useConversionAnalytics({ dateFrom: current.from, dateTo: current.to })

  const chartData = useMemo(() => {
    if (!analytics || !Array.isArray(analytics)) return []
    return analytics.map((d) => ({
      name: d.name,
      percentage: d.percentage,
    }))
  }, [analytics])

  const currentRate = chartData.length > 0 ? chartData[chartData.length - 1].percentage : 0

  if (isLoading) return <div className="h-full rounded-xl bg-muted/50 animate-pulse" />

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-2xl font-bold text-foreground">{currentRate.toFixed(1)}%</span>
        <span className="text-xs text-muted-foreground">conversion rate</span>
      </div>
      {chartData.length > 0 ? (
        <div className="flex-1 min-h-0">
          <ChartContainer config={conversionConfig} className="h-full w-full">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-percentage)" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="var(--color-percentage)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area type="monotone" dataKey="percentage" stroke="var(--color-percentage)" fill="url(#convGrad)" strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">No conversion data</div>
      )}
    </div>
  )
}
