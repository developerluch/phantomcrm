import { BarChart, Bar, XAxis, YAxis, Cell } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { FunnelStage } from '../types/agent'
import { STAGE_COLORS, STAGE_NAMES } from '../types/agent'
import { useMemo } from 'react'

interface Props {
  stages: FunnelStage[]
  onStageClick?: (stage: number) => void
}

export default function FunnelChart({ stages, onStageClick }: Props) {
  const chartConfig = useMemo<ChartConfig>(() => {
    const config: ChartConfig = {
      count: { label: 'Agents' },
    }
    for (const s of stages) {
      config[`stage-${s.stage}`] = {
        label: s.name || STAGE_NAMES[s.stage] || `Stage ${s.stage}`,
        color: STAGE_COLORS[s.stage] || '#3b82f6',
      }
    }
    return config
  }, [stages])

  return (
    <div className="w-full h-full">
      <ChartContainer config={chartConfig} className="h-full w-full">
        <BarChart data={stages} margin={{ top: 5, right: 10, bottom: 0, left: -15 }} barCategoryGap="35%">
          <defs>
            {stages.map((s) => {
              const c = STAGE_COLORS[s.stage] || '#3b82f6'
              return (
                <linearGradient key={s.stage} id={`grad-${s.stage}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={c} stopOpacity={0.3} />
                </linearGradient>
              )
            })}
          </defs>
          <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <ChartTooltip
            content={<ChartTooltipContent nameKey="name" />}
            cursor={{ fill: 'hsl(var(--foreground) / 0.03)', radius: 6 }}
          />
          <Bar dataKey="count" radius={[6, 6, 2, 2]} cursor="pointer" onClick={(d) => onStageClick?.(d.stage)}>
            {stages.map((s) => <Cell key={s.stage} fill={`url(#grad-${s.stage})`} />)}
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  )
}
