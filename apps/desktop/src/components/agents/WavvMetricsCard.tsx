import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'
import { motion } from 'framer-motion'
import { IconPhone, IconPlugConnected, IconClock } from '@tabler/icons-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { formatMinutes } from './analytics-helpers'
import type { AgentWavvData } from '../../types/portal'

const chartConfig = {
  dials: { label: 'Dials', color: '#3b82f6' },
  connections: { label: 'Connections', color: '#10b981' },
} satisfies ChartConfig

interface Props {
  data: AgentWavvData | null
  compact?: boolean
}

export function WavvMetricsCard({ data, compact = false }: Props) {
  const chartData = data?.daily ?? []
  const dials = data?.thisWeek.dials ?? 0
  const connections = data?.thisWeek.connections ?? 0
  const connectionRate = dials > 0 ? (connections / dials) * 100 : 0

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }}>
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className={compact ? 'px-4 py-3' : undefined}>
          <CardTitle className="flex items-center gap-2 text-sm">
            <IconPhone size={16} className="text-blue-400" />
            WAVV Dialer
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'px-4 pb-4 pt-0' : undefined}>
          <div className="space-y-4">
            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2">
              <MetricItem
                icon={<IconPhone size={14} className="text-blue-400" />}
                label="Dials"
                value={String(dials)}
              />
              <MetricItem
                icon={<IconPlugConnected size={14} className="text-emerald-400" />}
                label="Connections"
                value={String(connections)}
              />
              <MetricItem
                icon={<IconClock size={14} className="text-amber-400" />}
                label="Talk Time"
                value={formatMinutes(data?.thisWeek.talkMinutes ?? 0)}
              />
            </div>

            {/* Connection Rate */}
            {dials > 0 && (
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Connection Rate</span>
                  <span className="font-semibold text-foreground">{connectionRate.toFixed(1)}%</span>
                </div>
                <Progress value={Math.min(connectionRate, 100)} className="mt-2 h-1.5" indicatorClassName="bg-emerald-500" />
              </div>
            )}

            {/* 7-Day Chart */}
            {chartData.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  7-Day Activity
                </h4>
                <div className={compact ? 'h-28' : 'h-40'}>
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                      <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="dials" name="Dials" radius={[4, 4, 0, 0]}>
                        {chartData.map((_: unknown, i: number) => (
                          <Cell key={i} fill="var(--color-dials)" />
                        ))}
                      </Bar>
                      <Bar dataKey="connections" name="Connections" radius={[4, 4, 0, 0]}>
                        {chartData.map((_: unknown, i: number) => (
                          <Cell key={i} fill="var(--color-connections)" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>
            )}

            {!data && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                <IconPhone size={20} className="mx-auto mb-2 text-muted-foreground/30" />
                No WAVV data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function MetricItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/50 p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
      <div className="text-sm font-semibold text-foreground">{value}</div>
    </div>
  )
}
