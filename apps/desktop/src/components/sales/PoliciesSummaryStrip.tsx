import { useMemo } from 'react'
import { IconShieldDollar, IconCash, IconChartDonut } from '@tabler/icons-react'
import { AreaChart, Area, PieChart, Pie, Cell } from 'recharts'
import { Card } from '@/components/ui/card'
import { ChartContainer } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import type { Sale } from '../../types/portal'
import { getAnnualizedPremium } from '../../lib/premium'
import { fmt$ } from '../charts/chart-constants'

interface PoliciesSummaryStripProps {
  sales: Sale[]
  isLoading?: boolean
}

const STATUS_COLORS: Record<string, string> = {
  submitted: '#f59e0b',
  approved: '#3b82f6',
  issued: '#22c55e',
  paid: '#22c55e',
  active: '#22c55e',
  placed: '#22c55e',
  cancelled: '#ef4444',
  unknown: '#71717a',
}

const STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  approved: 'Approved',
  issued: 'Issued',
  paid: 'Paid',
  active: 'Active',
  placed: 'Placed',
  cancelled: 'Cancelled',
  unknown: 'Unknown',
}

function SummaryCard({
  label,
  value,
  icon,
  color,
  sparkData,
}: {
  label: string
  value: string
  icon: React.ReactNode
  color: string
  sparkData: { v: number }[]
}) {
  const sparkConfig = { v: { label, color } } satisfies ChartConfig
  const sparkId = `policies-summary-${label.replace(/\s/g, '')}`

  return (
    <Card className="bg-card/50 backdrop-blur-sm border border-border/50 relative overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-foreground">{value}</p>
          </div>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}15`, color }}
          >
            {icon}
          </div>
        </div>
        {sparkData.length > 1 && (
          <div className="mt-2 h-[32px]">
            <ChartContainer config={sparkConfig} className="h-[32px] w-full">
              <AreaChart data={sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={sparkId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={color}
                  fill={`url(#${sparkId})`}
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

export default function PoliciesSummaryStrip({ sales, isLoading }: PoliciesSummaryStripProps) {
  const monthlyData = useMemo(() => {
    const now = new Date()
    const months: { month: string; face: number; premium: number }[] = []
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const monthSales = sales.filter((s) => (s.createdAt || s.submittedAt)?.startsWith(key))
      const face = monthSales.reduce((sum, s) => sum + (s.faceAmount ?? 0), 0)
      const premium = monthSales.reduce((sum, s) => sum + getAnnualizedPremium(s), 0)
      months.push({ month: key, face, premium })
    }
    return months
  }, [sales])

  const totalFace = useMemo(
    () => sales.reduce((sum, p) => sum + (p.faceAmount ?? 0), 0),
    [sales],
  )
  const totalAP = useMemo(
    () => sales.reduce((sum, p) => sum + getAnnualizedPremium(p), 0),
    [sales],
  )

  const statusCounts = useMemo(() => {
    return sales.reduce<Record<string, number>>((acc, p) => {
      const k = (p.status ?? 'unknown').toLowerCase()
      acc[k] = (acc[k] ?? 0) + 1
      return acc
    }, {})
  }, [sales])

  const statusEntries = useMemo(
    () =>
      Object.entries(statusCounts).map(([name, value]) => ({
        name,
        value,
        fill: STATUS_COLORS[name] ?? STATUS_COLORS.unknown,
      })),
    [statusCounts],
  )

  const statusChartConfig = useMemo<ChartConfig>(() => {
    const cfg: ChartConfig = {}
    for (const name of Object.keys(statusCounts)) {
      cfg[name] = {
        label: STATUS_LABELS[name] ?? name,
        color: STATUS_COLORS[name] ?? STATUS_COLORS.unknown,
      }
    }
    return cfg
  }, [statusCounts])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <SummaryCard
        label="Total Face Amount"
        value={fmt$(totalFace)}
        icon={<IconShieldDollar size={20} />}
        color="#7DD3FC"
        sparkData={monthlyData.map((m) => ({ v: m.face }))}
      />
      <SummaryCard
        label="Total Premium (annualized)"
        value={fmt$(totalAP)}
        icon={<IconCash size={20} />}
        color="#DEFF9A"
        sparkData={monthlyData.map((m) => ({ v: m.premium }))}
      />
      <Card className="bg-card/50 backdrop-blur-sm border border-border/50 relative overflow-hidden">
        <div className="p-4">
          <div className="flex items-start justify-between">
            <p className="text-[11px] text-muted-foreground">By Status</p>
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: '#a855f715', color: '#a855f7' }}
            >
              <IconChartDonut size={20} />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-4">
            <div className="h-24 w-24 shrink-0">
              {statusEntries.length > 0 ? (
                <ChartContainer config={statusChartConfig} className="h-24 w-24 aspect-square">
                  <PieChart>
                    <Pie
                      data={statusEntries}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={28}
                      outerRadius={48}
                      strokeWidth={0}
                    >
                      {statusEntries.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              ) : (
                <div className="h-24 w-24 rounded-full border border-dashed border-border/50" />
              )}
            </div>
            <ul className="flex-1 space-y-1 text-xs">
              {statusEntries.length === 0 ? (
                <li className="text-muted-foreground">No data</li>
              ) : (
                statusEntries.map((entry) => (
                  <li key={entry.name} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: entry.fill }}
                      />
                      <span className="capitalize text-foreground">
                        {STATUS_LABELS[entry.name] ?? entry.name}
                      </span>
                    </span>
                    <span className="font-medium text-muted-foreground">{entry.value}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  )
}
