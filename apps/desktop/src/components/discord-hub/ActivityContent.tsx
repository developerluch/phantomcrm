import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useActivityLog } from '../../hooks/useActivity'
import {
  IconActivity,
  IconUserPlus,
  IconArrowRight,
  IconMessage,
  IconCurrencyDollar,
  IconCertificate,
  IconCheck,
  IconAlertTriangle,
  IconShieldCheck,
  IconLogin,
  IconX,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { containerVariants, itemVariants } from '@/lib/motion'
import type { ActivityLogEntry } from '../../types/portal'

const ACTION_CONFIG: Record<string, { icon: typeof IconActivity; color: string; bg: string }> = {
  agent_created: { icon: IconUserPlus, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  stage_change: { icon: IconArrowRight, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  message_sent: { icon: IconMessage, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  sale_created: { icon: IconCurrencyDollar, color: 'text-green-400', bg: 'bg-green-500/10' },
  recruit_created: { icon: IconUserPlus, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  license_added: { icon: IconCertificate, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  got_licensed: { icon: IconCertificate, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  on_track: { icon: IconCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  need_help: { icon: IconAlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
  completed_rules_screening: { icon: IconShieldCheck, color: 'text-teal-400', bg: 'bg-teal-500/10' },
  member_joined: { icon: IconLogin, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  form_started: { icon: IconActivity, color: 'text-sky-400', bg: 'bg-sky-500/10' },
  form_completed: { icon: IconCheck, color: 'text-sky-400', bg: 'bg-sky-500/10' },
  agent_kicked: { icon: IconAlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
  role_assigned: { icon: IconShieldCheck, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
  approval_granted: { icon: IconCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  approval_rejected: { icon: IconAlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
}

const ACTION_LABELS: Record<string, string> = {
  agent_created: 'New agent joined the system',
  stage_change: 'Agent moved to a new stage',
  message_sent: 'Message sent in Discord',
  sale_created: 'New sale recorded',
  recruit_created: 'New recruit added to pipeline',
  license_added: 'License added to agent profile',
  got_licensed: 'Agent received their license',
  on_track: 'Agent marked as on-track',
  need_help: 'Agent flagged as needing help',
  completed_rules_screening: 'Completed rules screening',
  member_joined: 'New member joined the server',
  form_started: 'Agent started onboarding form',
  form_completed: 'Agent completed onboarding form',
  agent_kicked: 'Agent was removed from server',
  role_assigned: 'Role assigned to member',
  approval_granted: 'Join request approved',
  approval_rejected: 'Join request rejected',
}

function groupByDate(entries: ActivityLogEntry[]): { label: string; entries: ActivityLogEntry[] }[] {
  const groups = new Map<string, ActivityLogEntry[]>()
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86_400_000).toDateString()

  for (const entry of entries) {
    const dateStr = new Date(entry.createdAt).toDateString()
    const label =
      dateStr === today ? 'Today' :
      dateStr === yesterday ? 'Yesterday' :
      new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(entry)
  }
  return Array.from(groups, ([label, entries]) => ({ label, entries }))
}

interface ActivityContentProps {
  guildId?: string
  actionFilter?: string
}

export default function ActivityContent({ guildId, actionFilter = '' }: ActivityContentProps) {
  const [selectedEntry, setSelectedEntry] = useState<ActivityLogEntry | null>(null)
  const { data: activities = [], isLoading, isError } = useActivityLog({
    guild_id: guildId || undefined,
    action_type: actionFilter || undefined,
    limit: 50,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Failed to load activity log.</p>
      </div>
    )
  }

  const grouped = groupByDate(activities)

  return (
    <motion.div className="space-y-4" variants={containerVariants} initial="hidden" animate="visible">
      {/* Timeline */}
      <motion.div variants={itemVariants} className="space-y-1">
        {grouped.map((group) => (
          <div key={group.label}>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest px-1 pt-5 pb-3 first:pt-0 border-b border-border/30 mb-3">
              {group.label}
            </div>
            {group.entries.map((entry, idx) => {
              const config = ACTION_CONFIG[entry.action] ?? { icon: IconActivity, color: 'text-muted-foreground', bg: 'bg-muted' }
              const Icon = config.icon
              const label = ACTION_LABELS[entry.action] ?? entry.action.replace(/_/g, ' ')
              const actor = entry.agent
                ? `${entry.agent.firstName} ${entry.agent.lastName}`
                : entry.user?.name ?? null

              return (
                <div
                  key={entry.id}
                  onClick={() => setSelectedEntry(entry)}
                  className={`flex items-start gap-3 relative pl-6 cursor-pointer rounded-lg transition-colors hover:bg-white/[0.03] ${
                    selectedEntry?.id === entry.id ? 'bg-white/[0.05]' : ''
                  }`}
                >
                  {/* Vertical connector line */}
                  {idx < group.entries.length - 1 && (
                    <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border/50" />
                  )}
                  {/* Icon dot */}
                  <div className={`relative z-10 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${config.bg}`}>
                    <Icon size={13} className={config.color} />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0 py-2">
                    <p className="text-sm text-foreground">
                      {label}
                      {actor && <span className="text-muted-foreground"> — {actor}</span>}
                    </p>
                    <span className="text-[11px] text-muted-foreground/60">
                      {new Date(entry.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        {activities.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <IconActivity size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No activity recorded</p>
          </div>
        )}
      </motion.div>

      {/* Detail drawer */}
      <AnimatePresence>
        {selectedEntry && (
          <motion.div
            key={selectedEntry.id}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="sticky bottom-0 mt-4 rounded-xl border border-border/60 bg-card shadow-lg shadow-black/20 overflow-hidden"
          >
            {/* Header bar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 bg-muted/30">
              <div className="flex items-center gap-3">
                {(() => {
                  const cfg = ACTION_CONFIG[selectedEntry.action] ?? { icon: IconActivity, color: 'text-muted-foreground', bg: 'bg-muted' }
                  const Ic = cfg.icon
                  return (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cfg.bg}`}>
                      <Ic size={15} className={cfg.color} />
                    </div>
                  )
                })()}
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {ACTION_LABELS[selectedEntry.action] ?? selectedEntry.action.replace(/_/g, ' ')}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(selectedEntry.createdAt).toLocaleString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', second: '2-digit',
                    })}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => { e.stopPropagation(); setSelectedEntry(null) }}
                className="w-7 h-7 rounded-full hover:bg-white/[0.06] transition-colors"
              >
                <IconX size={14} className="text-muted-foreground" />
              </Button>
            </div>

            {/* Detail grid */}
            <div className="px-5 py-4 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {selectedEntry.description && (
                <div className="col-span-2">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                  <p className="text-foreground">{selectedEntry.description}</p>
                </div>
              )}

              {selectedEntry.agent && (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Agent</p>
                  <p className="text-foreground">{selectedEntry.agent.firstName} {selectedEntry.agent.lastName}</p>
                </div>
              )}

              {selectedEntry.user?.name && (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Triggered By</p>
                  <p className="text-foreground">{selectedEntry.user.name}</p>
                </div>
              )}

              {selectedEntry.guildId && (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Server</p>
                  <p className="text-foreground font-mono text-xs">{selectedEntry.guildId}</p>
                </div>
              )}

              {selectedEntry.agentId && (
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Agent ID</p>
                  <p className="text-foreground font-mono text-xs">{selectedEntry.agentId}</p>
                </div>
              )}

              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Event ID</p>
                <p className="text-foreground font-mono text-xs">{selectedEntry.id}</p>
              </div>

              <div>
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Action Type</p>
                <p className="text-foreground font-mono text-xs">{selectedEntry.action}</p>
              </div>

              {selectedEntry.metadata && Object.keys(selectedEntry.metadata).length > 0 && (
                <div className="col-span-2 mt-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Additional Details</p>
                  <div className="rounded-lg bg-muted/30 border border-border/30 px-4 py-3 space-y-1.5">
                    {Object.entries(selectedEntry.metadata).map(([key, value]) => (
                      <div key={key} className="flex items-start gap-3">
                        <span className="text-[11px] text-muted-foreground font-mono min-w-[120px] shrink-0">{key}</span>
                        <span className="text-xs text-foreground break-all">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
