import { Badge } from '@/components/ui/badge'
import { IconAlertTriangle, IconCircleCheck, IconChevronRight } from '@tabler/icons-react'
import type { AtRiskAgent } from '../types/agent'
import { STAGE_NAMES } from '../types/agent'

interface Props {
  agents: AtRiskAgent[]
  onAgentClick?: (discordId: string) => void
}

export default function AtRiskBanner({ agents, onAgentClick }: Props) {
  if (agents.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2 px-4">
        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
          <IconCircleCheck size={15} className="text-emerald-400" />
        </div>
        <p className="text-emerald-400 text-sm font-medium">All recruits are on track.</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header — always visible */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2">
        <span className="w-5 h-5 rounded-md bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <IconAlertTriangle size={11} className="text-red-400" />
        </span>
        <span className="text-xs font-bold text-red-400">At-Risk Agents</span>
        <Badge className="bg-red-500 text-white border-0 px-1.5 py-0 text-[10px] leading-tight">{agents.length}</Badge>
      </div>

      {/* Scrollable agent list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1 custom-scrollbar">
        {agents.map((agent) => (
          <div
            key={agent.discord_id}
            onClick={() => onAgentClick?.(agent.discord_id)}
            className="flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-red-500/25 hover:bg-red-500/5 group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-[10px] font-bold text-red-400 shrink-0">
                {(agent.full_name || '?')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{agent.full_name || `User ${agent.discord_id}`}</p>
                {agent.agency && <p className="text-[10px] text-muted-foreground truncate">{agent.agency}</p>}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              <Badge variant="destructive" className="text-[9px] px-1.5 py-0">{agent.risk_reason}</Badge>
              <span className="text-[10px] text-muted-foreground hidden lg:block">{STAGE_NAMES[agent.current_stage] || ''}</span>
              <IconChevronRight size={11} className="text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
