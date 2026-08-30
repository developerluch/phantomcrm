import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AreaChart, Area,
  BarChart, Bar, Cell,
  LineChart, Line,
  XAxis, YAxis,
  CartesianGrid,
} from 'recharts'
import {
  IconChartBar,
  IconChartAreaLine,
  IconChartLine,
  IconChartHistogram,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { FunnelStage } from '../../types/agent'
import { STAGE_COLORS } from '../../types/agent'
import type { RevenueChartPoint, PipelineValueEntry } from '../../types/portal'

// ─── Types ──────────────────────────────────────────────────────

type ChartType = 'line' | 'bar' | 'area'
type DatasetKey = 'pipeline' | 'revenue' | 'stages'
type ComparePeriod = 'prev-week' | 'prev-month' | 'prev-quarter'

interface DatasetConfig {
  label: string
  xKey: string
  yKey: string
  yLabel: string
  yFormatter?: (v: number) => string
}

const DATASET_META: Record<DatasetKey, DatasetConfig> = {
  stages:   { label: 'Recruit Pipeline', xKey: 'name',  yKey: 'count',   yLabel: 'Agents' },
  revenue:  { label: 'Revenue (12 Mo)',  xKey: 'month', yKey: 'revenue', yLabel: 'Revenue', yFormatter: (v) => `$${(v / 1000).toFixed(0)}k` },
  pipeline: { label: 'Pipeline Dist.',   xKey: 'stage', yKey: 'count',   yLabel: 'Count' },
}

const DATASET_KEYS: DatasetKey[] = ['stages', 'revenue', 'pipeline']

const CHART_TYPES: { key: ChartType; icon: typeof IconChartBar; label: string }[] = [
  { key: 'line', icon: IconChartLine,     label: 'Line' },
  { key: 'bar',  icon: IconChartBar,      label: 'Bar' },
  { key: 'area', icon: IconChartAreaLine, label: 'Area' },
]

const DEFAULT_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ef4444', '#ec4899']
const PIPELINE_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#06b6d4', '#10b981', '#22c55e', '#ef4444']

// ─── Component ──────────────────────────────────────────────────

interface MasterChartWidgetProps {
  stages: FunnelStage[]
  revenue: RevenueChartPoint[]
  pipeline: PipelineValueEntry[]
  onStageClick?: (stage: number) => void
  prevStages?: FunnelStage[]
  prevRevenue?: RevenueChartPoint[]
  prevPipeline?: PipelineValueEntry[]
  onHeightChange?: (expanded: boolean) => void
}

export default function MasterChartWidget({ stages, revenue, pipeline, onStageClick, prevStages, prevRevenue, prevPipeline, onHeightChange }: MasterChartWidgetProps) {
  const [dataset, setDataset] = useState<DatasetKey>('stages')
  const [chartType, setChartType] = useState<ChartType>('line')
  const [compareMode, setCompareMode] = useState(false)
  const [comparePeriod, setComparePeriod] = useState<ComparePeriod>('prev-week')

  const meta = DATASET_META[dataset]

  // Resolve data for current dataset
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let data: any[] = []
  let perBarColors: string[] | undefined
  if (dataset === 'stages') {
    data = stages
    perBarColors = stages.map(s => STAGE_COLORS[s.stage] || '#3b82f6')
  } else if (dataset === 'revenue') {
    data = revenue
  } else {
    data = pipeline
    perBarColors = PIPELINE_COLORS
  }

  // Build previous period data array (separate, not merged)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prevData: any[] = useMemo(() => {
    if (!compareMode) return []
    if (dataset === 'stages' && prevStages) return prevStages
    if (dataset === 'revenue' && prevRevenue) return prevRevenue
    if (dataset === 'pipeline' && prevPipeline) return prevPipeline
    return []
  }, [compareMode, dataset, prevStages, prevRevenue, prevPipeline])

  // Shared Y-axis domain for comparison — both charts must use the same scale
  const sharedMax = useMemo(() => {
    if (!compareMode || prevData.length === 0) return undefined
    const currentMax = Math.max(...data.map(d => d[meta.yKey] ?? 0), 0)
    const prevMax = Math.max(...prevData.map(d => d[meta.yKey] ?? 0), 0)
    return Math.ceil(Math.max(currentMax, prevMax) * 1.1) // 10% headroom
  }, [compareMode, data, prevData, meta.yKey])

  const primaryColor = dataset === 'revenue' ? '#3b82f6' : DEFAULT_COLORS[0]
  const gradId = `mcw-grad-${dataset}`
  const prevGradId = `mcw-prev-grad-${dataset}`

  const chartConfig: ChartConfig = { [meta.yKey]: { label: meta.yLabel, color: primaryColor } }

  const AXIS_TICK = { fill: 'hsl(var(--muted-foreground))', fontSize: 10 }

  const handleCompareToggle = () => {
    const next = !compareMode
    setCompareMode(next)
    onHeightChange?.(next)
  }

  // ─── Render a single chart (reused for both current & previous) ───
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderSingleChart = (chartData: any[], label: string, colors: string[] | undefined, opacity: number = 1, gradientId: string = gradId) => (
    <div className="flex flex-col min-h-0 flex-1">
      {compareMode && (
        <div className="flex items-center gap-1.5 px-1 pb-2">
          <div className="w-2 h-2 rounded-full" style={{ background: primaryColor, opacity }} />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
            {label}
          </span>
        </div>
      )}
      <div className="flex-1 min-h-0">
        {chartData.length === 0 ? (
          <div className="h-full w-full rounded-lg bg-card border border-border animate-pulse" />
        ) : (
          <ChartContainer config={chartConfig} className="h-full w-full">
            {chartType === 'line' ? (
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border) / 0.3)" />
                <XAxis dataKey={meta.xKey} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={meta.yFormatter}
                  width={40}
                  domain={sharedMax ? [0, sharedMax] : undefined}
                />
                <ChartTooltip content={<ChartTooltipContent />} cursor={{ stroke: 'hsl(var(--accent) / 0.15)', strokeWidth: 1 }} />
                <Line
                  type="monotone"
                  dataKey={meta.yKey}
                  name={label}
                  stroke={primaryColor}
                  strokeWidth={2}
                  dot={{ r: 3, stroke: primaryColor, strokeWidth: 2, fill: 'hsl(var(--background))' }}
                  activeDot={{ r: 5, stroke: primaryColor, strokeWidth: 2, fill: 'hsl(var(--background))' }}
                  opacity={opacity}
                />
              </LineChart>
            ) : chartType === 'area' ? (
              <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primaryColor} stopOpacity={0.4 * opacity} />
                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="hsl(var(--border) / 0.3)" />
                <XAxis dataKey={meta.xKey} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={meta.yFormatter}
                  width={40}
                  domain={sharedMax ? [0, sharedMax] : undefined}
                />
                <ChartTooltip content={<ChartTooltipContent />} cursor={{ stroke: 'hsl(var(--accent) / 0.15)', strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey={meta.yKey}
                  name={label}
                  stroke={primaryColor}
                  fill={`url(#${gradientId})`}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, stroke: primaryColor, strokeWidth: 2, fill: 'hsl(var(--background))' }}
                  opacity={opacity}
                />
              </AreaChart>
            ) : (
              <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -10 }} barCategoryGap="25%">
                <CartesianGrid vertical={false} stroke="hsl(var(--border) / 0.3)" />
                <XAxis dataKey={meta.xKey} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis
                  tick={AXIS_TICK}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={meta.yFormatter}
                  width={40}
                  allowDecimals={false}
                  domain={sharedMax ? [0, sharedMax] : undefined}
                />
                <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: 'hsl(var(--foreground) / 0.03)' }} />
                <Bar
                  dataKey={meta.yKey}
                  name={label}
                  radius={[6, 6, 2, 2] as unknown as number}
                  cursor={dataset === 'stages' && opacity === 1 ? 'pointer' : undefined}
                  onClick={dataset === 'stages' && opacity === 1 ? (d: Record<string, unknown>) => onStageClick?.(d.stage as number) : undefined}
                  opacity={opacity}
                >
                  {colors
                    ? chartData.map((_: unknown, i: number) => (
                        <Cell key={i} fill={colors[i % colors.length]} opacity={opacity} />
                      ))
                    : chartData.map((_: unknown, i: number) => (
                        <Cell key={i} fill={primaryColor} opacity={opacity} />
                      ))
                  }
                </Bar>
              </BarChart>
            )}
          </ChartContainer>
        )}
      </div>
    </div>
  )

  return (
    <div className="h-full w-full flex flex-col">
      {/* Controls row */}
      <div className="flex-none flex items-center gap-2 pb-3">
        {/* Dataset selector */}
        <Select value={dataset} onValueChange={(v) => setDataset(v as DatasetKey)}>
          <SelectTrigger className="h-7 w-[140px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="min-w-[140px] w-[160px] bg-popover/95 backdrop-blur-xl border-border shadow-xl">
            {DATASET_KEYS.map((key) => (
              <SelectItem key={key} value={key} className="text-xs">{DATASET_META[key].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Divider */}
        <div className="w-px h-4 bg-border" />

        {/* Chart type toggle */}
        <div className="flex items-center gap-0.5">
          {CHART_TYPES.map(({ key, icon: Icon, label }) => (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <Button
                  variant={chartType === key ? 'default' : 'ghost'}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setChartType(key)}
                >
                  <Icon size={13} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-border" />

        {/* Compare toggle */}
        <Button
          variant={compareMode ? 'default' : 'ghost'}
          size="sm"
          className={`h-7 px-2.5 text-xs ${compareMode ? 'bg-[#7dd3fc]/15 text-[#7dd3fc] border border-[#7dd3fc]/30' : ''}`}
          onClick={handleCompareToggle}
        >
          <IconChartHistogram size={14} className="mr-1" />
          Compare
        </Button>

        {/* Period selector — only visible in compare mode */}
        {compareMode && (
          <Select value={comparePeriod} onValueChange={(v) => setComparePeriod(v as ComparePeriod)}>
            <SelectTrigger className="h-7 w-[130px] text-xs bg-card border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="min-w-[130px] bg-popover/95 backdrop-blur-xl border-border shadow-xl">
              <SelectItem value="prev-week" className="text-xs">vs Last Week</SelectItem>
              <SelectItem value="prev-month" className="text-xs">vs Last Month</SelectItem>
              <SelectItem value="prev-quarter" className="text-xs">vs Last Quarter</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Chart area — fills remaining space */}
      <div className="flex-1 min-h-0 flex flex-col">
        <AnimatePresence mode="wait">
          {compareMode ? (
            <motion.div
              key="compare"
              className="flex flex-col flex-1 min-h-0 gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {renderSingleChart(data, 'Current Period', perBarColors, 1, gradId)}
              <Separator />
              {renderSingleChart(prevData.length > 0 ? prevData : data, 'Previous Period', perBarColors, 0.7, prevGradId)}
            </motion.div>
          ) : (
            <motion.div
              key="single"
              className="flex-1 min-h-0 flex flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {renderSingleChart(data, meta.yLabel, perBarColors)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
