import { motion } from 'framer-motion'
import type { Props as LabelProps } from 'recharts/types/component/Label'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  LabelList,
} from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import type { FunnelDataPoint } from '../../hooks/useRecruitAnalytics'

interface RecruitFunnelChartProps {
  funnelData: FunnelDataPoint[]
  sourceFilter: 'all' | 'ads' | 'in_person'
  onSourceFilterChange: (filter: 'all' | 'ads' | 'in_person') => void
}

const funnelChartConfig = {
  count: { label: 'Recruits' },
  new_lead: { label: 'New Lead', color: '#3b82f6' },
  prequalified: { label: 'Prequalified', color: '#06b6d4' },
  interview_scheduled: { label: 'Interview Scheduled', color: '#8b5cf6' },
  interviewed: { label: 'Interviewed', color: '#a855f7' },
  onboarding: { label: 'Onboarding', color: '#f59e0b' },
  in_course: { label: 'In Course', color: '#f97316' },
  licensed: { label: 'Licensed', color: '#10b981' },
  contracting: { label: 'Contracting', color: '#14b8a6' },
  active: { label: 'Active', color: '#22c55e' },
} satisfies ChartConfig

export default function RecruitFunnelChart({
  funnelData,
  sourceFilter,
  onSourceFilterChange,
}: RecruitFunnelChartProps) {
  function renderBarLabel(props: LabelProps) {
    const x = Number(props.x ?? 0)
    const y = Number(props.y ?? 0)
    const width = Number(props.width ?? 0)
    const height = Number(props.height ?? 0)
    const value = props.value as number | undefined
    const index = props.index as number | undefined
    const entry = index != null ? funnelData[index] : undefined
    return (
      <g>
        <text
          x={x + width + 8}
          y={y + height / 2}
          dy={-2}
          className="fill-foreground text-xs font-medium"
          textAnchor="start"
        >
          {value}
        </text>
        {entry?.conversionFromPrev != null && (
          <text
            x={x + width + 8}
            y={y + height / 2}
            dy={12}
            className="fill-muted-foreground text-[10px]"
            textAnchor="start"
          >
            {entry.conversionFromPrev.toFixed(0)}% conv
          </text>
        )}
      </g>
    )
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-border/30">
      <CardHeader>
        <div className="flex justify-between">
          <div>
            <CardTitle>Conversion Funnel</CardTitle>
            <CardDescription>Stage-by-stage recruit progression</CardDescription>
          </div>
          <Select
            value={sourceFilter}
            onValueChange={(v) =>
              onSourceFilterChange(v as 'all' | 'ads' | 'in_person')
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="ads">Online Ads</SelectItem>
              <SelectItem value="in_person">In-Person</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <ChartContainer
            config={funnelChartConfig}
            className="h-[400px] w-full"
          >
            <BarChart
              layout="vertical"
              data={funnelData}
              margin={{ left: 20, right: 60 }}
            >
              <CartesianGrid
                horizontal={false}
                strokeDasharray="3 3"
                className="stroke-border/20"
              />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                width={140}
                tick={{ fontSize: 12 }}
                className="fill-muted-foreground"
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {funnelData.map((entry, i) => (
                  <Cell key={i} fill={`var(--color-${entry.stage})`} />
                ))}
                <LabelList
                  dataKey="count"
                  position="right"
                  content={renderBarLabel}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        </motion.div>
      </CardContent>
    </Card>
  )
}
