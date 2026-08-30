import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ComposedChart, Area, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Toggle } from '@/components/ui/toggle'
import { useRevenueChart } from '../../hooks/useDashboard'
import { useFinanceSummary } from '../../hooks/useExpenses'
import { useDateStore } from '../../store/date-store'
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber'
import { IconChartHistogram } from '@tabler/icons-react'
import {
  subWeeks, subMonths, subQuarters,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, format,
} from 'date-fns'

type ComparePeriod = 'prev-week' | 'prev-month' | 'prev-quarter'

const revenueChartConfig = {
  current: { label: 'Revenue', color: '#7DD3FC' },
} satisfies ChartConfig

interface RevenuePoint {
  month?: string
  date?: string
  revenue: number
}

export default function RevenueWidget() {
  const { current } = useDateStore()
  const [compareMode, setCompareMode] = useState(false)
  const [comparePeriod, setComparePeriod] = useState<ComparePeriod>('prev-month')

  const dateParams = { dateFrom: current.from, dateTo: current.to }

  const compDateParams = useMemo(() => {
    if (!compareMode) return undefined
    const now = new Date()
    switch (comparePeriod) {
      case 'prev-week': {
        const s = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
        const e = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
        return { dateFrom: format(s, 'yyyy-MM-dd'), dateTo: format(e, 'yyyy-MM-dd') }
      }
      case 'prev-month': {
        const s = startOfMonth(subMonths(now, 1))
        const e = endOfMonth(subMonths(now, 1))
        return { dateFrom: format(s, 'yyyy-MM-dd'), dateTo: format(e, 'yyyy-MM-dd') }
      }
      case 'prev-quarter': {
        const s = startOfQuarter(subQuarters(now, 1))
        const e = endOfQuarter(subQuarters(now, 1))
        return { dateFrom: format(s, 'yyyy-MM-dd'), dateTo: format(e, 'yyyy-MM-dd') }
      }
    }
  }, [compareMode, comparePeriod])

  const { data: revenueData, isLoading } = useRevenueChart(dateParams)
  const { data: compRevenueData } = useRevenueChart(compareMode ? compDateParams : undefined)
  const { data: financeSummary } = useFinanceSummary(dateParams)

  const totalRevenue = useMemo(() => {
    if (!financeSummary?.totalRevenue) return 0
    return financeSummary.totalRevenue
  }, [financeSummary])

  const chartData = useMemo(() => {
    if (!revenueData || !Array.isArray(revenueData)) return []
    return revenueData.map((d: RevenuePoint) => ({
      label: d.month || d.date || '',
      current: d.revenue,
    }))
  }, [revenueData])

  const compChartData = useMemo(() => {
    if (!compareMode || !compRevenueData || !Array.isArray(compRevenueData)) return []
    return compRevenueData.map((d: RevenuePoint) => ({
      label: d.month || d.date || '',
      current: d.revenue,
    }))
  }, [compRevenueData, compareMode])

  const sharedMax = useMemo(() => {
    if (!compareMode || compChartData.length === 0) return undefined
    const currentMax = Math.max(...chartData.map(d => d.current ?? 0), 0)
    const prevMax = Math.max(...compChartData.map(d => d.current ?? 0), 0)
    return Math.ceil(Math.max(currentMax, prevMax) * 1.1)
  }, [compareMode, chartData, compChartData])

  const animatedRevenue = useAnimatedNumber(totalRevenue)

  if (isLoading) return <div className="h-full rounded-xl bg-muted/50 animate-pulse" />

  const renderChart = (data: { label: string; current: number }[], label: string, opacity: number = 1) => (
    <div className="flex flex-col min-h-0 flex-1">
      {compareMode && (
        <div className="flex items-center gap-1.5 px-1 pb-2">
          <div className="w-2 h-2 rounded-full" style={{ background: '#7DD3FC', opacity }} />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
            {label}
          </span>
        </div>
      )}
      <div className="flex-1 min-h-0">
        {data.length > 0 ? (
          <ChartContainer config={revenueChartConfig} className="h-full w-full">
            <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id={`revGrad-${label}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-current)" stopOpacity={0.5 * opacity} />
                  <stop offset="95%" stopColor="var(--color-current)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border) / 0.2)" strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                domain={compareMode && sharedMax ? [0, sharedMax] : undefined}
              />
              <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="2 2" />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="current"
                stroke="var(--color-current)"
                fill={`url(#revGrad-${label})`}
                strokeWidth={3}
                dot={{ r: 3, fill: 'var(--color-current)', strokeWidth: 0 }}
                activeDot={{ r: 5, fill: 'var(--color-current)', strokeWidth: 2, stroke: 'hsl(var(--background))' }}
                opacity={opacity}
                isAnimationActive={true}
                animationDuration={600}
              />
            </ComposedChart>
          </ChartContainer>
        ) : (
          <div className="h-full w-full rounded-lg bg-card border border-border animate-pulse" />
        )}
      </div>
    </div>
  )

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Revenue Overview</p>
          <span className="text-2xl font-bold text-foreground font-mono tabular-nums">
            ${Math.round(animatedRevenue).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Toggle
            pressed={compareMode}
            onPressedChange={setCompareMode}
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs gap-1 data-[state=on]:bg-[#7dd3fc]/15 data-[state=on]:text-[#7dd3fc] data-[state=on]:border-[#7dd3fc]/30"
          >
            <IconChartHistogram size={14} />
            Compare
          </Toggle>
          {compareMode && (
            <Select value={comparePeriod} onValueChange={(v) => setComparePeriod(v as ComparePeriod)}>
              <SelectTrigger className="h-7 w-[130px] text-xs bg-card border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="min-w-[130px] bg-popover/95 backdrop-blur-xl border-border shadow-xl">
                <SelectItem value="prev-week" className="text-xs">vs Last Week</SelectItem>
                <SelectItem value="prev-month" className="text-xs">vs Last Month</SelectItem>
                <SelectItem value="prev-quarter" className="text-xs">vs Last Quarter</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0 flex flex-col">
        <AnimatePresence mode="wait">
          {compareMode ? (
            <motion.div
              key="compare"
              className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            >
              {renderChart(chartData, 'Current Period', 1)}
              {renderChart(compChartData, 'Previous Period', 0.7)}
            </motion.div>
          ) : (
            <motion.div
              key="single"
              className="flex-1 min-h-0 flex flex-col"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -4 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            >
              {renderChart(chartData, 'Revenue', 1)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
