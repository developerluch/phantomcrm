import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  IconCertificate,
  IconClock,
  IconAlertCircle,
  IconCircleCheck,
  IconBan,
  IconChevronRight,
} from '@tabler/icons-react'
import type { AgentSummary } from '../types/agent'
import { STAGE_NAMES, STAGE_COLORS } from '../types/agent'
import { useAgentSidebar } from '../hooks/useAgentSidebar'

interface Props {
  agent: AgentSummary
  onClick?: () => void
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1d ago'
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function LicenseIcon({ status }: { status: string | null }) {
  if (status === 'licensed') return <IconCircleCheck size={13} />
  if (status === 'pending') return <IconClock size={13} />
  if (status === 'expired') return <IconAlertCircle size={13} />
  return <IconBan size={13} />
}

function licenseBadgeVariant(status: string | null): 'success' | 'warning' | 'destructive' | 'outline' {
  if (status === 'licensed') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'expired') return 'destructive'
  return 'outline'
}

function licenseLabel(status: string | null): string {
  if (status === 'licensed') return 'Licensed'
  if (status === 'pending') return 'Pending'
  if (status === 'expired') return 'Expired'
  return 'No License'
}

export default function AgentCard({ agent, onClick }: Props) {
  const { open } = useAgentSidebar()
  const stageName = STAGE_NAMES[agent.current_stage] || 'Unknown'
  const stageColor = STAGE_COLORS[agent.current_stage] || '#64748b'
  const initials = agent.full_name
    ? agent.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  const handleClick = () => {
    open(String(agent.discord_id))
    onClick?.()
  }

  return (
    <Card
      onClick={handleClick}
      className={cn('group relative overflow-hidden cursor-pointer transition-shadow duration-150 animate-fade-in')}
      style={{
        background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)',
        borderColor: `color-mix(in srgb, ${stageColor} 15%, hsl(var(--border)))`,
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = `color-mix(in srgb, ${stageColor} 40%, hsl(var(--border)))`
        el.style.boxShadow = `0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px color-mix(in srgb, ${stageColor} 20%, transparent)`
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement
        el.style.borderColor = `color-mix(in srgb, ${stageColor} 15%, hsl(var(--border)))`
        el.style.boxShadow = ''
      }}
    >
      {/* Left stage bar */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 transition-colors group-hover:w-1"
        style={{ background: `linear-gradient(180deg, ${stageColor}, ${stageColor}60)` }} />

      <div className="flex items-center gap-4 px-5 py-3.5">
        {/* Avatar */}
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border"
          style={{
            background: `color-mix(in srgb, ${stageColor} 20%, hsl(var(--card)))`,
            borderColor: `color-mix(in srgb, ${stageColor} 35%, transparent)`,
            color: stageColor,
          }}>
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {agent.full_name || `User ${agent.discord_id}`}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {agent.agency || 'No agency'}
            {agent.upline_manager && (
              <span className="text-muted-foreground/40"> · {agent.upline_manager}</span>
            )}
          </p>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 shrink-0">
          <Badge variant={licenseBadgeVariant(agent.license_status)} className="hidden md:flex items-center gap-1 text-[10px] px-2 py-0.5">
            <LicenseIcon status={agent.license_status} />
            {licenseLabel(agent.license_status)}
          </Badge>

          <span className="text-[11px] text-muted-foreground/50 hidden lg:flex items-center gap-1 w-16 justify-end">
            <IconClock size={11} />
            {timeAgo(agent.last_active)}
          </span>

          <span className="text-[11px] font-bold px-2.5 py-1 rounded-md shrink-0"
            style={{
              background: `color-mix(in srgb, ${stageColor} 18%, transparent)`,
              color: stageColor,
              border: `1px solid color-mix(in srgb, ${stageColor} 30%, transparent)`,
            }}>
            {stageName}
          </span>

          <IconChevronRight size={14} className="text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
        </div>
      </div>
    </Card>
  )
}
