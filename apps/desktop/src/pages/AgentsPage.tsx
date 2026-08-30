import { useState, useEffect, useCallback } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { useNavigate, useLocation } from 'react-router-dom'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useWebSocketContext } from '../contexts/WebSocketContext'
import { api, ApiError } from '../services/api'
import { toast } from 'sonner'
import { LeadsTab } from '../components/agents/leads-tab'
import { TrainingTab } from '../components/agents/training-tab'
import { ScheduleTab } from '../components/agents/schedule-tab'
import {
  IconCloudDownload,
  IconChevronRight,
  IconChevronDown,
  IconCertificate,
  IconClock,
  IconUser,
  IconBriefcase,
  IconNotes,
  IconCalendar,
  IconChartBar,
  IconBook,
  IconX,
  IconTrash,
  IconArrowLeft,
} from '@tabler/icons-react'

// ── Types for admin portal agent response ──────────────────────────
interface Stage {
  id: string
  name: string
  slug: string
  color: string
  order: number
}

interface AgentRow {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  state: string | null
  agency: string | null
  licenseStatus: string
  discordUsername: string | null
  stageId: string
  notes: string | null
  createdAt: string
  updatedAt: string
  stage: Stage
}

interface AgentsResponse {
  data: AgentRow[]
  total: number
  page: number
  perPage: number
  pageCount: number
}

// ── Stage colors fallback ──────────────────────────────────────────
const STAGE_COLORS: Record<string, string> = {
  joined: '#95a5a6',
  'form-started': '#3498db',
  sorted: '#2980b9',
  student: '#f39c12',
  licensed: '#27ae60',
  contracting: '#9b59b6',
  setup: '#e67e22',
  active: '#2ecc71',
}

function getStageColor(stage: Stage): string {
  return stage.color || STAGE_COLORS[stage.slug] || '#64748b'
}

// ── Helpers ────────────────────────────────────────────────────────
function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}

function getDisplayName(agent: AgentRow): string {
  const first = agent.firstName?.trim() ?? ''
  const last = agent.lastName?.trim() ?? ''
  const full = [first, last].filter(Boolean).join(' ')
  if (full) return capitalizeWords(full)
  if (agent.discordUsername) return agent.discordUsername
  if (agent.email) return agent.email
  return 'Unnamed Agent'
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'
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

function licenseBadgeColor(status: string): { bg: string; text: string; border: string } {
  switch (status) {
    case 'licensed':
      return { bg: 'rgba(39,174,96,0.15)', text: '#27ae60', border: 'rgba(39,174,96,0.3)' }
    case 'pending':
      return { bg: 'rgba(243,156,18,0.15)', text: '#f39c12', border: 'rgba(243,156,18,0.3)' }
    case 'expired':
      return { bg: 'rgba(231,76,60,0.15)', text: '#e74c3c', border: 'rgba(231,76,60,0.3)' }
    default:
      return { bg: 'rgba(148,163,184,0.1)', text: '#94a3b8', border: 'rgba(148,163,184,0.2)' }
  }
}

function licenseLabel(status: string): string {
  if (status === 'licensed') return 'Licensed'
  if (status === 'pending') return 'Pending'
  if (status === 'expired') return 'Expired'
  return 'No License'
}

// ── Tab types for expanded agent ──────────────────────────────────
type AgentTab = 'overview' | 'leads' | 'training' | 'schedule'

// ── Hook: fetch agents from admin portal ──────────────────────────
function useAdminAgents(params: {
  search?: string
  stage?: string
  agency?: string
  page: number
  perPage: number
}) {
  return useQuery({
    queryKey: ['admin-agents', params],
    queryFn: async () => {
      const query = new URLSearchParams()
      if (params.search) query.set('search', params.search)
      if (params.stage) query.set('stage', params.stage)
      if (params.page) query.set('page', String(params.page))
      query.set('perPage', String(params.perPage))
      const qs = query.toString()
      return api.fetch<AgentsResponse>(`/api/v1/agents${qs ? `?${qs}` : ''}`)
    },
    refetchInterval: (query) =>
      query.state.error instanceof ApiError && query.state.error.status === 429
        ? false
        : 60000,
  })
}

// ── Hook: fetch stages from admin portal ──────────────────────────
function useStages() {
  return useQuery({
    queryKey: ['stages'],
    queryFn: () => api.fetch<Stage[]>('/api/v1/stages'),
  })
}

// ── Expanded Agent Panel ──────────────────────────────────────────
function AgentExpandedPanel({
  agent,
  stageColor,
  onClose,
}: {
  agent: AgentRow
  stageColor: string
  onClose: () => void
}) {
  const [activeTab, setActiveTab] = useState<AgentTab>('overview')
  const displayName = getDisplayName(agent)

  const tabs: { key: AgentTab; label: string; icon: typeof IconUser }[] = [
    { key: 'overview', label: 'Overview', icon: IconChartBar },
    { key: 'leads', label: 'Leads', icon: IconBriefcase },
    { key: 'training', label: 'Training', icon: IconBook },
    { key: 'schedule', label: 'Schedule', icon: IconCalendar },
  ]

  return (
    <div
      className="border rounded-xl overflow-hidden animate-fade-in pt-6"
      style={{
        background: 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--popover)) 100%)',
        borderColor: `color-mix(in srgb, ${stageColor} 20%, #1f2937)`,
      }}
    >
      {/* Expanded header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 border"
            style={{
              background: `color-mix(in srgb, ${stageColor} 20%, hsl(var(--card)))`,
              borderColor: `color-mix(in srgb, ${stageColor} 35%, transparent)`,
              color: stageColor,
            }}
          >
            {getInitials(displayName)}
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">{displayName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {agent.email}
              {agent.agency && <span className="text-muted-foreground"> · {agent.agency}</span>}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="p-1.5 h-auto w-auto"
        >
          <IconX size={16} />
        </Button>
      </div>

      {/* Info bar */}
      <div className="flex flex-wrap gap-3 px-5 py-3 border-b border-border/30">
        <InfoPill label="Stage" value={agent.stage.name} color={stageColor} />
        <InfoPill label="License" value={licenseLabel(agent.licenseStatus)} color={licenseBadgeColor(agent.licenseStatus).text} />
        {agent.state && <InfoPill label="State" value={agent.state} />}
        {agent.phone && <InfoPill label="Phone" value={agent.phone} />}
        <InfoPill label="Joined" value={timeAgo(agent.createdAt)} />
      </div>

      {/* Tab bar */}
      <div className="flex gap-0.5 px-4 pt-3 border-b border-border/30">
        {tabs.map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 rounded-t-lg text-xs font-medium h-auto px-3 py-2 transition-colors ${
              activeTab === tab.key
                ? 'bg-muted/60 text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            style={activeTab === tab.key ? { borderBottomColor: stageColor, borderBottomWidth: '2px' } : undefined}
          >
            <tab.icon size={13} />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Tab content — scrollable */}
      <div className="max-h-[320px] overflow-y-auto custom-scrollbar px-5 py-4">
        {activeTab === 'overview' && <OverviewContent agent={agent} />}
        {activeTab === 'leads' && <LeadsTab agentId={agent.id} />}
        {activeTab === 'training' && <TrainingTab agentId={agent.id} />}
        {activeTab === 'schedule' && <ScheduleTab agentId={agent.id} />}
      </div>
    </div>
  )
}

function InfoPill({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium" style={{ color: color || 'hsl(var(--foreground))' }}>
        {value}
      </span>
    </div>
  )
}

function OverviewContent({ agent }: { agent: AgentRow }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Stage" value={agent.stage.name} color={getStageColor(agent.stage)} />
        <StatCard label="License" value={licenseLabel(agent.licenseStatus)} color={licenseBadgeColor(agent.licenseStatus).text} />
        <StatCard label="Agency" value={agent.agency || 'Unassigned'} />
        <StatCard label="State" value={agent.state || 'N/A'} />
      </div>
      {agent.notes && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <IconNotes size={12} /> Notes
          </p>
          <p className="text-xs text-foreground bg-muted/40 rounded-lg px-3 py-2">{agent.notes}</p>
        </div>
      )}
      {!agent.notes && (
        <p className="text-xs text-muted-foreground text-center py-4">No additional notes for this agent.</p>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-muted/30 rounded-lg px-3 py-2.5 border border-border/50">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold mt-0.5" style={{ color: color || 'hsl(var(--foreground))' }}>
        {value}
      </p>
    </div>
  )
}

// ── Agent Card (collapsed) ────────────────────────────────────────
function AgentCardRow({
  agent,
  isExpanded,
  onClick,
}: {
  agent: AgentRow
  isExpanded: boolean
  onClick: () => void
}) {
  const stageColor = getStageColor(agent.stage)
  const displayName = getDisplayName(agent)
  const initials = getInitials(displayName)
  const licenseColors = licenseBadgeColor(agent.licenseStatus)

  return (
    <div
      onClick={onClick}
      className="group relative overflow-hidden cursor-pointer rounded-xl border transition-colors"
      style={{
        background: isExpanded
          ? `linear-gradient(135deg, color-mix(in srgb, ${stageColor} 5%, hsl(var(--card))), hsl(var(--muted)))`
          : 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)',
        borderColor: isExpanded
          ? `color-mix(in srgb, ${stageColor} 40%, #374151)`
          : `color-mix(in srgb, ${stageColor} 15%, #1f2937)`,
      }}
      onMouseEnter={(e) => {
        if (!isExpanded) {
          const el = e.currentTarget
          el.style.borderColor = `color-mix(in srgb, ${stageColor} 40%, #374151)`
        }
      }}
      onMouseLeave={(e) => {
        if (!isExpanded) {
          const el = e.currentTarget
          el.style.borderColor = `color-mix(in srgb, ${stageColor} 15%, #1f2937)`
        }
      }}
    >
      {/* Left stage bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-0.5 transition-colors group-hover:w-1"
        style={{ background: `linear-gradient(180deg, ${stageColor}, ${stageColor}60)` }}
      />

      <div className="flex items-center gap-4 px-5 py-3.5">
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border"
          style={{
            background: `color-mix(in srgb, ${stageColor} 20%, hsl(var(--card)))`,
            borderColor: `color-mix(in srgb, ${stageColor} 35%, transparent)`,
            color: stageColor,
          }}
        >
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {agent.agency || 'No agency'}
            {agent.state && <span className="text-muted-foreground"> · {agent.state}</span>}
          </p>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 shrink-0">
          <Badge
            className="hidden md:flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 border"
            style={{
              background: licenseColors.bg,
              color: licenseColors.text,
              borderColor: licenseColors.border,
            }}
          >
            <IconCertificate size={11} />
            {licenseLabel(agent.licenseStatus)}
          </Badge>

          <span className="text-[11px] text-muted-foreground hidden lg:flex items-center gap-1 w-16 justify-end">
            <IconClock size={11} />
            {timeAgo(agent.createdAt)}
          </span>

          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-md shrink-0"
            style={{
              background: `color-mix(in srgb, ${stageColor} 18%, transparent)`,
              color: stageColor,
              border: `1px solid color-mix(in srgb, ${stageColor} 30%, transparent)`,
            }}
          >
            {agent.stage.name}
          </span>

          {isExpanded ? (
            <IconChevronDown size={14} className="text-muted-foreground" />
          ) : (
            <IconChevronRight
              size={14}
              className="text-muted-foreground group-hover:text-muted-foreground transition-colors"
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────
const AGENCIES = [
  'TFC',
  'Radiant',
  'GBU',
  'TruLight',
  'Thrive',
  'The Point',
  'Synergy',
  'Illuminate',
  'Elite One',
  'Other',
] as const

// ── Embeddable content component (used by RecruitsPage tab) ───────
export function AgentsPageContent() {
  const queryClient = useQueryClient()
  const { subscribe } = useWebSocketContext()

  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('')
  const [agencyFilter, setAgencyFilter] = useState<string>('')
  const [importing, setImporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [showBulkImportConfirm, setShowBulkImportConfirm] = useState(false)
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [showDeleteAllConfirmFinal, setShowDeleteAllConfirmFinal] = useState(false)
  const perPage = 50

  const { data: stagesData } = useStages()
  const { data, isLoading } = useAdminAgents({
    search: search || undefined,
    stage: stageFilter || undefined,
    agency: agencyFilter || undefined,
    page,
    perPage,
  })

  // WebSocket: refresh on agent events
  useEffect(() => {
    const unsubs = [
      subscribe('agent_created', () =>
        queryClient.invalidateQueries({ queryKey: ['admin-agents'] })
      ),
      subscribe('bulk_import', () =>
        queryClient.invalidateQueries({ queryKey: ['admin-agents'] })
      ),
    ]
    return () => unsubs.forEach((u) => u())
  }, [subscribe, queryClient])

  const handleBulkImportStart = () => {
    setShowBulkImportConfirm(true)
  }

  const handleBulkImportConfirm = async () => {
    setShowBulkImportConfirm(false)
    setImporting(true)
    try {
      const result = await api.bulkImportAgents()
      toast.success(
        `Imported ${result.imported} new agents, ${result.skipped} already tracked, ${result.bots} bots skipped`
      )
      queryClient.invalidateQueries({ queryKey: ['admin-agents'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk import failed')
    } finally {
      setImporting(false)
    }
  }

  const handleDeleteAllStart = () => {
    setShowDeleteAllConfirm(true)
  }

  const handleDeleteAllSecond = () => {
    setShowDeleteAllConfirm(false)
    setShowDeleteAllConfirmFinal(true)
  }

  const handleDeleteAllConfirm = async () => {
    setShowDeleteAllConfirmFinal(false)
    setDeleting(true)
    try {
      const result = await api.deleteAllAgents()
      toast.success(`Removed ${result.deleted} agents`)
      queryClient.invalidateQueries({ queryKey: ['admin-agents'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  const toggleExpand = useCallback(
    (id: string) => {
      setExpandedId((prev) => (prev === id ? null : id))
    },
    []
  )

  const agents = data?.data ?? []
  const total = data?.total ?? 0

  return (
    <div className="animate-fade-in">
      {/* Filters + actions bar */}
      <div className="space-y-4 pb-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            <span className="text-foreground font-semibold">{total}</span> agent
            {total !== 1 ? 's' : ''}
            {stageFilter && ` in ${stageFilter}`}
            {agencyFilter && ` · ${agencyFilter}`}
          </p>
          <div className="flex items-center gap-2">
            {total > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteAllStart}
                disabled={deleting}
                className="text-red-400 border-red-500/30 hover:bg-red-500/10 hover:border-red-500/50"
              >
                <IconTrash size={16} />
                {deleting ? 'Removing...' : 'Remove All'}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkImportStart}
              disabled={importing}
            >
              <IconCloudDownload size={16} />
              {importing ? 'Importing...' : 'Import from Discord'}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2.5">
          <Input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="flex-1 min-w-[200px]"
          />
          <Select value={stageFilter || "_all"} onValueChange={(v) => { setStageFilter(v === "_all" ? "" : v); setPage(1) }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Stages</SelectItem>
              {stagesData?.map((s) => (
                <SelectItem key={s.id} value={s.slug}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={agencyFilter || "_all"} onValueChange={(v) => { setAgencyFilter(v === "_all" ? "" : v); setPage(1) }}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All Agencies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Agencies</SelectItem>
              {AGENCIES.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Agent list */}
      <div className="space-y-1.5 pb-4">
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-14 rounded-xl bg-card border border-border/50 animate-pulse"
              />
            ))}
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-muted-foreground text-sm">
              No agents found matching your filters.
            </p>
          </div>
        ) : (
          <>
            {agents.map((agent) => {
              const isExpanded = expandedId === agent.id
              return (
                <div key={agent.id}>
                  <AgentCardRow
                    agent={agent}
                    isExpanded={isExpanded}
                    onClick={() => toggleExpand(agent.id)}
                  />
                  {isExpanded && (
                    <div className="mt-1.5 mb-2">
                      <AgentExpandedPanel
                        agent={agent}
                        stageColor={getStageColor(agent.stage)}
                        onClose={() => setExpandedId(null)}
                      />
                    </div>
                  )}
                </div>
              )
            })}

            {/* Pagination */}
            {data && data.pageCount > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground">
                  Page {page} of {data.pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.pageCount}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bulk Import Confirmation Dialog */}
      <Dialog open={showBulkImportConfirm} onOpenChange={setShowBulkImportConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import from Discord</DialogTitle>
            <DialogDescription>
              This will import all members from your connected Discord server as agents. Bots and existing members will be skipped.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkImportConfirm(false)}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleBulkImportConfirm} disabled={importing}>
              {importing ? 'Importing...' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation Dialog - First Step */}
      <Dialog open={showDeleteAllConfirm} onOpenChange={setShowDeleteAllConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove All Agents</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove ALL agents? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteAllConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAllSecond}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete All Confirmation Dialog - Final Step */}
      <Dialog open={showDeleteAllConfirmFinal} onOpenChange={setShowDeleteAllConfirmFinal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Final Deletion</DialogTitle>
            <DialogDescription>
              This will permanently delete {total} agents. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteAllConfirmFinal(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAllConfirm} disabled={deleting}>
              {deleting ? 'Removing...' : 'Delete All'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Standalone page wrapper (kept for /agents route compatibility) ──
export default function AgentsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const cameFromOrgChart = location.state?.from === 'org-chart'

  return (
    <div className="animate-fade-in">
      <div className="mb-4">
        {cameFromOrgChart && (
          <Button variant="ghost" size="sm" onClick={() => navigate('/org-chart')} className="mb-2">
            <IconArrowLeft size={14} className="mr-1.5" />
            Back to Org Chart
          </Button>
        )}
        <h1 className="text-xl font-bold text-foreground">Agents</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage your team of insurance agents
        </p>
      </div>
      <AgentsPageContent />
    </div>
  )
}
