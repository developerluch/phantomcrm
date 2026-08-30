import { memo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Handle, Position } from '@xyflow/react'
import { AGENT_ROLE_LABELS, AGENT_ROLE_COLORS } from '../../types/portal'
import type { AgentRole } from '../../types/portal'
import { NODE_WIDTH, NODE_HEIGHT, MANAGER_NODE_WIDTH, MANAGER_NODE_HEIGHT, capitalizeWords } from './constants'
import type { AgentNodeData } from './types'

export const AgentNode = memo(function AgentNode({ data }: { data: AgentNodeData }) {
  const { agent, isManager, isValidTarget, isDragTarget } = data
  const compTier = agent.profile?.compTier
  const photoUrl = agent.profile?.photoUrl

  const rawName = (agent.firstName || agent.lastName)
    ? `${agent.firstName || ''} ${agent.lastName || ''}`.trim()
    : agent.discordUsername || agent.email || 'Unnamed Agent'
  const displayName = capitalizeWords(rawName)
  const initials = agent.firstName && agent.lastName
    ? `${agent.firstName[0].toUpperCase()}${agent.lastName[0].toUpperCase()}`
    : displayName === 'Unnamed Agent' ? '?' : displayName[0].toUpperCase()

  const hasManager = !!agent.profile?.managerId
  const stageName = agent.stage?.name ?? 'Unknown'
  const stageColor = agent.stage?.color ?? '#6b7280'

  const w = isManager ? MANAGER_NODE_WIDTH : NODE_WIDTH
  const h = isManager ? MANAGER_NODE_HEIGHT : NODE_HEIGHT

  return (
    <div
      className={`
        org-node rounded-2xl transition-shadow duration-150 relative
        ${isManager
          ? 'border-2 border-amber-500/60 shadow-xl shadow-amber-500/10'
          : 'border border-border/40 shadow-lg'
        }
        ${isValidTarget
          ? 'ring-3 ring-emerald-400/80 scale-[1.02] shadow-emerald-500/30 shadow-2xl border-emerald-400/60'
          : ''
        }
        ${isDragTarget
          ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-zinc-900 scale-105 transition-transform'
          : ''
        }
      `}
      style={{
        width: w,
        height: h,
        minWidth: w,
        minHeight: h,
        background: isManager
          ? 'linear-gradient(145deg, #131320, #1a1528)'
          : 'linear-gradient(145deg, #0e0e14, #15151e)',
      }}
    >
      {/* Top handle: receives connections (INPUT) */}
      <Handle type="target" position={Position.Top} />

      {/* Card content */}
      <div className="flex flex-col h-full p-5 gap-3">
        {/* Top row: avatar + name + badge */}
        <div className="flex items-center gap-4">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={displayName}
              className={`rounded-xl shrink-0 object-cover ${isManager
                ? 'h-16 w-16 ring-2 ring-amber-500/40'
                : 'h-14 w-14'
              }`}
            />
          ) : (
            <div
              className={`flex items-center justify-center rounded-xl shrink-0 font-bold ${isManager
                ? 'h-16 w-16 bg-amber-900/50 text-amber-300 ring-2 ring-amber-500/40 text-2xl'
                : 'h-14 w-14 bg-muted/80 text-foreground text-xl'
                }`}
            >
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className={`font-bold text-foreground truncate ${isManager ? 'text-2xl' : 'text-xl'}`}>
              {displayName}
            </p>
            {agent.role && (
              <Badge
                className="text-[9px] px-1.5 py-0.5"
                style={{
                  background: `${AGENT_ROLE_COLORS[agent.role as AgentRole] ?? '#6b7280'}20`,
                  color: AGENT_ROLE_COLORS[agent.role as AgentRole] ?? '#6b7280',
                }}
              >
                {AGENT_ROLE_LABELS[agent.role as AgentRole] ?? agent.role}
              </Badge>
            )}
            {isManager && (
              <span className="inline-block mt-1.5 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Manager
              </span>
            )}
            {!isManager && hasManager && (
              <p className="text-sm text-muted-foreground mt-1">Reports to manager</p>
            )}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bottom row: stage + comp tier */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Stage pill */}
          <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-4 py-2 border border-border/40">
            <span
              className="inline-block h-3.5 w-3.5 rounded-full ring-1 ring-white/10"
              style={{ backgroundColor: stageColor }}
            />
            <span className="text-base text-foreground">{stageName}</span>
          </div>
          {/* Comp tier */}
          {compTier && (
            <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-4 py-2 border border-border/40">
              <span className="text-base text-muted-foreground">{compTier.name}</span>
              <span className="text-base font-semibold text-blue-400">{compTier.percentage}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom handle: starts connections (OUTPUT) */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={isManager ? undefined : { opacity: 0.3, width: 12, height: 12 }}
      />
    </div>
  )
})
