import { useMemo, useId } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AreaChart, Area } from 'recharts'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { IconTrendingUp, IconTrendingDown } from '@tabler/icons-react'
import type { ReactNode } from 'react'

interface Props {
  label: string
  value: string | number
  icon: ReactNode
  color?: string
  subtitle?: string
  className?: string
  trend?: number
  sparklineData?: number[]
}

export default function MetricCard({
  label, value, icon, color = '#3b82f6', subtitle, className, trend, sparklineData,
}: Props) {
  const gradientId = useId()

  const sparkData = useMemo(() => {
    if (!sparklineData || sparklineData.length < 2) return null
    return sparklineData.map((v) => ({ v }))
  }, [sparklineData])

  return (
    <Card
      className={cn('relative overflow-hidden cursor-default h-full', className)}
      style={{
        background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--muted)))',
        borderColor: `color-mix(in srgb, ${color} 18%, hsl(var(--border)))`,
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px opacity-60"
        style={{ background: `linear-gradient(90deg, transparent 10%, ${color}, transparent 90%)` }}
      />

      <div className="relative px-3 py-2 flex items-center gap-3 h-full z-10">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: `color-mix(in srgb, ${color} 10%, transparent)`,
            color,
          }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-bold tabular-nums tracking-tight leading-tight" style={{ color }}>
            {value}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground font-medium truncate">{label}</span>
            {trend !== undefined && trend !== 0 && (
              <span className={cn('flex items-center gap-0.5 text-[9px] font-semibold', trend > 0 ? 'text-emerald-400' : 'text-red-400')}>
                {trend > 0 ? <IconTrendingUp size={10} /> : <IconTrendingDown size={10} />}
                {Math.abs(trend).toFixed(1)}%
              </span>
            )}
          </div>
          {subtitle && <div className="text-[10px] text-muted-foreground/60">{subtitle}</div>}
        </div>
      </div>

      {/* Sparkline at bottom */}
      {sparkData && (
        <div className="absolute bottom-0 left-0 right-0 h-10 z-0">
          <ChartContainer config={{ v: { label: 'Value', color: color } } satisfies ChartConfig} className="h-full w-full">
            <AreaChart data={sparkData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={1.5}
                fill={`url(#${gradientId})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      )}
    </Card>
  )
}
