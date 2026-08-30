import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import MetricCard from '../components/MetricCard'
import EmptyState from '../components/EmptyState'
import { IconDownload, IconSearch, IconPhone, IconPlugConnected, IconCalendar, IconFileCheck, IconChartBar, IconUsers } from '@tabler/icons-react'
import { motion } from 'framer-motion'

// ── Types ───────────────────────────────────────────────────────

type ReportType = 'agents' | 'production'

interface ProductionRow {
  discordId?: string | number
  discord_id?: string | number
  firstName?: string
  lastName?: string
  agency: string
  dials: number
  connections: number
  talkTimeMins: number
  appointments: number
  callbacks: number
  policies: number
  sessionCount: number
}

interface AgentReportRow {
  discordId?: string | number
  discord_id?: string | number
  firstName?: string
  lastName?: string
  agency?: string
  currentStage?: string
  current_stage?: string
}

// ── Chart Configs ───────────────────────────────────────────────

const productionChartConfig = {
  dials: { label: 'Dials', color: '#3b82f6' },
  connections: { label: 'Connections', color: '#8b5cf6' },
  appointments: { label: 'Appointments', color: '#f59e0b' },
  policies: { label: 'Policies', color: '#22c55e' },
} satisfies ChartConfig

const STAGE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#ef4444', '#06b6d4', '#ec4899', '#f97316']

// ── Animation Variants ──────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24, mass: 0.8 } },
}

// ── Helpers ─────────────────────────────────────────────────────

function getDefaultRange() {
  const to = new Date().toISOString().split('T')[0]
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return { from: d.toISOString().split('T')[0], to }
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Component ───────────────────────────────────────────────────

export default function ReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('production')
  const [dateRange, setDateRange] = useState(getDefaultRange)
  const [search, setSearch] = useState('')

  const { data: agentReport = [], isLoading: agentsLoading } = useQuery({
    queryKey: ['report-agents'],
    queryFn: () => api.getAgentReport(),
    enabled: reportType === 'agents',
  })

  const { data: prodReport = [], isLoading: prodLoading } = useQuery({
    queryKey: ['report-production', dateRange],
    queryFn: () => api.getProductionReport(dateRange),
    enabled: reportType === 'production',
  })

  const isLoading = reportType === 'agents' ? agentsLoading : prodLoading

  const typedProd = prodReport as ProductionRow[]
  const typedAgents = agentReport as AgentReportRow[]

  function handleExport() {
    if (reportType === 'production') {
      downloadCsv(
        `production-report-${dateRange.from}-${dateRange.to}.csv`,
        ['Name', 'Agency', 'Dials', 'Connections', 'Talk Time (min)', 'Appointments', 'Policies', 'Sessions'],
        typedProd.map((r) => [
          `${r.firstName} ${r.lastName}`, r.agency, String(r.dials), String(r.connections),
          String(r.talkTimeMins), String(r.appointments), String(r.policies), String(r.sessionCount),
        ])
      )
    } else {
      downloadCsv(
        'agents-report.csv',
        ['Discord ID', 'Name', 'Agency', 'Stage'],
        typedAgents.map((r) => [
          String(r.discordId ?? r.discord_id ?? ''), r.firstName ?? '', r.agency ?? '', String(r.currentStage ?? r.current_stage ?? ''),
        ])
      )
    }
  }

  const filteredProd = useMemo(() => {
    if (!search) return typedProd
    return typedProd.filter((r) =>
      `${r.firstName} ${r.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      r.agency.toLowerCase().includes(search.toLowerCase())
    )
  }, [typedProd, search])

  const filteredAgents = useMemo(() => {
    if (!search) return typedAgents
    return typedAgents.filter((r) =>
      `${r.firstName ?? ''} ${r.lastName ?? ''}`.toLowerCase().includes(search.toLowerCase()) ||
      (r.agency ?? '').toLowerCase().includes(search.toLowerCase())
    )
  }, [typedAgents, search])

  // ── Derived chart data ──────────────────────────────────────

  const prodChartData = useMemo(() =>
    filteredProd.slice(0, 10).map((r) => ({
      name: (r.firstName ?? '') + ' ' + ((r.lastName ?? '').charAt(0) || '') + '.',
      dials: r.dials,
      connections: r.connections,
      appointments: r.appointments,
      policies: r.policies,
    })),
  [filteredProd])

  const totalDials = useMemo(() => filteredProd.reduce((s, r) => s + r.dials, 0), [filteredProd])
  const totalConnections = useMemo(() => filteredProd.reduce((s, r) => s + r.connections, 0), [filteredProd])
  const totalAppointments = useMemo(() => filteredProd.reduce((s, r) => s + r.appointments, 0), [filteredProd])
  const totalPolicies = useMemo(() => filteredProd.reduce((s, r) => s + r.policies, 0), [filteredProd])

  const stageData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of filteredAgents) {
      const stage = r.currentStage ?? r.current_stage ?? 'Unknown'
      counts[stage] = (counts[stage] || 0) + 1
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [filteredAgents])

  const stageChartConfig = useMemo(() => {
    const cfg: Record<string, { label: string; color: string }> = {}
    stageData.forEach((d, i) => {
      cfg[d.name] = { label: d.name, color: STAGE_COLORS[i % STAGE_COLORS.length] }
    })
    return cfg satisfies ChartConfig
  }, [stageData])

  // ── Loading skeleton ──────────────────────────────────────

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
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Reports</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Generate and export data reports</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={isLoading}>
          <IconDownload size={14} className="mr-1" />
          Export CSV
        </Button>
      </motion.div>

      {/* Controls */}
      <motion.div variants={itemVariants} className="flex items-center gap-3 flex-wrap">
        <Tabs value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
          <TabsList>
            <TabsTrigger value="production">Production</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
          </TabsList>
        </Tabs>

        {reportType === 'production' && (
          <>
            <Input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))}
              className="w-36 h-8 text-xs"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))}
              className="w-36 h-8 text-xs"
            />
          </>
        )}

        <div className="relative flex-1 max-w-xs">
          <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
      </motion.div>

      {/* Production Tab Content */}
      {reportType === 'production' && (
        <>
          {/* Metric Cards */}
          <motion.div variants={itemVariants} className="grid grid-cols-4 gap-3">
            <MetricCard
              label="Total Dials"
              value={totalDials.toLocaleString()}
              icon={<IconPhone size={16} />}
              color="#3b82f6"
            />
            <MetricCard
              label="Total Connections"
              value={totalConnections.toLocaleString()}
              icon={<IconPlugConnected size={16} />}
              color="#8b5cf6"
            />
            <MetricCard
              label="Total Appointments"
              value={totalAppointments.toLocaleString()}
              icon={<IconCalendar size={16} />}
              color="#f59e0b"
            />
            <MetricCard
              label="Total Policies"
              value={totalPolicies.toLocaleString()}
              icon={<IconFileCheck size={16} />}
              color="#22c55e"
            />
          </motion.div>

          {/* Production Bar Chart */}
          {prodChartData.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Top Agents — Production Breakdown</CardTitle>
                  <CardDescription>Top 10 agents by activity metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={productionChartConfig} className="h-[300px] w-full">
                    <BarChart data={prodChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="dials" fill="var(--color-dials)" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="connections" fill="var(--color-connections)" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="appointments" fill="var(--color-appointments)" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="policies" fill="var(--color-policies)" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Production Table */}
          <motion.div variants={itemVariants}>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Production Report</CardTitle>
                <CardDescription>
                  {dateRange.from} — {dateRange.to} · {filteredProd.length} results
                </CardDescription>
              </CardHeader>
              <CardContent>
                {filteredProd.length === 0 ? (
                  <EmptyState
                    icon={IconChartBar}
                    title="No production data"
                    description="Adjust your date range or search to find results."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground border-b border-border">
                          <th className="text-left py-2">Agent</th>
                          <th className="text-left py-2">Agency</th>
                          <th className="text-right py-2">Dials</th>
                          <th className="text-right py-2">Connections</th>
                          <th className="text-right py-2">Talk Time</th>
                          <th className="text-right py-2">Appts</th>
                          <th className="text-right py-2">Policies</th>
                          <th className="text-right py-2">Sessions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProd.map((r) => (
                          <tr key={String(r.discordId ?? r.discord_id)} className="border-b border-border/50 hover:bg-white/[0.02]">
                            <td className="py-2 text-foreground">{r.firstName} {r.lastName}</td>
                            <td className="py-2 text-muted-foreground">{r.agency || '—'}</td>
                            <td className="py-2 text-right">{r.dials.toLocaleString()}</td>
                            <td className="py-2 text-right">{r.connections.toLocaleString()}</td>
                            <td className="py-2 text-right">{Math.round(r.talkTimeMins / 60)}h {r.talkTimeMins % 60}m</td>
                            <td className="py-2 text-right">{r.appointments}</td>
                            <td className="py-2 text-right font-medium text-green-400">{r.policies}</td>
                            <td className="py-2 text-right text-muted-foreground">{r.sessionCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}

      {/* Agents Tab Content */}
      {reportType === 'agents' && (
        <>
          {/* Agent Stage Donut */}
          {stageData.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card className="bg-card/50 backdrop-blur border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Agents by Stage</CardTitle>
                  <CardDescription>{filteredAgents.length} agents across {stageData.length} stages</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-center">
                  <ChartContainer config={stageChartConfig} className="h-[220px] w-[280px]">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                      <Pie
                        data={stageData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {stageData.map((entry, idx) => (
                          <Cell key={entry.name} fill={STAGE_COLORS[idx % STAGE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="ml-4 space-y-1.5">
                    {stageData.map((d, idx) => (
                      <div key={d.name} className="flex items-center gap-2 text-xs">
                        <div
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{ backgroundColor: STAGE_COLORS[idx % STAGE_COLORS.length] }}
                        />
                        <span className="text-muted-foreground truncate max-w-[140px]">{d.name}</span>
                        <span className="font-medium text-foreground ml-auto">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Agent Table */}
          <motion.div variants={itemVariants}>
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Agent Report</CardTitle>
                <CardDescription>{filteredAgents.length} agents</CardDescription>
              </CardHeader>
              <CardContent>
                {filteredAgents.length === 0 ? (
                  <EmptyState
                    icon={IconUsers}
                    title="No agents found"
                    description="Try adjusting your search criteria."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground border-b border-border">
                          <th className="text-left py-2">Discord ID</th>
                          <th className="text-left py-2">Name</th>
                          <th className="text-left py-2">Agency</th>
                          <th className="text-left py-2">Stage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAgents.map((r, i) => (
                          <tr key={String(r.discordId ?? r.discord_id ?? i)} className="border-b border-border/50 hover:bg-white/[0.02]">
                            <td className="py-2 text-muted-foreground font-mono text-xs">{String(r.discordId ?? r.discord_id ?? '')}</td>
                            <td className="py-2 text-foreground">{r.firstName ?? ''} {r.lastName ?? ''}</td>
                            <td className="py-2 text-muted-foreground">{r.agency ?? '—'}</td>
                            <td className="py-2">{r.currentStage ?? r.current_stage ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </motion.div>
  )
}
