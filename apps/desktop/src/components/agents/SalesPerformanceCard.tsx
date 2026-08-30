import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { motion } from 'framer-motion'
import { IconCurrencyDollar, IconReceipt, IconCalendar, IconTrendingUp } from '@tabler/icons-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { fmtUSD, STATUS_BADGE_COLORS } from './analytics-helpers'
import type { Sale, SaleStats } from '../../types/portal'

const chartConfig = {
  premium: { label: 'Premium', color: '#7DD3FC' },
} satisfies ChartConfig

interface Props {
  sales: Sale[]
  stats: SaleStats | null
  compact?: boolean
}

export function SalesPerformanceCard({ sales, stats, compact = false }: Props) {
  const trendData = useMemo(() => {
    if (!sales.length) return []
    const monthMap: Record<string, number> = {}
    for (const s of sales) {
      const month = s.submittedAt?.slice(0, 7) ?? s.createdAt.slice(0, 7)
      monthMap[month] = (monthMap[month] ?? 0) + s.premium
    }
    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, premium]) => ({
        month: month.slice(5),
        premium: Math.round(premium),
      }))
  }, [sales])

  const recentSales = sales.slice(0, compact ? 3 : 5)

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className={compact ? 'px-4 py-3' : undefined}>
          <CardTitle className="flex items-center gap-2 text-sm">
            <IconCurrencyDollar size={16} className="text-emerald-400" />
            Sales Performance
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'px-4 pb-4 pt-0' : undefined}>
          <div className="space-y-4">
            {/* Metrics */}
            {stats && (
              <div className={`grid gap-2 ${compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
                <MetricItem
                  icon={<IconCurrencyDollar size={14} className="text-emerald-400" />}
                  label="Total Premium"
                  value={fmtUSD.format(stats.totalPremium)}
                />
                <MetricItem
                  icon={<IconCurrencyDollar size={14} className="text-blue-400" />}
                  label="Commission"
                  value={fmtUSD.format(stats.totalCommission)}
                />
                <MetricItem
                  icon={<IconCalendar size={14} className="text-amber-400" />}
                  label="This Month"
                  value={String(stats.thisMonth.count)}
                  subtext={fmtUSD.format(stats.thisMonth.premium)}
                />
                {!compact && (
                  <MetricItem
                    icon={<IconCalendar size={14} className="text-muted-foreground" />}
                    label="Last Month"
                    value={String(stats.lastMonth.count)}
                    subtext={fmtUSD.format(stats.lastMonth.premium)}
                  />
                )}
              </div>
            )}

            {/* Trend Chart */}
            {trendData.length > 1 && (
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <IconTrendingUp size={12} />
                  Monthly Trend
                </h4>
                <div className={compact ? 'h-28' : 'h-40'}>
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <AreaChart data={trendData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--color-premium)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--color-premium)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotone"
                        dataKey="premium"
                        stroke="var(--color-premium)"
                        fill="url(#salesGrad)"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: 'var(--color-premium)', strokeWidth: 2, fill: 'hsl(var(--background))' }}
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>
              </div>
            )}

            {/* Recent Sales */}
            {recentSales.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Recent Policies
                </h4>
                <div className="space-y-1.5">
                  {recentSales.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between rounded-md bg-card/50 px-3 py-2 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-foreground">{sale.clientName}</div>
                        <div className="text-muted-foreground">
                          {sale.policyType.replace('_', ' ')} · {sale.carrier}
                        </div>
                      </div>
                      <div className="ml-3 text-right">
                        <div className="font-medium text-foreground">{fmtUSD.format(sale.premium)}</div>
                        <Badge className={`text-[10px] ${STATUS_BADGE_COLORS[sale.status] ?? 'bg-zinc-500/20 text-muted-foreground'}`}>
                          {sale.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!stats && sales.length === 0 && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                <IconReceipt size={20} className="mx-auto mb-2 text-muted-foreground/30" />
                No sales data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function MetricItem({ icon, label, value, subtext }: { icon: React.ReactNode; label: string; value: string; subtext?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
      {subtext && <div className="text-[10px] text-muted-foreground">{subtext}</div>}
    </div>
  )
}
