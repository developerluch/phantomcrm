import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { api } from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import { IconSearch, IconChevronLeft, IconChevronRight, IconActivity, IconPlus, IconPencil, IconTrash } from '@tabler/icons-react'
import MetricCard from '../components/MetricCard'
import EmptyState from '../components/EmptyState'

const PAGE_SIZE = 50

// ── Animation variants ──────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24, mass: 0.8 } },
}

// ── Chart config ────────────────────────────────────────────────────
const actionChartConfig = {
  create: { label: 'Create', color: '#22c55e' },
  update: { label: 'Update', color: '#3b82f6' },
  delete: { label: 'Delete', color: '#ef4444' },
  login: { label: 'Login', color: '#8b5cf6' },
  other: { label: 'Other', color: '#6b7280' },
} satisfies ChartConfig

const timelineChartConfig = {
  actions: { label: 'Actions', color: '#3b82f6' },
} satisfies ChartConfig

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-500/10 text-green-400',
  update: 'bg-blue-500/10 text-blue-400',
  delete: 'bg-red-500/10 text-red-400',
  login: 'bg-purple-500/10 text-purple-400',
  logout: 'bg-muted text-muted-foreground',
}

const ACTION_CHART_COLORS: Record<string, string> = {
  create: '#22c55e',
  update: '#3b82f6',
  delete: '#ef4444',
  login: '#8b5cf6',
  other: '#6b7280',
}

export default function AuditLogPage() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['audit-log', page],
    queryFn: () => api.getAuditLog({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
  })

  const filtered = search
    ? entries.filter(
        (e) =>
          e.action.toLowerCase().includes(search.toLowerCase()) ||
          e.resourceType.toLowerCase().includes(search.toLowerCase()) ||
          e.userId.includes(search)
      )
    : entries

  // ── Derived metrics ─────────────────────────────────────────────
  const metrics = useMemo(() => {
    const creates = entries.filter((e) => e.action.toLowerCase().includes('create')).length
    const updates = entries.filter((e) => e.action.toLowerCase().includes('update')).length
    const deletes = entries.filter((e) => e.action.toLowerCase().includes('delete')).length
    return { total: entries.length, creates, updates, deletes }
  }, [entries])

  // ── Action type donut data ──────────────────────────────────────
  const donutData = useMemo(() => {
    const counts: Record<string, number> = {}
    entries.forEach((e) => {
      const action = e.action.toLowerCase()
      if (action.includes('create')) counts['create'] = (counts['create'] ?? 0) + 1
      else if (action.includes('update')) counts['update'] = (counts['update'] ?? 0) + 1
      else if (action.includes('delete')) counts['delete'] = (counts['delete'] ?? 0) + 1
      else if (action.includes('login')) counts['login'] = (counts['login'] ?? 0) + 1
      else counts['other'] = (counts['other'] ?? 0) + 1
    })
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
  }, [entries])

  // ── Activity timeline (last 7 days) ────────────────────────────
  const timelineData = useMemo(() => {
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      return d.toISOString().split('T')[0]
    })
    const counts = new Map<string, number>()
    last7.forEach((d) => counts.set(d, 0))
    entries.forEach((e) => {
      const day = e.createdAt?.split('T')[0]
      if (day && counts.has(day)) counts.set(day, (counts.get(day) ?? 0) + 1)
    })
    return last7.map((d) => ({ date: d.slice(5), actions: counts.get(d) ?? 0 }))
  }, [entries])

  // ── Loading skeleton ────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="h-7 w-44 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-[60vh] bg-muted/30 rounded-xl animate-pulse" />
      </div>
    )
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5 pt-6">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-xl font-bold text-foreground">Audit Log</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Track all system actions and changes</p>
      </motion.div>

      {/* Metric Cards Row */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-4 gap-3">
          <MetricCard
            label="Total Actions"
            value={metrics.total}
            icon={<IconActivity size={16} />}
            color="#3b82f6"
          />
          <MetricCard
            label="Creates"
            value={metrics.creates}
            icon={<IconPlus size={16} />}
            color="#22c55e"
          />
          <MetricCard
            label="Updates"
            value={metrics.updates}
            icon={<IconPencil size={16} />}
            color="#f59e0b"
          />
          <MetricCard
            label="Deletes"
            value={metrics.deletes}
            icon={<IconTrash size={16} />}
            color="#ef4444"
          />
        </div>
      </motion.div>

      {/* Charts Row — Action Donut + Activity Timeline */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-2 gap-3">
          {/* Action Type Donut */}
          <Card className="bg-card/50 backdrop-blur border-border/50 p-4">
            <h2 className="text-sm font-semibold text-foreground mb-2">Action Distribution</h2>
            {donutData.length > 0 ? (
              <div className="flex items-center gap-6">
                <ChartContainer config={actionChartConfig} className="h-[180px] w-[180px] aspect-square">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={80}
                      strokeWidth={2}
                      stroke="hsl(var(--background))"
                    >
                      {donutData.map((entry) => (
                        <Cell key={entry.name} fill={ACTION_CHART_COLORS[entry.name] ?? '#6b7280'} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-col gap-2">
                  {donutData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-2 text-xs">
                      <div
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: ACTION_CHART_COLORS[entry.name] ?? '#6b7280' }}
                      />
                      <span className="text-muted-foreground capitalize">{entry.name}</span>
                      <span className="font-semibold text-foreground ml-auto tabular-nums">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">No data yet</p>
            )}
          </Card>

          {/* Activity Timeline */}
          <Card className="bg-card/50 backdrop-blur border-border/50 p-4">
            <h2 className="text-sm font-semibold text-foreground mb-2">Activity (Last 7 Days)</h2>
            <ChartContainer config={timelineChartConfig} className="h-[180px] w-full">
              <AreaChart data={timelineData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="auditTimelineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-actions)" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="var(--color-actions)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="actions"
                  stroke="var(--color-actions)"
                  strokeWidth={2}
                  fill="url(#auditTimelineGradient)"
                />
              </AreaChart>
            </ChartContainer>
          </Card>
        </div>
      </motion.div>

      {/* Search Filter */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter by action, resource, or user..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>
      </motion.div>

      {/* Activity List */}
      <motion.div variants={itemVariants}>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <EmptyState
                icon={IconActivity}
                title="No audit entries"
                description="Activity will appear here as users interact with the system."
              />
            ) : (
              <div className="space-y-1">
                {filtered.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.02] transition-colors"
                  >
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                        ACTION_COLORS[entry.action] ?? 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {entry.action}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {entry.resourceType}
                        {entry.resourceId ? ` #${entry.resourceId.slice(0, 8)}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        User: {entry.userId ? entry.userId.slice(0, 8) + '...' : 'system'}
                        {entry.ipAddress ? ` · ${entry.ipAddress}` : ''}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <IconChevronLeft size={14} className="mr-1" />
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">Page {page + 1}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={entries.length < PAGE_SIZE}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <IconChevronRight size={14} className="ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
