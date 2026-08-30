import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'
import { motion } from 'framer-motion'
import { IconUsers, IconUserCheck, IconPercentage } from '@tabler/icons-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { timeAgo } from './analytics-helpers'
import type { AgentRecruitsData } from '../../types/portal'
import { RECRUIT_STAGE_LABELS } from '../../types/portal'
import type { RecruitStage } from '../../types/portal'

interface Props {
  data: AgentRecruitsData | null
  compact?: boolean
}

export function RecruitingCard({ data, compact = false }: Props) {
  const chartConfig: ChartConfig = {}
  const byStage = data?.byStage ?? []
  for (const s of byStage) {
    chartConfig[s.stage] = { label: (RECRUIT_STAGE_LABELS as Record<string, string>)[s.stage] ?? s.stage, color: s.color }
  }

  const recruits = data?.recruits ?? []
  const displayRecruits = recruits.slice(0, compact ? 5 : 10)

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className={compact ? 'px-4 py-3' : undefined}>
          <CardTitle className="flex items-center gap-2 text-sm">
            <IconUsers size={16} className="text-purple-400" />
            Recruiting
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'px-4 pb-4 pt-0' : undefined}>
          <div className="space-y-4">
            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2">
              <MetricItem
                icon={<IconUsers size={14} className="text-purple-400" />}
                label="Total"
                value={String(data?.total ?? 0)}
              />
              <MetricItem
                icon={<IconUserCheck size={14} className="text-emerald-400" />}
                label="Active"
                value={String(data?.active ?? 0)}
              />
              <MetricItem
                icon={<IconPercentage size={14} className="text-blue-400" />}
                label="Conversion"
                value={`${data?.conversionRate ?? 0}%`}
              />
            </div>

            {/* Stage Distribution Chart (full mode only) */}
            {!compact && byStage.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Pipeline Distribution
                </h4>
                <div className="h-40">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <BarChart
                      data={byStage}
                      layout="vertical"
                      margin={{ top: 5, right: 10, bottom: 0, left: 0 }}
                      barCategoryGap="20%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="stage"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                        axisLine={false}
                        tickLine={false}
                        width={80}
                        tickFormatter={(v: string) => (RECRUIT_STAGE_LABELS as Record<string, string>)[v] ?? v}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" name="Recruits" radius={[0, 4, 4, 0]}>
                        {byStage.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>
            )}

            {/* Recruit List */}
            {displayRecruits.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <h4 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Recruited Agents ({recruits.length})
                </h4>
                <div className="space-y-1.5">
                  {displayRecruits.map((recruit) => {
                    const stageColor = (byStage.find((s) => s.stage === recruit.stage)?.color) ?? '#6b7280'
                    const stageLabel = (RECRUIT_STAGE_LABELS as Record<string, string>)[recruit.stage as RecruitStage] ?? recruit.stage
                    return (
                      <div key={recruit.id} className="flex items-center justify-between rounded-md bg-card/50 px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold"
                            style={{
                              background: `color-mix(in srgb, ${stageColor} 20%, hsl(var(--card)))`,
                              color: stageColor,
                            }}
                          >
                            {recruit.firstName[0]}{recruit.lastName[0]}
                          </div>
                          <div>
                            <div className="text-xs font-medium text-foreground">
                              {recruit.firstName} {recruit.lastName}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {recruit.source ?? 'No source'} · {timeAgo(recruit.createdAt)}
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          style={{
                            background: `color-mix(in srgb, ${stageColor} 18%, transparent)`,
                            color: stageColor,
                            borderColor: `color-mix(in srgb, ${stageColor} 30%, transparent)`,
                          }}
                        >
                          {stageLabel}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {!data && (
              <div className="py-6 text-center text-xs text-muted-foreground">
                <IconUsers size={20} className="mx-auto mb-2 text-muted-foreground/30" />
                No recruiting data available
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
