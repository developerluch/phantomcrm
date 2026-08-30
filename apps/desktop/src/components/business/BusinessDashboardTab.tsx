import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import {
  IconFileText,
  IconCash,
  IconCircleCheck,
  IconCalendarStats,
  IconTrendingUp,
  IconTrendingDown,
} from '@tabler/icons-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import type { Sale } from '@/types/portal'
import { CHART_COLORS, AXIS_TICK, GRID_PROPS, fmt$, fmtCompact$ } from '../charts/chart-constants'
import { containerVariants, itemVariants } from '@/lib/motion'

interface Props {
  sales: Sale[]
  isLoading: boolean
}

const ACTIVE_STATUSES = ['issued', 'paid', 'placed', 'active']

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  issued: '#3b82f6',
  pending: '#f59e0b',
  cancelled: '#ef4444',
}

const apTimeConfig = {
  premium: { label: 'Annual Premium', color: '#7DD3FC' },
} satisfies ChartConfig

const statusConfig = {
  active: { label: 'Active/Placed', color: '#22c55e' },
  pending: { label: 'Pending', color: '#f59e0b' },
  cancelled: { label: 'Cancelled', color: '#ef4444' },
  issued: { label: 'Issued', color: '#3b82f6' },
} satisfies ChartConfig

const carrierConfig = {
  premium: { label: 'Annual Premium', color: '#7DD3FC' },
} satisfies ChartConfig

function getStatusGroup(status: string): string {
  const s = status.toLowerCase()
  if (['issued'].includes(s)) return 'issued'
  if (['paid', 'placed', 'active'].includes(s)) return 'active'
  if (['submitted', 'approved', 'applied', 'pending'].includes(s)) return 'pending'
  return 'cancelled'
}

export default function BusinessDashboardTab({ sales, isLoading }: Props) {
  const totalPolicies = sales.length
  const totalAP = useMemo(() => sales.reduce((sum, s) => sum + s.premium, 0), [sales])
  const activePolicies = useMemo(
    () => sales.filter((s) => ACTIVE_STATUSES.includes(s.status.toLowerCase())).length,
    [sales],
  )
  const monthlyPremium = totalAP / 12

  const monthlyData = useMemo(() => {
    const now = new Date()
    const months: { month: string; premium: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-US', { month: 'short' })
      const total = sales
        .filter((s) => s.submittedAt?.startsWith(key))
        .reduce((sum, s) => sum + s.premium, 0)
      months.push({ month: label, premium: total })
    }
    return months
  }, [sales])

  const sparklineValues = useMemo(() => monthlyData.map((m) => m.premium), [monthlyData])
  const trend = useMemo(() => {
    if (sparklineValues.length < 2) return undefined
    const prev = sparklineValues[sparklineValues.length - 2]
    const curr = sparklineValues[sparklineValues.length - 1]
    if (prev === 0) return undefined
    return ((curr - prev) / Math.abs(prev)) * 100
  }, [sparklineValues])

  const statusData = useMemo(() => {
    const grouped: Record<string, number> = {}
    for (const s of sales) {
      const group = getStatusGroup(s.status)
      grouped[group] = (grouped[group] ?? 0) + 1
    }
    return Object.entries(grouped).map(([name, value]) => ({ name, value }))
  }, [sales])

  const carrierData = useMemo(() => {
    const grouped: Record<string, number> = {}
    for (const s of sales) {
      const carrier = s.carrier || 'Unknown'
      grouped[carrier] = (grouped[carrier] ?? 0) + s.premium
    }
    return Object.entries(grouped)
      .map(([name, premium]) => ({ name, premium }))
      .sort((a, b) => b.premium - a.premium)
      .slice(0, 8)
  }, [sales])

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-32 rounded-xl bg-card/30 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* KPI Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Total Policies"
          value={String(totalPolicies)}
          icon={<IconFileText size={20} />}
          color="#3b82f6"
          sparkData={monthlyData.map((m) => ({ v: m.premium }))}
        />
        <KPICard
          label="Total AP"
          value={fmt$(totalAP)}
          icon={<IconCash size={20} />}
          color="#7DD3FC"
          sparkData={monthlyData.map((m) => ({ v: m.premium }))}
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
      </motion.div>

      {/* Charts */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* AP Over Time */}
        <Card className="bg-card/50 backdrop-blur-sm border border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">AP Over Time</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Status Donut */}
        <Card className="bg-card/50 backdrop-blur-sm border border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={statusConfig} className="h-[220px] w-full">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  strokeWidth={2}
                  stroke="hsl(var(--background))"
                >
                  {statusData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={STATUS_COLORS[entry.name] ?? CHART_COLORS.blue}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {statusData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-[10px]">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[entry.name] ?? CHART_COLORS.blue }}
                  />
                  <span className="text-muted-foreground capitalize">{entry.name}</span>
                  <span className="text-foreground font-medium">{entry.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Carrier Distribution */}
        <Card className="bg-card/50 backdrop-blur-sm border border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Carrier Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={carrierConfig} className="h-[220px] w-full">
              <BarChart
                data={carrierData}
                layout="vertical"
                margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              >
                <CartesianGrid {...GRID_PROPS} horizontal={false} />
                <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} tickFormatter={fmtCompact$} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={AXIS_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={90}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="premium" fill="var(--color-premium)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

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
      <CardContent className="p-4">
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
      </CardContent>
    </Card>
  )
}
