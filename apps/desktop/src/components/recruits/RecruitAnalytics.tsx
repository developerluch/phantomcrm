import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  LabelList,
} from 'recharts'
import { IconCircleCheck, IconAlertTriangle } from '@tabler/icons-react'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { Recruit } from '../../types/portal'
import {
  useRecruitAnalytics,
  type TimeInStagePoint,
  type SourceComparisonPoint,
  type LicenseTrackerEntry,
  type BottleneckEntry,
} from '../../hooks/useRecruitAnalytics'
import RecruitFunnelChart from './RecruitFunnelChart'

// ── Animation config ─────────────────────────────────────────────

const MOUNT_SPRING = { type: 'spring' as const, stiffness: 300, damping: 24, mass: 0.8 }
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: MOUNT_SPRING },
}

// ── Chart configs ────────────────────────────────────────────────

const timeInStageConfig = {
  avgDays: { label: 'Avg Days', color: '#f59e0b' },
} satisfies ChartConfig

const sourceConfig = {
  adsCount: { label: 'Online Ads', color: '#3b82f6' },
  inPersonCount: { label: 'In-Person', color: '#22c55e' },
  webFormCount: { label: 'Website Form', color: '#7DD3FC' },
  referralCount: { label: 'Referral', color: '#a855f7' },
} satisfies ChartConfig

const bottleneckConfig = {
  avgDays: { label: 'Avg Days', color: '#ef4444' },
} satisfies ChartConfig

// ── Sub-components ───────────────────────────────────────────────

function TimeInStageChart({ data }: { data: TimeInStagePoint[] }) {
  return (
    <Card className="bg-card/50 backdrop-blur border-border/30">
      <CardHeader>
        <CardTitle>Time in Stage</CardTitle>
        <CardDescription>Average days recruits spend in each stage</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={timeInStageConfig} className="h-[350px] w-full">
          <BarChart
            layout="vertical"
            data={data}
            margin={{ left: 20, right: 40 }}
          >
            <CartesianGrid
              horizontal={false}
              strokeDasharray="3 3"
              className="stroke-border/20"
            />
            <XAxis type="number" className="fill-muted-foreground" />
            <YAxis
              type="category"
              dataKey="label"
              width={130}
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="avgDays" radius={[0, 6, 6, 0]}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={
                    entry.severity === 'critical'
                      ? '#ef4444'
                      : entry.severity === 'warning'
                        ? '#f59e0b'
                        : entry.color
                  }
                />
              ))}
              <LabelList
                dataKey="avgDays"
                position="right"
                className="fill-foreground text-xs"
                formatter={(v: number) => `${v}d`}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function SourceComparisonChart({ data }: { data: SourceComparisonPoint[] }) {
  return (
    <Card className="bg-card/50 backdrop-blur border-border/30">
      <CardHeader>
        <CardTitle>Source Comparison</CardTitle>
        <CardDescription>Online Ads vs In-Person recruits by stage</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={sourceConfig} className="h-[350px] w-full">
          <BarChart data={data} margin={{ bottom: 40 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              className="stroke-border/20"
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              angle={-45}
              textAnchor="end"
              className="fill-muted-foreground"
              interval={0}
              height={80}
            />
            <YAxis className="fill-muted-foreground" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar
              dataKey="adsCount"
              fill="var(--color-adsCount)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="inPersonCount"
              fill="var(--color-inPersonCount)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="webFormCount"
              fill="var(--color-webFormCount)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="referralCount"
              fill="var(--color-referralCount)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function LicenseTracker({ entries }: { entries: LicenseTrackerEntry[] }) {
  const urgencyColor = (urgency: LicenseTrackerEntry['urgency']) => {
    switch (urgency) {
      case 'on-track':
        return 'bg-emerald-500'
      case 'warning':
        return 'bg-amber-500'
      case 'critical':
        return 'bg-red-500'
    }
  }

  const urgencyBadgeVariant = (urgency: LicenseTrackerEntry['urgency']) => {
    switch (urgency) {
      case 'on-track':
        return 'success' as const
      case 'warning':
        return 'warning' as const
      case 'critical':
        return 'destructive' as const
    }
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-border/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>30-Day License Tracker</CardTitle>
            <CardDescription>Recruits currently in licensing course</CardDescription>
          </div>
          <Badge variant="secondary">{entries.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <IconCircleCheck size={32} className="mb-2 text-emerald-500" />
            <p className="text-sm">No recruits currently in licensing course</p>
          </div>
        ) : (
          <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
            {entries.map((entry) => {
              const progress = Math.min((entry.daysInCourse / 30) * 100, 100)
              return (
                <div
                  key={entry.id}
                  className="rounded-lg border border-border/30 bg-card/30 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{entry.name}</span>
                    <Badge variant={urgencyBadgeVariant(entry.urgency)}>
                      {entry.daysRemaining}d left
                    </Badge>
                  </div>
                  <Progress value={progress} className="h-2 w-full bg-muted" indicatorClassName={urgencyColor(entry.urgency)} />
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function BottleneckDetection({ bottlenecks }: { bottlenecks: BottleneckEntry[] }) {
  if (bottlenecks.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/30">
        <CardHeader>
          <CardTitle>Bottleneck Detection</CardTitle>
          <CardDescription>Stages with extended processing times</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <IconCircleCheck size={32} className="mb-2 text-emerald-500" />
            <p className="text-sm">No bottlenecks detected</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-border/30">
      <CardHeader>
        <div className="flex items-center gap-2">
          <IconAlertTriangle size={18} className="text-amber-500" />
          <div>
            <CardTitle>Bottleneck Detection</CardTitle>
            <CardDescription>Stages with extended processing times</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={bottleneckConfig} className="h-[250px] w-full">
          <BarChart
            layout="vertical"
            data={bottlenecks}
            margin={{ left: 20, right: 60 }}
          >
            <CartesianGrid
              horizontal={false}
              strokeDasharray="3 3"
              className="stroke-border/20"
            />
            <XAxis type="number" className="fill-muted-foreground" />
            <YAxis
              type="category"
              dataKey="label"
              width={130}
              tick={{ fontSize: 11 }}
              className="fill-muted-foreground"
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="avgDays" radius={[0, 6, 6, 0]}>
              {bottlenecks.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.avgDays > 14 ? '#ef4444' : '#f59e0b'}
                />
              ))}
              <LabelList
                dataKey="avgDays"
                position="right"
                className="fill-foreground text-xs"
                formatter={(v: number) => `${v}d (${bottlenecks.find((b) => b.avgDays === v)?.recruitCount ?? 0})`}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

// ── Main component ───────────────────────────────────────────────

interface RecruitAnalyticsProps {
  recruits: Recruit[]
}

export default function RecruitAnalytics({ recruits }: RecruitAnalyticsProps) {
  const [sourceFilter, setSourceFilter] = useState<'all' | 'ads' | 'in_person'>('all')
  const analytics = useRecruitAnalytics(recruits, sourceFilter)

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Full-width funnel */}
      <motion.div variants={itemVariants}>
        <RecruitFunnelChart
          funnelData={analytics.funnelData}
          sourceFilter={sourceFilter}
          onSourceFilterChange={setSourceFilter}
        />
      </motion.div>

      {/* 2x2 grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={itemVariants}>
          <TimeInStageChart data={analytics.timeInStage} />
        </motion.div>
        <motion.div variants={itemVariants}>
          <SourceComparisonChart data={analytics.sourceComparison} />
        </motion.div>
        <motion.div variants={itemVariants}>
          <LicenseTracker entries={analytics.licenseTracker} />
        </motion.div>
        <motion.div variants={itemVariants}>
          <BottleneckDetection bottlenecks={analytics.bottlenecks} />
        </motion.div>
      </div>
    </motion.div>
  )
}
