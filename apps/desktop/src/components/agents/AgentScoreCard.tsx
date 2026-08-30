import { useMemo } from 'react'
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts'
import { motion } from 'framer-motion'
import { IconTargetArrow } from '@tabler/icons-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  ChartContainer,
  type ChartConfig,
} from '@/components/ui/chart'
import type { SaleStats } from '../../types/portal'
import type { AgentWavvData, AgentAppointmentData, AgentActivityData, AgentRecruitsData } from '../../types/portal'

const chartConfig = {
  score: { label: 'Score', color: '#7DD3FC' },
} satisfies ChartConfig

interface Props {
  salesStats: SaleStats | null
  wavvData: AgentWavvData | null
  appointmentData: AgentAppointmentData | null
  activityData: AgentActivityData | null
  recruitsData: AgentRecruitsData | null
  compact?: boolean
}

function clamp(val: number): number {
  return Math.max(0, Math.min(100, Math.round(val)))
}

export function AgentScoreCard({
  salesStats,
  wavvData,
  appointmentData,
  activityData,
  recruitsData,
  compact = false,
}: Props) {
  const scores = useMemo(() => {
    const sales = clamp(((salesStats?.thisMonth.premium ?? 0) / 10000) * 100)
    const dialing = clamp(((wavvData?.thisWeek.dials ?? 0) / 500) * 100)
    const appointments = clamp(((appointmentData?.thisWeek.run ?? 0) / 5) * 100)
    const recruiting = clamp(((recruitsData?.active ?? 0) / 3) * 100)
    const activity = clamp(((activityData?.thisWeek.avgDaily ?? 0) / 6) * 100)

    const overall = clamp(
      sales * 0.3 + dialing * 0.25 + appointments * 0.2 + recruiting * 0.15 + activity * 0.1
    )

    return { overall, sales, dialing, appointments, recruiting, activity }
  }, [salesStats, wavvData, appointmentData, activityData, recruitsData])

  const scoreColor =
    scores.overall >= 80 ? '#22c55e' : scores.overall >= 50 ? '#f59e0b' : '#ef4444'

  const radialData = [{ name: 'score', value: scores.overall, fill: scoreColor }]

  const categories = [
    { label: 'Sales', score: scores.sales, weight: '30%', indicatorClass: 'bg-[#7DD3FC]' },
    { label: 'Dialing', score: scores.dialing, weight: '25%', indicatorClass: 'bg-blue-500' },
    { label: 'Appointments', score: scores.appointments, weight: '20%', indicatorClass: 'bg-amber-500' },
    { label: 'Recruiting', score: scores.recruiting, weight: '15%', indicatorClass: 'bg-purple-500' },
    { label: 'Activity', score: scores.activity, weight: '10%', indicatorClass: 'bg-cyan-500' },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className={compact ? 'px-4 py-3' : undefined}>
          <CardTitle className="flex items-center gap-2 text-sm">
            <IconTargetArrow size={16} className="text-lime-400" />
            Agent Score
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'px-4 pb-4 pt-0' : undefined}>
          {compact ? (
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 shrink-0">
                <ChartContainer config={chartConfig} className="h-full w-full">
                  <RadialBarChart
                    innerRadius="70%"
                    outerRadius="100%"
                    data={radialData}
                    startAngle={90}
                    endAngle={-270}
                    barSize={6}
                  >
                    <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                    <RadialBar dataKey="value" cornerRadius={3} background={{ fill: 'hsl(var(--muted))' }} />
                  </RadialBarChart>
                </ChartContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-base font-bold" style={{ color: scoreColor }}>
                    {scores.overall}
                  </span>
                </div>
              </div>
              <div className="flex-1 space-y-1.5">
                {categories.map((cat) => (
                  <div key={cat.label} className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">{cat.label}</span>
                    <span className="font-medium text-foreground">{cat.score}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Radial Chart */}
              <div className="flex justify-center">
                <div className="relative h-32 w-32">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <RadialBarChart
                      innerRadius="70%"
                      outerRadius="100%"
                      data={radialData}
                      startAngle={90}
                      endAngle={-270}
                      barSize={10}
                    >
                      <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                      <RadialBar dataKey="value" cornerRadius={5} background={{ fill: 'hsl(var(--muted))' }} />
                    </RadialBarChart>
                  </ChartContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold" style={{ color: scoreColor }}>
                      {scores.overall}
                    </span>
                    <span className="text-[10px] text-muted-foreground">Overall</span>
                  </div>
                </div>
              </div>

              {/* Category Breakdown */}
              <div className="space-y-2.5">
                {categories.map((cat) => (
                  <div key={cat.label}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">
                        {cat.label} <span className="text-muted-foreground/50">({cat.weight})</span>
                      </span>
                      <span className="font-medium text-foreground">{cat.score}</span>
                    </div>
                    <Progress
                      value={cat.score}
                      className="h-1.5"
                      indicatorClassName={cat.indicatorClass}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
