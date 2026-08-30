import { useMemo } from 'react'
import {
  IconFileText, IconCash, IconCircleCheck, IconCalendarStats,
  IconTrendingUp, IconTrendingDown,
} from '@tabler/icons-react'
import { AreaChart, Area } from 'recharts'
import { Card } from '@/components/ui/card'
import { ChartContainer } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { useSales } from '@/hooks/useSales'
import { getAnnualizedPremium } from '@/lib/premium'
import { fmt$ } from '@/components/charts/chart-constants'

function KPICard({
  label,
  value,
  icon,
  color,
  sparkData,
  trend,
}: {
  label: string
  value: string
  icon: React.ReactNode
  color: string
  sparkData?: { v: number }[]
  trend?: number
}) {
  const sparkConfig = { v: { label, color } } satisfies ChartConfig

  return (
    <Card className="bg-card/50 backdrop-blur-sm border border-border/50 relative overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-foreground">{value}</p>
            {trend !== undefined && (
              <div className="flex items-center gap-1">
                {trend >= 0 ? (
                  <IconTrendingUp size={12} className="text-emerald-400" />
                ) : (
                  <IconTrendingDown size={12} className="text-red-400" />
                )}
                <span className={`text-[10px] font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {Math.abs(trend).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}15`, color }}
          >
            {icon}
          </div>
        </div>
        {sparkData && sparkData.length > 1 && (
          <div className="mt-2 h-[32px]">
            <ChartContainer config={sparkConfig} className="h-[32px] w-full">
              <AreaChart data={sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`spark-${label.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={color}
                  fill={`url(#spark-${label.replace(/\s/g, '')})`}
                  strokeWidth={1.5}
                  dot={false}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        )}
      </div>
    </Card>
  )
}

export default function PolicyKPICardsWidget() {
  const { data: salesData, isLoading } = useSales({ page: 1 })
  const sales = salesData?.sales ?? []

  const totalSales = salesData?.total ?? 0

  const totalAP = useMemo(() => {
    if (salesData?.totalPremium && salesData.totalPremium > 0) return salesData.totalPremium
    return sales.reduce((sum, s) => sum + getAnnualizedPremium(s), 0)
  }, [salesData?.totalPremium, sales])

  const activePolicies = useMemo(() => {
    if (salesData?.activeCount && salesData.activeCount > 0) return salesData.activeCount
    return sales.filter(s => ['issued', 'paid', 'placed', 'active'].includes(s.status?.toLowerCase())).length
  }, [salesData?.activeCount, sales])

  const monthlyPremium = totalAP / 12

  const monthlyData = useMemo(() => {
    const now = new Date()
    const months: { month: string; premium: number; count: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const monthSales = sales.filter(s => (s.createdAt || s.submittedAt)?.startsWith(key))
      const total = monthSales.reduce((sum, s) => sum + getAnnualizedPremium(s), 0)
      months.push({ month: key, premium: total, count: monthSales.length })
    }
    return months
  }, [sales])

  const sparklineValues = useMemo(() => monthlyData.map(m => m.premium), [monthlyData])
  const trend = useMemo(() => {
    if (sparklineValues.length < 2) return undefined
    const prev = sparklineValues[sparklineValues.length - 2]
    const curr = sparklineValues[sparklineValues.length - 1]
    if (prev === 0) return undefined
    return ((curr - prev) / Math.abs(prev)) * 100
  }, [sparklineValues])

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-28 rounded-xl bg-muted/30 animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KPICard
        label="Total Policies"
        value={String(totalSales)}
        icon={<IconFileText size={20} />}
        color="#3b82f6"
        sparkData={monthlyData.map(m => ({ v: m.count }))}
      />
      <KPICard
        label="Total AP"
        value={fmt$(totalAP)}
        icon={<IconCash size={20} />}
        color="#7DD3FC"
        sparkData={monthlyData.map(m => ({ v: m.premium }))}
        trend={trend}
      />
      <KPICard
        label="Active Policies"
        value={String(activePolicies)}
        icon={<IconCircleCheck size={20} />}
        color="#22c55e"
      />
      <KPICard
        label="Monthly Premium"
        value={fmt$(monthlyPremium)}
        icon={<IconCalendarStats size={20} />}
        color="#a855f7"
      />
    </div>
  )
}
