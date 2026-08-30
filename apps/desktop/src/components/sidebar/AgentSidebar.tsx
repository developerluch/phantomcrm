import { useEffect, useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  IconAlertTriangle,
  IconX,
  IconSend,
  IconBell,
  IconArrowsExchange,
  IconUser,
  IconShieldCheck,
  IconId,
  IconMail,
  IconMapPin,
  IconBriefcase,
  IconCalendar,
  IconLoader2,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useNavigate } from 'react-router-dom'
import { useAgentSidebar } from '../../hooks/useAgentSidebar'
import { useAgentSalesAnalytics, useAgentWavvMetrics, useAgentRecruitsAnalytics } from '../../hooks/useAgentAnalytics'
import { api } from '../../services/api'
import { STAGE_NAMES, STAGE_COLORS } from '../../types/agent'
import type { AgentDetail } from '../../types/agent'
import type { License } from '../../types/portal'
import { SalesPerformanceCard } from '../agents/SalesPerformanceCard'
import { WavvMetricsCard } from '../agents/WavvMetricsCard'
import { RecruitingCard } from '../agents/RecruitingCard'
import { timeAgo } from '../agents/analytics-helpers'

// ── Types ──────────────────────────────────────────────────────────────────

type TabKey = 'production' | 'sales' | 'recruits' | 'details'

// ── Tabs Configuration ─────────────────────────────────────────────────────

const TABS: { key: TabKey; label: string }[] = [
  { key: 'production', label: 'Production' },
  { key: 'sales', label: 'Sales' },
  { key: 'recruits', label: 'Recruits' },
  { key: 'details', label: 'Details' },
]

// ── Main Component ─────────────────────────────────────────────────────────

export function AgentSidebar() {
  const { isOpen, activeDiscordId, activeTab, close, setTab } = useAgentSidebar()
  const navigate = useNavigate()
  const [showStageDropdown, setShowStageDropdown] = useState(false)

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    },
    [close],
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  // Reset stage dropdown when sidebar closes
  useEffect(() => {
    if (!isOpen) setShowStageDropdown(false)
  }, [isOpen])

  // ── Data Fetching ──────────────────────────────────────────────────────

  const { data: agentDetail, isLoading: loadingAgent, isError: agentError } = useQuery({
    queryKey: ['sidebar-agent', activeDiscordId],
    queryFn: () => api.getAgent(activeDiscordId!),
    enabled: isOpen && !!activeDiscordId,
    retry: 1,
    staleTime: 30_000,
  })

  const { data: salesData } = useAgentSalesAnalytics(
    isOpen && activeTab === 'sales' ? (activeDiscordId ?? null) : null
  )

  const { data: wavvData } = useAgentWavvMetrics(
    isOpen && activeTab === 'production' ? (activeDiscordId ?? null) : null
  )

  const { data: recruitsData } = useAgentRecruitsAnalytics(
    isOpen && activeTab === 'recruits' ? (activeDiscordId ?? null) : null
  )

  const { data: licenses } = useQuery({
    queryKey: ['sidebar-licenses', activeDiscordId],
    queryFn: () => api.getLicenses({ agentId: activeDiscordId! }),
    enabled: isOpen && !!activeDiscordId && activeTab === 'details',
  })

  // Discord member data (roles, username)
  const { data: discordMember } = useQuery({
    queryKey: ['discord-member', activeDiscordId],
    queryFn: () => api.lookupDiscordMember(activeDiscordId!),
    enabled: isOpen && !!activeDiscordId,
    staleTime: 5 * 60 * 1000,
  })

  // ── Derived values ─────────────────────────────────────────────────────

  const stageNum = agentDetail?.current_stage ?? 0
  const stageName = STAGE_NAMES[stageNum] ?? 'Unknown'
  const stageColor = STAGE_COLORS[stageNum] ?? '#6b7280'
  const displayName = agentDetail?.full_name || `Agent ${activeDiscordId}`
  const initials = agentDetail?.full_name
    ? agentDetail.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={close}
      />

      {/* Sidebar Panel */}
      <div
        className={`fixed right-0 top-0 z-50 h-full w-[420px] max-w-full border-l border-border bg-card shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="shrink-0 border-b border-border px-5 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-full border text-sm font-bold"
                style={{
                  background: `color-mix(in srgb, ${stageColor} 20%, hsl(var(--card)))`,
                  borderColor: `color-mix(in srgb, ${stageColor} 35%, transparent)`,
                  color: stageColor,
                }}
              >
                {initials}
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">{displayName}</h3>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: stageColor }}
                  />
                  <span className="text-xs text-muted-foreground">{stageName}</span>
                  {agentDetail?.last_active && (
                    <span className="text-xs text-muted-foreground">
                      · Active {timeAgo(agentDetail.last_active)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={close}>
              <IconX size={18} />
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setTab(v as TabKey)} className="mt-4">
            <TabsList className="w-full">
              {TABS.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key} className="flex-1 text-xs">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loadingAgent ? (
            <div className="flex h-40 items-center justify-center">
              <IconLoader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : agentError ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <IconAlertTriangle size={28} className="text-destructive" />
              <p className="text-sm text-muted-foreground">Failed to load agent profile.</p>
            </div>
          ) : (
            <>
              {activeTab === 'production' && (
                <WavvMetricsCard data={wavvData ?? null} compact />
              )}
              {activeTab === 'sales' && (
                <SalesPerformanceCard
                  sales={salesData?.sales ?? []}
                  stats={salesData?.stats ?? null}
                  compact
                />
              )}
              {activeTab === 'recruits' && (
                <RecruitingCard data={recruitsData ?? null} compact />
              )}
              {activeTab === 'details' && (
                <DetailsTab agent={agentDetail ?? null} licenses={licenses ?? []} discordMember={discordMember ?? null} />
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 border-t border-border px-5 py-3">
          <div className="grid grid-cols-2 gap-2">
            <FooterButton
              icon={<IconSend size={14} />}
              label="Send Message"
              onClick={() => {
                if (activeDiscordId) {
                  api
                    .fetchMutate(`/api/v1/agents/${activeDiscordId}/message`, 'POST', {
                      message: 'Checking in! How are things going?',
                    })
                    .catch(() => {})
                }
              }}
            />
            <FooterButton
              icon={<IconBell size={14} />}
              label="Send Nudge"
              onClick={() => {
                if (activeDiscordId) {
                  api
                    .fetchMutate(`/api/v1/agents/${activeDiscordId}/message`, 'POST', {
                      message: "Hey! Just a friendly nudge to keep things moving. Let us know if you need anything!",
                    })
                    .catch(() => {})
                }
              }}
            />
            <DropdownMenu open={showStageDropdown} onOpenChange={setShowStageDropdown}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <IconArrowsExchange size={14} />
                  Change Stage
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-48">
                {Object.entries(STAGE_NAMES).map(([num, name]) => (
                  <DropdownMenuItem
                    key={num}
                    className={Number(num) === stageNum ? 'text-blue-400 font-medium' : ''}
                    onClick={() => {
                      if (activeDiscordId) {
                        api
                          .fetchMutate(`/api/v1/agents/${activeDiscordId}/stage`, 'POST', {
                            stage: Number(num),
                          })
                          .catch(() => {})
                      }
                    }}
                  >
                    <span
                      className="mr-2 inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: STAGE_COLORS[Number(num)] }}
                    />
                    {name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <FooterButton
              icon={<IconUser size={14} />}
              label="Full Profile"
              onClick={() => {
                if (activeDiscordId) {
                  navigate(`/agents/${activeDiscordId}`)
                  close()
                }
              }}
            />
          </div>
        </div>
      </div>
    </>
  )
}

// ── Tab Content Components ─────────────────────────────────────────────────

function DetailsTab({
  agent,
  licenses,
  discordMember,
}: {
  agent: AgentDetail | null
  licenses: License[]
  discordMember: import('../../types/portal').DiscordMemberLookup | null
}) {
  if (!agent) return null

  return (
    <div className="space-y-4">
      {/* Profile Info */}
      <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Profile</h4>
        <InfoRow icon={<IconId size={13} />} label="Discord ID" value={String(agent.discord_id)} />
        {discordMember?.username && discordMember.username !== agent.full_name && (
          <InfoRow icon={<IconUser size={13} />} label="Discord" value={`@${discordMember.username}`} />
        )}
        <InfoRow icon={<IconBriefcase size={13} />} label="Agency" value={agent.agency} />
        <InfoRow icon={<IconMapPin size={13} />} label="State" value={agent.resident_state} />
        <InfoRow
          icon={<IconUser size={13} />}
          label="Experience"
          value={agent.experience_level}
        />
        <InfoRow
          icon={<IconUser size={13} />}
          label="Upline"
          value={agent.upline_manager}
        />
        <InfoRow
          icon={<IconCalendar size={13} />}
          label="Joined"
          value={agent.joined_at ? new Date(agent.joined_at).toLocaleDateString() : null}
        />
      </div>

      {/* Discord Roles */}
      {discordMember?.roles && discordMember.roles.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
          <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Discord Roles</h4>
          <div className="flex flex-wrap gap-1">
            {discordMember.roles.map((role) => (
              <Badge key={role} variant="outline" className="text-xs">
                {role}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* License Status */}
      <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">License</h4>
        <InfoRow
          icon={<IconShieldCheck size={13} />}
          label="Status"
          value={agent.npn ? 'Verified' : 'Not Verified'}
          valueColor={agent.npn ? 'text-emerald-400' : 'text-amber-400'}
        />
        {agent.npn && <InfoRow icon={<IconId size={13} />} label="NPN" value={agent.npn} />}
        {agent.license_number && (
          <InfoRow icon={<IconId size={13} />} label="License #" value={agent.license_number} />
        )}
        {agent.verified_at && (
          <InfoRow
            icon={<IconCalendar size={13} />}
            label="Verified"
            value={new Date(agent.verified_at).toLocaleDateString()}
          />
        )}

        {/* Additional licenses */}
        {licenses.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              State Licenses
            </span>
            {licenses.map((lic) => (
              <div
                key={lic.id}
                className="flex items-center justify-between rounded-md bg-card/50 px-2.5 py-1.5 text-xs"
              >
                <span className="text-foreground">{lic.state}</span>
                <Badge className={`text-[10px] ${
                  lic.status === 'VERIFIED' ? 'bg-emerald-500/20 text-emerald-400' :
                  lic.status === 'PENDING' ? 'bg-amber-500/20 text-amber-400' :
                  lic.status === 'EXPIRED' ? 'bg-red-500/20 text-red-400' :
                  'bg-zinc-500/20 text-muted-foreground'
                }`}>
                  {lic.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Contact Info */}
      <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Contact</h4>
        <InfoRow
          icon={<IconMail size={13} />}
          label="Lead Source"
          value={agent.lead_source}
        />
        <InfoRow
          icon={<IconBell size={13} />}
          label="Notifications"
          value={agent.notification_pref ?? 'Default'}
        />
      </div>

      {/* Onboarding Progress */}
      <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Onboarding Progress
        </h4>
        <ProgressRow label="Contracting Booked" done={agent.contracting_booked > 0} />
        <ProgressRow label="Contracting Completed" done={agent.contracting_completed > 0} />
        <ProgressRow label="Setup Completed" done={agent.setup_completed > 0} />
        <InfoRow
          icon={<IconCalendar size={13} />}
          label="Form Completed"
          value={
            agent.form_completed_at
              ? new Date(agent.form_completed_at).toLocaleDateString()
              : null
          }
        />
        <InfoRow
          icon={<IconCalendar size={13} />}
          label="Activated"
          value={
            agent.activated_at ? new Date(agent.activated_at).toLocaleDateString() : null
          }
        />
      </div>
    </div>
  )
}

// ── Shared Sub-Components ──────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
  valueColor,
}: {
  icon?: React.ReactNode
  label: string
  value?: string | null
  valueColor?: string
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={valueColor ?? 'text-foreground'}>{value || '\u2014'}</span>
    </div>
  )
}

function ProgressRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Badge className={`text-[10px] ${done ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted/50 text-muted-foreground'}`}>
        {done ? 'Done' : 'Pending'}
      </Badge>
    </div>
  )
}

function FooterButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={onClick}>
      {icon}
      {label}
    </Button>
  )
}
