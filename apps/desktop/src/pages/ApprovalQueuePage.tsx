import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { PieChart, Pie, Cell } from 'recharts'
import {
  usePendingJoins,
  useApprovePendingJoin,
  useRejectPendingJoin,
  useBulkPendingJoins,
} from '../hooks/usePendingJoins'
import { toast } from 'sonner'
import { IconCheck, IconX, IconUsers, IconUserCheck, IconClock, IconPercentage, IconX as IconXCircle } from '@tabler/icons-react'
import type { PendingJoin } from '../types/portal'
import EmptyState from '../components/EmptyState'
import MetricCard from '../components/MetricCard'

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
const approvalChartConfig = {
  approved: { label: 'Approved', color: '#22c55e' },
  rejected: { label: 'Rejected', color: '#ef4444' },
  pending: { label: 'Pending', color: '#f59e0b' },
} satisfies ChartConfig

const STATUS_COLORS: Record<string, string> = {
  approved: '#22c55e',
  rejected: '#ef4444',
  pending: '#f59e0b',
}

// ── Helpers ─────────────────────────────────────────────────────────
function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function AvatarCircle({ username, avatarUrl }: { username: string; avatarUrl?: string }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        className="w-8 h-8 rounded-full object-cover shrink-0"
      />
    )
  }
  const letter = username.trim()[0]?.toUpperCase() ?? '?'
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
    >
      {letter}
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────
export default function ApprovalQueuePage() {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { data, isLoading, isError } = usePendingJoins()
  const approve = useApprovePendingJoin()
  const reject = useRejectPendingJoin()
  const bulk = useBulkPendingJoins()

  const joins = data?.pendingJoins ?? []
  const pending = data?.totalPending ?? 0

  // ── Derived metrics ─────────────────────────────────────────────
  const metrics = useMemo(() => {
    const pendingCount = joins.filter((j) => j.status === 'pending').length
    const approvedCount = joins.filter((j) => j.status === 'approved').length
    const rejectedCount = joins.filter((j) => j.status === 'rejected').length
    const total = approvedCount + rejectedCount
    const approvalRate = total > 0 ? ((approvedCount / total) * 100).toFixed(1) : '0.0'
    return { pendingCount, approvedCount, rejectedCount, approvalRate }
  }, [joins])

  const donutData = useMemo(() => {
    const counts = [
      { name: 'approved', value: metrics.approvedCount },
      { name: 'rejected', value: metrics.rejectedCount },
      { name: 'pending', value: metrics.pendingCount },
    ].filter((d) => d.value > 0)
    return counts
  }, [metrics])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === joins.length) setSelected(new Set())
    else setSelected(new Set(joins.map((j) => j.id)))
  }

  const handleApprove = async (id: string) => {
    try {
      await approve.mutateAsync(id)
      toast.success('Member approved')
      setSelected((prev) => {
        const n = new Set(prev)
        n.delete(id)
        return n
      })
    } catch {
      toast.error('Failed to approve')
    }
  }

  const handleReject = async (id: string, kick = false) => {
    try {
      await reject.mutateAsync({ id, kick })
      toast.success(kick ? 'Member rejected and kicked' : 'Member rejected')
      setSelected((prev) => {
        const n = new Set(prev)
        n.delete(id)
        return n
      })
    } catch {
      toast.error('Failed to reject')
    }
  }

  const handleBulk = async (action: 'approve' | 'reject') => {
    if (selected.size === 0) return
    try {
      await bulk.mutateAsync({ ids: Array.from(selected), action })
      toast.success(`${selected.size} member${selected.size > 1 ? 's' : ''} ${action === 'approve' ? 'approved' : 'rejected'}`)
      setSelected(new Set())
    } catch {
      toast.error(`Failed to ${action} members`)
    }
  }

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

  // ── Error state ─────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Failed to load pending joins. Check your connection.</p>
      </div>
    )
  }

  // ── Empty state ─────────────────────────────────────────────────
  if (joins.length === 0) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">
        <motion.div variants={itemVariants}>
          <h1 className="text-xl font-bold text-foreground">Approval Queue</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review and approve new Discord server join requests
          </p>
        </motion.div>
        <motion.div variants={itemVariants}>
          <EmptyState
            icon={IconUserCheck}
            title="No pending approvals"
            description="New join requests from your Discord server will appear here for review."
          />
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5 pt-6">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold text-foreground">Approval Queue</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Review and approve new Discord server join requests
              </p>
            </div>
            {pending > 0 && (
              <Badge variant="warning" className="text-xs">
                {pending} pending
              </Badge>
            )}
          </div>

          {/* Bulk actions */}
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground mr-1">
                {selected.size} selected
              </span>
              <Button
                size="sm"
                variant="outline"
                className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                onClick={() => handleBulk('approve')}
                disabled={bulk.isPending}
              >
                <IconCheck size={14} className="mr-1" />
                Approve All
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                onClick={() => handleBulk('reject')}
                disabled={bulk.isPending}
              >
                <IconX size={14} className="mr-1" />
                Reject All
              </Button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Metric Cards Row */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-4 gap-3">
          <MetricCard
            label="Pending"
            value={metrics.pendingCount}
            icon={<IconClock size={16} />}
            color="#f59e0b"
          />
          <MetricCard
            label="Approved"
            value={metrics.approvedCount}
            icon={<IconCheck size={16} />}
            color="#22c55e"
          />
          <MetricCard
            label="Rejected"
            value={metrics.rejectedCount}
            icon={<IconXCircle size={16} />}
            color="#ef4444"
          />
          <MetricCard
            label="Approval Rate"
            value={`${metrics.approvalRate}%`}
            icon={<IconPercentage size={16} />}
            color="#3b82f6"
          />
        </div>
      </motion.div>

      {/* Status Distribution Donut */}
      {donutData.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="bg-card/50 backdrop-blur border-border/50 p-4">
            <h2 className="text-sm font-semibold text-foreground mb-2">Status Distribution</h2>
            <div className="flex items-center gap-6">
              <ChartContainer config={approvalChartConfig} className="h-[180px] w-[180px] aspect-square">
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
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#888'} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="flex flex-col gap-2">
                {donutData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: STATUS_COLORS[entry.name] ?? '#888' }}
                    />
                    <span className="text-muted-foreground capitalize">{entry.name}</span>
                    <span className="font-semibold text-foreground ml-auto tabular-nums">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Table */}
      <motion.div variants={itemVariants}>
        <Card className="bg-card/50 backdrop-blur border-border/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-4 py-3 w-10">
                    <Checkbox
                      checked={selected.size === joins.length && joins.length > 0}
                      onCheckedChange={() => toggleAll()}
                    />
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Discord ID
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {joins.map((join) => (
                  <PendingJoinRow
                    key={join.id}
                    join={join}
                    isSelected={selected.has(join.id)}
                    onToggle={() => toggleSelect(join.id)}
                    onApprove={() => handleApprove(join.id)}
                    onReject={(kick) => handleReject(join.id, kick)}
                    isApproving={approve.isPending}
                    isRejecting={reject.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}

// ── Row component ───────────────────────────────────────────────────
function PendingJoinRow({
  join,
  isSelected,
  onToggle,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: {
  join: PendingJoin
  isSelected: boolean
  onToggle: () => void
  onApprove: () => void
  onReject: (kick?: boolean) => void
  isApproving: boolean
  isRejecting: boolean
}) {
  const [showKick, setShowKick] = useState(false)

  const statusBadge = {
    pending: <Badge variant="warning">Pending</Badge>,
    approved: <Badge variant="success">Approved</Badge>,
    rejected: <Badge variant="destructive">Rejected</Badge>,
  }

  return (
    <tr className="hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggle()}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <AvatarCircle username={join.username} avatarUrl={join.avatarUrl} />
          <span className="text-sm font-medium text-foreground">{join.username}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-muted-foreground font-mono">{join.discordId}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-muted-foreground">{formatDate(join.joinedAt)}</span>
      </td>
      <td className="px-4 py-3">{statusBadge[join.status]}</td>
      <td className="px-4 py-3">
        {join.status === 'pending' ? (
          <div className="flex items-center justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
              onClick={onApprove}
              disabled={isApproving}
            >
              <IconCheck size={13} className="mr-1" />
              Approve
            </Button>
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                onClick={() => setShowKick((v) => !v)}
                disabled={isRejecting}
              >
                <IconX size={13} className="mr-1" />
                Reject
              </Button>
              {showKick && (
                <div
                  className="absolute right-0 top-full mt-1 z-10 rounded-lg border border-border p-3 shadow-xl space-y-2 min-w-[160px]"
                  style={{ background: 'hsl(var(--popover))' }}
                >
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-7 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                    onClick={() => {
                      onReject(false)
                      setShowKick(false)
                    }}
                  >
                    Reject only
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-7 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                    onClick={() => {
                      onReject(true)
                      setShowKick(false)
                    }}
                  >
                    Reject &amp; Kick
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-end">
            {join.reviewedBy && (
              <span className="text-xs text-muted-foreground">
                by {join.reviewedBy}
                {join.reviewedAt ? ` on ${formatDate(join.reviewedAt)}` : ''}
              </span>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}
