import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'
import { motion } from 'framer-motion'
import { IconClock, IconActivity, IconChartBar } from '@tabler/icons-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { AgentActivityData } from '../../types/portal'

const chartConfig = {
  hours: { label: 'Hours', color: '#7DD3FC' },
} satisfies ChartConfig

interface Props {
  data: AgentActivityData | null
  compact?: boolean
}

export function ActivityCard({ data, compact = false }: Props) {
  const dailyData = compact ? (data?.daily ?? []).slice(-7) : (data?.daily ?? []).slice(-14)

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className={compact ? 'px-4 py-3' : undefined}>
          <CardTitle className="flex items-center gap-2 text-sm">
            <IconActivity size={16} className="text-lime-400" />
            Activity
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'px-4 pb-4 pt-0' : undefined}>
          <div className="space-y-4">
            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2">
              <MetricItem
                icon={<IconClock size={14} className="text-lime-400" />}
                label="Today"
                value={`${(data?.today.hoursActive ?? 0).toFixed(1)}h`}
              />
              <MetricItem
                icon={<IconChartBar size={14} className="text-blue-400" />}
                label="This Week"
                value={`${(data?.thisWeek.hoursActive ?? 0).toFixed(1)}h`}
              />
              <MetricItem
                icon={<IconActivity size={14} className="text-amber-400" />}
                label="Avg Daily"
                value={`${(data?.thisWeek.avgDaily ?? 0).toFixed(1)}h`}
              />
            </div>

            {/* Daily Hours Chart */}
            {dailyData.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Daily Hours
                </h4>
                <div className={compact ? 'h-28' : 'h-40'}>
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <BarChart data={dailyData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: string) => v.slice(5)}
                      />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="hours" name="Hours" radius={[4, 4, 0, 0]}>
                        {dailyData.map((_: unknown, i: number) => (
                          <Cell key={i} fill="var(--color-hours)" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>
            )}

            {!data && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                <IconActivity size={20} className="mx-auto mb-2 text-muted-foreground/30" />
                No activity data available
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
