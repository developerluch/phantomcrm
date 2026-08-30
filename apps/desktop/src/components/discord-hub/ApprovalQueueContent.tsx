import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  usePendingJoins,
  useApprovePendingJoin,
  useRejectPendingJoin,
  useBulkPendingJoins,
} from '../../hooks/usePendingJoins'
import { toast } from 'sonner'
import { IconCheck, IconX, IconUserCheck } from '@tabler/icons-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { PendingJoin } from '../../types/portal'
import EmptyState from '../EmptyState'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { containerVariants, itemVariants } from '@/lib/motion'

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

function getUrgencyColor(joinedAt: string): string {
  const hours = (Date.now() - new Date(joinedAt).getTime()) / 3_600_000
  if (isNaN(hours)) return 'bg-emerald-400'
  if (hours < 24) return 'bg-emerald-400'
  if (hours < 72) return 'bg-amber-400'
  return 'bg-red-400'
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

export default function ApprovalQueueContent({ guildId }: { guildId?: string }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const { data, isLoading, isError } = usePendingJoins(guildId)
  const approve = useApprovePendingJoin()
  const reject = useRejectPendingJoin()
  const bulk = useBulkPendingJoins()

  const joins = data?.pendingJoins ?? []
  const pending = data?.totalPending ?? 0

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
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n })
    } catch {
      toast.error('Failed to approve')
    }
  }

  const handleReject = async (id: string, kick = false) => {
    try {
      await reject.mutateAsync({ id, kick })
      toast.success(kick ? 'Member rejected and kicked' : 'Member rejected')
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n })
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

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-muted/50 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Failed to load pending joins. Check your connection.</p>
      </div>
    )
  }

  if (joins.length === 0) {
    return (
      <EmptyState
        icon={IconUserCheck}
        title="No pending approvals"
        description="New join requests from your Discord server will appear here for review."
      />
    )
  }

  return (
    <motion.div className="space-y-4" variants={containerVariants} initial="hidden" animate="visible">
      {/* Bulk actions */}
      {selected.size > 0 && (
        <motion.div variants={itemVariants} className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">{selected.size} selected</span>
          <Button
            size="sm"
            variant="outline"
            className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
            onClick={() => handleBulk('approve')}
            disabled={bulk.isPending}
          >
            <IconCheck size={14} className="mr-1" /> Approve All
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-400 border-red-500/30 hover:bg-red-500/10"
            onClick={() => handleBulk('reject')}
            disabled={bulk.isPending}
          >
            <IconX size={14} className="mr-1" /> Reject All
          </Button>
        </motion.div>
      )}

      <motion.div variants={itemVariants}>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 w-10">
                  <Checkbox
                    checked={selected.size === joins.length && joins.length > 0}
                    onCheckedChange={toggleAll}
                    className="rounded border-border accent-blue-500 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Discord ID</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Joined</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider text-right">Actions</th>
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
          onCheckedChange={onToggle}
          className="rounded border-border accent-blue-500 cursor-pointer"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`w-2 h-2 rounded-full shrink-0 ${getUrgencyColor(join.joinedAt)}`} />
            </TooltipTrigger>
            <TooltipContent>{`Joined ${formatDate(join.joinedAt)}`}</TooltipContent>
          </Tooltip>
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
              <IconCheck size={13} className="mr-1" /> Approve
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                  disabled={isRejecting}
                >
                  <IconX size={13} className="mr-1" /> Reject
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onReject(false)}>
                  Reject only
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onReject(true)} className="text-red-400 focus:text-red-400">
                  Reject &amp; Kick
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
