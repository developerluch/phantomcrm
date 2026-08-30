import {
  AreaChart, Area,
  BarChart, Bar, Cell,
  LineChart, Line,
  XAxis, YAxis,
  CartesianGrid,
} from 'recharts'
import type { ReactNode } from 'react'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'

// ─── Types ──────────────────────────────────────────────────────

export type ChartType = 'area' | 'bar' | 'line'

export interface DatasetColumn {
  key: string
  label?: string
  color?: string
}

export interface MasterChartProps {
  /** Chart type */
  type: ChartType
  /** Data array — each item is a row with keys matching `columns` */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[]
  /** X-axis key from data */
  xKey: string
  /** Columns to plot (each becomes a series/bar/line) */
  columns: DatasetColumn[]
  /** Show grid lines */
  grid?: boolean
  /** Enable animation */
  animate?: boolean
  /** Y-axis tick formatter */
  yFormatter?: (value: number) => string
  /** Bar colors array (for single-column bar charts with per-bar colors) */
  barColors?: string[]
  /** Gradient fill for area charts */
  gradientId?: string
  /** Additional className on the outer wrapper */
  className?: string
}

// ─── Shared axis/grid config ────────────────────────────────────

const AXIS_TICK = { fill: 'hsl(var(--muted-foreground))', fontSize: 10 }

function SharedAxes({
  xKey, yFormatter, grid, children
}: {
  xKey: string
  yFormatter?: (v: number) => string
  grid?: boolean
  children: ReactNode
}) {
  return (
    <>
      {grid && (
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
      )}
      <XAxis
        dataKey={xKey}
        tick={AXIS_TICK}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        tick={AXIS_TICK}
        axisLine={false}
        tickLine={false}
        tickFormatter={yFormatter}
        width={40}
      />
      <ChartTooltip
        content={<ChartTooltipContent />}
        cursor={{ stroke: 'rgba(125, 211, 252, 0.15)', strokeWidth: 1 }}
      />
      {children}
    </>
  )
}

// ─── MasterChart ────────────────────────────────────────────────

const DEFAULT_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ef4444', '#ec4899']

export default function MasterChart({
  type,
  data,
  xKey,
  columns,
  grid = false,
  animate = true,
  yFormatter,
  barColors,
  gradientId,
  className,
}: MasterChartProps) {
  if (!data.length) return null

  const gId = gradientId || `grad-${columns[0]?.key || 'default'}`

  const chartConfig = columns.reduce<Record<string, { label: string; color: string }>>((acc, col, i) => {
    acc[col.key] = { label: col.label || col.key, color: col.color || DEFAULT_COLORS[i] }
    return acc
  }, {}) satisfies ChartConfig

  return (
    <div className={`w-full h-full ${className || ''}`}>
      <ChartContainer config={chartConfig} className="h-full w-full">
        {type === 'area' ? (
          <AreaChart data={data}>
            <defs>
              {columns.map((col, i) => (
                <linearGradient key={`${gId}-${i}`} id={`${gId}-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={col.color || DEFAULT_COLORS[i]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={col.color || DEFAULT_COLORS[i]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <SharedAxes xKey={xKey} yFormatter={yFormatter} grid={grid}>
              {columns.map((col, i) => (
                <Area
                  key={col.key}
                  type="monotone"
                  dataKey={col.key}
                  name={col.label || col.key}
                  stroke={col.color || DEFAULT_COLORS[i]}
                  fill={`url(#${gId}-${i})`}
                  strokeWidth={2}
                  isAnimationActive={animate}
                  dot={false}
                  activeDot={{
                    r: 4,
                    stroke: col.color || DEFAULT_COLORS[i],
                    strokeWidth: 2,
                    fill: 'hsl(var(--background))',
                  }}
                />
              ))}
            </SharedAxes>
          </AreaChart>
        ) : type === 'line' ? (
          <LineChart data={data}>
            <SharedAxes xKey={xKey} yFormatter={yFormatter} grid={grid}>
              {columns.map((col, i) => (
                <Line
                  key={col.key}
                  type="monotone"
                  dataKey={col.key}
                  name={col.label || col.key}
                  stroke={col.color || DEFAULT_COLORS[i]}
                  strokeWidth={2}
                  isAnimationActive={animate}
                  dot={false}
                  activeDot={{
                    r: 4,
                    stroke: col.color || DEFAULT_COLORS[i],
                    strokeWidth: 2,
                    fill: 'hsl(var(--background))',
                  }}
                />
              ))}
            </SharedAxes>
          </LineChart>
        ) : (
          <BarChart data={data}>
            <SharedAxes xKey={xKey} yFormatter={yFormatter} grid={grid}>
              {columns.map((col, i) => (
                <Bar
                  key={col.key}
                  dataKey={col.key}
                  name={col.label || col.key}
                  radius={[4, 4, 0, 0] as any}
                  isAnimationActive={animate}
                  fill={col.color || DEFAULT_COLORS[i]}
                >
                  {/* Per-bar colors if barColors provided (single series) */}
                  {barColors && data.map((_entry, j) => (
                    <Cell key={j} fill={barColors[j % barColors.length]} />
                  ))}
                </Bar>
              ))}
            </SharedAxes>
          </BarChart>
        )}
      </ChartContainer>
    </div>
  )
}
