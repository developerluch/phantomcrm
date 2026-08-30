import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'
import { motion } from 'framer-motion'
import { IconCalendarEvent, IconCalendarCheck, IconPercentage } from '@tabler/icons-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import type { AgentAppointmentData } from '../../types/portal'

const chartConfig = {
  booked: { label: 'Booked', color: '#3b82f6' },
  run: { label: 'Completed', color: '#7DD3FC' },
} satisfies ChartConfig

interface Props {
  data: AgentAppointmentData | null
  compact?: boolean
}

export function AppointmentsCard({ data, compact = false }: Props) {
  const weeklyData = data?.weekly ?? []

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className={compact ? 'px-4 py-3' : undefined}>
          <CardTitle className="flex items-center gap-2 text-sm">
            <IconCalendarEvent size={16} className="text-blue-400" />
            Appointments
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'px-4 pb-4 pt-0' : undefined}>
          <div className="space-y-4">
            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2">
              <MetricItem
                icon={<IconCalendarEvent size={14} className="text-blue-400" />}
                label="Booked"
                value={String(data?.thisWeek.booked ?? 0)}
              />
              <MetricItem
                icon={<IconCalendarCheck size={14} className="text-emerald-400" />}
                label="Completed"
                value={String(data?.thisWeek.run ?? 0)}
              />
              <MetricItem
                icon={<IconPercentage size={14} className="text-amber-400" />}
                label="Show Rate"
                value={`${data?.thisWeek.showRate ?? 0}%`}
              />
            </div>

            {/* Weekly Trend Chart */}
            {weeklyData.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Weekly Trend
                </h4>
                <div className={compact ? 'h-28' : 'h-40'}>
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <BarChart data={weeklyData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
                      <XAxis dataKey="week" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="booked" name="Booked" radius={[4, 4, 0, 0]}>
                        {weeklyData.map((_: unknown, i: number) => (
                          <Cell key={i} fill="var(--color-booked)" />
                        ))}
                      </Bar>
                      <Bar dataKey="run" name="Completed" radius={[4, 4, 0, 0]}>
                        {weeklyData.map((_: unknown, i: number) => (
                          <Cell key={i} fill="var(--color-run)" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>
            )}

            {!data && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                <IconCalendarEvent size={20} className="mx-auto mb-2 text-muted-foreground/30" />
                No appointment data available
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
