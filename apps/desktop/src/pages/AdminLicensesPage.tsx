import { useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { format, differenceInCalendarDays } from 'date-fns'
import {
  IconAlertTriangle,
  IconCertificate,
  IconClockHour4,
  IconLicense,
  IconShieldOff,
} from '@tabler/icons-react'
import { motion } from 'framer-motion'
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  XAxis,
  YAxis,
} from 'recharts'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

import MetricCard from '@/components/MetricCard'
import { useAuthStore } from '@/store'
import {
  useExpiringLicenses,
  useLicenseStats,
  useLicenses,
} from '@/hooks/useLicenses'
import {
  LICENSE_STATUS_COLORS,
  LICENSE_STATUS_LABELS,
  type License,
  type LicenseStatus,
} from '@/types/portal'

const heatmapConfig = {
  count: { label: 'Licenses', color: '#7DD3FC' },
} satisfies ChartConfig

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
}
const itemVariants = {
  hidden: { opacity: 0, scale: 0.96, y: 10 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 },
  },
}

export default function AdminLicensesPage() {
  const user = useAuthStore((s) => s.user)
  const isAdmin =
    !!user && (user.permissions.includes('*') || user.permissions.includes('admin'))

  if (!isAdmin) return <Navigate to="/licenses" replace />

  const { data: stats } = useLicenseStats()
  const { data: expiring = [] } = useExpiringLicenses(60)
  const { data: allLicenses = [] } = useLicenses()

  // ── Heatmap: expirations by month (next 12 months) ──
  const heatmap = useMemo(() => {
    const buckets: { month: string; count: number; urgency: 'red' | 'amber' | 'lime' }[] = []
    for (let i = 0; i < 12; i++) {
      const d = new Date()
      d.setMonth(d.getMonth() + i)
      const key = format(d, 'yyyy-MM')
      const label = format(d, 'MMM yy')
      const count = allLicenses.filter((l) => l.expirationDate?.startsWith(key)).length
      const urgency = i === 0 ? 'red' : i < 2 ? 'amber' : 'lime'
      buckets.push({ month: label, count, urgency })
    }
    return buckets
  }, [allLicenses])

  // ── At Risk: expiring ≤30 days, sorted by expiration asc ──
  const atRisk = useMemo(() => {
    const today = new Date()
    return expiring
      .filter((l) => {
        if (!l.expirationDate) return false
        const days = differenceInCalendarDays(new Date(l.expirationDate), today)
        return days <= 30
      })
      .sort((a, b) =>
        new Date(a.expirationDate!).getTime() - new Date(b.expirationDate!).getTime(),
      )
  }, [expiring])

  // ── Carrier coverage matrix ──
  const carrierMatrix = useMemo(() => buildCarrierMatrix(allLicenses), [allLicenses])

  const sparkline = useMemo(() => heatmap.slice(0, 6).map((h) => h.count), [heatmap])

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5 pt-6"
    >
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">License Vault — Admin</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Roll-up view across all agents · renewals, CE, carrier coverage
          </p>
        </div>
      </motion.div>

      {/* KPI row */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 lg:grid-cols-5 gap-3"
      >
        <MetricCard
          label="Active"
          value={stats?.active ?? 0}
          icon={<IconLicense size={18} />}
          color="#22c55e"
          sparklineData={sparkline}
        />
        <MetricCard
          label="Expiring ≤ 30d"
          value={stats?.expiringSoon30 ?? 0}
          icon={<IconAlertTriangle size={18} />}
          color="#ef4444"
          sparklineData={sparkline}
        />
        <MetricCard
          label="Expiring ≤ 60d"
          value={stats?.expiringSoon60 ?? 0}
          icon={<IconClockHour4 size={18} />}
          color="#f59e0b"
          sparklineData={sparkline}
        />
        <MetricCard
          label="Expired"
          value={stats?.expired ?? 0}
          icon={<IconShieldOff size={18} />}
          color="#6b7280"
          sparklineData={sparkline}
        />
        <MetricCard
          label="CE overdue"
          value={stats?.ceOverdue ?? 0}
          icon={<IconCertificate size={18} />}
          color="#a855f7"
          sparklineData={sparkline}
        />
      </motion.div>

      {/* Heatmap */}
      <motion.div variants={itemVariants}>
        <Card className="bg-card/50 backdrop-blur border-border/50 p-4">
          <p className="text-xs font-semibold text-foreground mb-3">
            Expirations by month (next 12 months)
          </p>
          <ChartContainer config={heatmapConfig} className="h-[220px] w-full">
            <BarChart data={heatmap} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {heatmap.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={
                      entry.urgency === 'red'
                        ? '#ef4444'
                        : entry.urgency === 'amber'
                          ? '#f59e0b'
                          : '#7DD3FC'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </Card>
      </motion.div>

      {/* At Risk table */}
      <motion.div variants={itemVariants}>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <div className="p-4 border-b border-border/50 flex items-center justify-between">
            <p className="text-xs font-semibold text-foreground">
              At risk — expiring within 30 days
            </p>
            <Badge variant="outline" className="text-[10px]">
              {atRisk.length}
            </Badge>
          </div>
          {atRisk.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Nothing urgent.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>License #</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Days left</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atRisk.map((l) => {
                  const days = differenceInCalendarDays(
                    new Date(l.expirationDate!),
                    new Date(),
                  )
                  const tone =
                    days < 0
                      ? 'text-red-400'
                      : days <= 7
                        ? 'text-red-400'
                        : days <= 14
                          ? 'text-amber-400'
                          : 'text-foreground'
                  return (
                    <TableRow key={l.id}>
                      <TableCell className="text-sm">
                        {l.agent
                          ? `${l.agent.firstName} ${l.agent.lastName}`
                          : l.agentId.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{l.state}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{l.licenseNumber}</TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(l.expirationDate!), 'PPP')}
                      </TableCell>
                      <TableCell className={`text-right text-xs font-semibold ${tone}`}>
                        {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d`}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </motion.div>

      {/* Status rollup pills */}
      <motion.div variants={itemVariants} className="flex flex-wrap gap-2">
        {(['active', 'pending', 'expired', 'revoked'] as LicenseStatus[]).map((s) => {
          const color = LICENSE_STATUS_COLORS[s]
          const count =
            s === 'active'
              ? stats?.active
              : s === 'pending'
                ? stats?.pending
                : s === 'expired'
                  ? stats?.expired
                  : stats?.revoked
          return (
            <Badge
              key={s}
              variant="outline"
              style={{ borderColor: `${color}40`, color }}
              className="text-[11px]"
            >
              {LICENSE_STATUS_LABELS[s]} · {count ?? 0}
            </Badge>
          )
        })}
      </motion.div>

      {/* Carrier coverage matrix */}
      <motion.div variants={itemVariants}>
        <Card className="bg-card/50 backdrop-blur border-border/50 p-4 overflow-x-auto">
          <p className="text-xs font-semibold text-foreground mb-3">Carrier coverage</p>
          {carrierMatrix.carriers.length === 0 || carrierMatrix.agents.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No appointments logged yet. Once agents add appointments, the matrix will populate.
            </p>
          ) : (
            <div className="min-w-[640px]">
              <div
                className="grid gap-1 text-[11px]"
                style={{
                  gridTemplateColumns: `180px repeat(${carrierMatrix.carriers.length}, minmax(70px, 1fr))`,
                }}
              >
                <div className="text-muted-foreground">Agent</div>
                {carrierMatrix.carriers.map((c) => (
                  <Tooltip key={c}>
                    <TooltipTrigger asChild>
                      <div className="text-muted-foreground truncate text-center">
                        {c}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{c}</TooltipContent>
                  </Tooltip>
                ))}
                {carrierMatrix.agents.map((a) => (
                  <AgentRow
                    key={a.agentId}
                    agentLabel={a.label}
                    carriers={carrierMatrix.carriers}
                    covered={a.covered}
                  />
                ))}
              </div>
            </div>
          )}
        </Card>
      </motion.div>
    </motion.div>
  )
}

function AgentRow({
  agentLabel,
  carriers,
  covered,
}: {
  agentLabel: string
  carriers: string[]
  covered: Set<string>
}) {
  return (
    <>
      <div className="text-foreground truncate">{agentLabel}</div>
      {carriers.map((c) => (
        <div key={c} className="flex items-center justify-center">
          <Badge
            variant={covered.has(c) ? 'default' : 'outline'}
            className={`h-5 w-5 p-0 rounded-full flex items-center justify-center ${covered.has(c) ? '' : 'opacity-40'}`}
          >
            {covered.has(c) ? '✓' : '·'}
          </Badge>
        </div>
      ))}
    </>
  )
}

/**
 * Build a (agents × top-N carriers) coverage matrix from license rows plus the in-memory LOA hint.
 * NOTE: The full matrix with real appointments would require fetching `listLicenseAppointments`
 * for each license which is O(N) extra requests. For v1 we derive the carrier list from the
 * `linesOfAuthority` field if populated — this keeps a single round trip while still giving
 * admins a coverage overview. A follow-up pass can swap to a batched appointments endpoint.
 */
function buildCarrierMatrix(licenses: License[]) {
  const carriersSet = new Map<string, number>()
  const agents = new Map<string, { label: string; covered: Set<string> }>()
  for (const l of licenses) {
    const loa = l.linesOfAuthority ?? []
    const agentKey = l.agentId
    if (!agents.has(agentKey)) {
      agents.set(agentKey, {
        label: l.agent
          ? `${l.agent.firstName} ${l.agent.lastName}`
          : agentKey.slice(0, 8),
        covered: new Set<string>(),
      })
    }
    for (const carrier of loa) {
      agents.get(agentKey)!.covered.add(carrier)
      carriersSet.set(carrier, (carriersSet.get(carrier) ?? 0) + 1)
    }
  }
  const carriers = [...carriersSet.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([c]) => c)
  const agentList = [...agents.entries()].map(([agentId, v]) => ({
    agentId,
    label: v.label,
    covered: v.covered,
  }))
  return { carriers, agents: agentList }
}
