import { lazy, Suspense, useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { useQueryClient } from '@tanstack/react-query'
import { useRecruits, useRecruitStats, useUpdateRecruit } from '../hooks/useRecruits'
import { useWebSocketContext } from '../contexts/WebSocketContext'
import { RECRUIT_STAGES, RECRUIT_STAGE_COLORS, RECRUIT_STAGE_LABELS } from '../types/portal'
import type { Recruit, RecruitStage } from '../types/portal'
import RecruitDetailPanel from '../components/recruits/RecruitDetailPanel'
import CreateRecruitModal from '../components/recruits/CreateRecruitModal'
import AILeadImportWidget from '../components/recruits/AILeadImportWidget'
import CSVImportModal from '../components/recruits/CSVImportModal'
import MetricCard from '../components/MetricCard'
import { toast } from 'sonner'
import {
  IconUserPlus,
  IconUsers,
  IconTrendingUp,
  IconClock,
  IconPlus,
  IconChevronDown,
  IconChevronRight,
  IconUserCheck,
  IconBan,
  IconLayoutKanban,
  IconTable,
  IconSearch,
  IconArrowUp,
  IconArrowDown,
  IconX,
  IconFileSpreadsheet,
  IconCertificate,
  IconAlertTriangle,
  IconHierarchy2,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import EmptyState from '../components/EmptyState'
import KanbanColumn from '../components/recruits/KanbanColumn'
import RecruitCard from '../components/recruits/RecruitCard'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IconLayoutDashboard } from '@tabler/icons-react'
import { tabContentVariants } from '../lib/motion'

const MOUNT_SPRING = { type: 'spring' as const, stiffness: 300, damping: 24, mass: 0.8 }

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: MOUNT_SPRING },
}

// ── Stage grouping ──────────────────────────────────────────
const PIPELINE_STAGES: RecruitStage[] = [
  'NEW_LEAD', 'PREQUALIFIED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED',
  'ONBOARDING', 'IN_COURSE', 'LICENSED', 'CONTRACTING', 'ACTIVE',
]

function getNextStage(current: RecruitStage): RecruitStage | null {
  const idx = PIPELINE_STAGES.indexOf(current)
  if (idx === -1 || idx === PIPELINE_STAGES.length - 1) return null
  return PIPELINE_STAGES[idx + 1]
}

const TERMINAL_STAGES: { stage: RecruitStage; icon: typeof IconUserCheck; accent: string }[] = [
  { stage: 'REJECTED', icon: IconBan, accent: '#ef4444' },
]

const STAGE_GROUPS = [
  { name: 'Acquisition', stages: ['NEW_LEAD', 'PREQUALIFIED'] as RecruitStage[] },
  { name: 'Qualification', stages: ['INTERVIEW_SCHEDULED', 'INTERVIEWED'] as RecruitStage[] },
  { name: 'Onboarding', stages: ['ONBOARDING', 'IN_COURSE'] as RecruitStage[] },
  { name: 'Activation', stages: ['LICENSED', 'CONTRACTING', 'ACTIVE'] as RecruitStage[] },
]

const TAB_ORDER = ['dashboard', 'pipeline', 'agents', 'org-chart'] as const

const RecruitDashboard = lazy(() => import('../components/recruits/RecruitDashboard'))
const AgentsPageContent = lazy(() =>
  import('./AgentsPage').then((module) => ({ default: module.AgentsPageContent })),
)
const OrgChartPage = lazy(() => import('./OrgChartPage'))

function RecruitingTabFallback() {
  return (
    <Card className="h-full min-h-[18rem] bg-card/50 backdrop-blur border-border/50 p-5">
      <div className="h-5 w-36 rounded bg-muted/60 animate-pulse" />
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
      <div className="mt-4 h-40 rounded-lg bg-muted/20 animate-pulse" />
    </Card>
  )
}

// ── Main page component ─────────────────────────────────────
export default function RecruitsPage() {
  const { data, isLoading, isError } = useRecruits({ perPage: 200 })
  const { data: stats } = useRecruitStats()
  const updateRecruit = useUpdateRecruit()

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard')
  const [pipelineView, setPipelineView] = useState<'board' | 'table'>('board')
  const isPipelineBoard = viewMode === 'pipeline' && pipelineView === 'board'
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [tabDirection, setTabDirection] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [selectedRecruitIds, setSelectedRecruitIds] = useState<Set<string>>(new Set())
  const [sortColumn, setSortColumn] = useState<string>('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedRecruitId, setSelectedRecruitId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showCSVImport, setShowCSVImport] = useState(false)
  const [terminalExpanded, setTerminalExpanded] = useState<Record<string, boolean>>({})
  const [draggedRecruit, setDraggedRecruit] = useState<Recruit | null>(null)
  const [bulkStageTarget, setBulkStageTarget] = useState<RecruitStage>('NEW_LEAD')
  const [expandedStage, setExpandedStage] = useState<RecruitStage | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const { subscribe } = useWebSocketContext()
  const queryClient = useQueryClient()

  const handleViewModeChange = (newMode: ViewMode) => {
    const newIdx = TAB_ORDER.indexOf(newMode)
    const oldIdx = TAB_ORDER.indexOf(viewMode)
    setTabDirection(newIdx > oldIdx ? 1 : -1)
    setViewMode(newMode)
  }

  useEffect(() => {
    const unsub1 = subscribe('recruit:webhook_created', (data: unknown) => {
      const d = data as { recruitId: string; firstName: string; lastName: string; source: string }
      queryClient.invalidateQueries({ queryKey: ['recruits'] })
      queryClient.invalidateQueries({ queryKey: ['recruit-stats'] })
      toast.success(`New webhook lead: ${d.firstName} ${d.lastName}`, {
        description: `Source: ${d.source}`,
      })
    })
    const unsub2 = subscribe('recruit:created', () => {
      queryClient.invalidateQueries({ queryKey: ['recruits'] })
      queryClient.invalidateQueries({ queryKey: ['recruit-stats'] })
    })
    return () => { unsub1(); unsub2() }
  }, [subscribe, queryClient])

  // ── Filtering ───────────────────────────────────────────
  const sourceFilteredRecruits = useMemo(() => {
    let all = data?.recruits ?? []
    if (sourceFilter !== 'all') {
      all = all.filter((r) => r.leadSource === sourceFilter)
    }
    if (stageFilter !== 'all') {
      all = all.filter((r) => r.stage === stageFilter)
    }
    return all
  }, [data?.recruits, sourceFilter, stageFilter])

  const filteredRecruits = useMemo(() => {
    let list = sourceFilteredRecruits
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (r) =>
          `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q)
      )
    }
    return list
  }, [sourceFilteredRecruits, searchQuery])

  // ── Board: group by stage ───────────────────────────────
  const recruitsByStage = useMemo(() => {
    const map: Record<string, Recruit[]> = {}
    for (const stage of RECRUIT_STAGES) map[stage] = []
    for (const r of filteredRecruits) {
      if (map[r.stage]) map[r.stage].push(r)
    }
    return map
  }, [filteredRecruits])

  // ── Table: sorted list ──────────────────────────────────
  const sortedRecruits = useMemo(() => {
    const list = [...filteredRecruits]
    list.sort((a, b) => {
      let cmp = 0
      switch (sortColumn) {
        case 'name':
          cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
          break
        case 'email':
          cmp = a.email.localeCompare(b.email)
          break
        case 'stage':
          cmp = a.stage.localeCompare(b.stage)
          break
        case 'createdAt':
          cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        default:
          cmp = 0
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [filteredRecruits, sortColumn, sortDir])

  // ── DnD handlers ────────────────────────────────────────
  const handleDragStart = (event: DragStartEvent) => {
    const recruit = event.active.data.current?.recruit as Recruit | undefined
    if (recruit) setDraggedRecruit(recruit)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedRecruit(null)
    const { active, over } = event
    if (!over || !active.data.current) return
    const recruit = active.data.current.recruit as Recruit
    const newStage = over.id as RecruitStage
    if (recruit.stage === newStage) return

    updateRecruit.mutate(
      { id: recruit.id, data: { stage: newStage } },
      {
        onSuccess: () =>
          toast.success(`Moved to ${RECRUIT_STAGE_LABELS[newStage] ?? newStage}`),
        onError: () => toast.error('Failed to update stage'),
      }
    )
  }

  // ── Quick-action: advance recruit to next stage ─────────
  const handleAdvanceRecruit = (recruit: Recruit) => {
    const nextStage = getNextStage(recruit.stage)
    if (!nextStage) {
      toast.info(`${recruit.firstName} is already at the final stage`)
      return
    }
    updateRecruit.mutate(
      { id: recruit.id, data: { stage: nextStage } },
      {
        onSuccess: () =>
          toast.success(`${recruit.firstName} advanced to ${RECRUIT_STAGE_LABELS[nextStage]}`),
        onError: () => toast.error('Failed to advance stage'),
      }
    )
  }

  // ── Table helpers ───────────────────────────────────────
  const toggleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(col)
      setSortDir('asc')
    }
  }

  const toggleSelectAll = () => {
    if (selectedRecruitIds.size === sortedRecruits.length) {
      setSelectedRecruitIds(new Set())
    } else {
      setSelectedRecruitIds(new Set(sortedRecruits.map((r) => r.id)))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedRecruitIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBulkMove = () => {
    const ids = Array.from(selectedRecruitIds)
    if (ids.length === 0) return
    let completed = 0
    for (const id of ids) {
      updateRecruit.mutate(
        { id, data: { stage: bulkStageTarget } },
        {
          onSuccess: () => {
            completed++
            if (completed === ids.length) {
              toast.success(`Moved ${ids.length} recruit(s) to ${RECRUIT_STAGE_LABELS[bulkStageTarget]}`)
              setSelectedRecruitIds(new Set())
            }
          },
          onError: () => toast.error('Failed to move one or more recruits'),
        }
      )
    }
  }

  // ── Sort icon helper ────────────────────────────────────
  const SortIcon = ({ col }: { col: string }) => {
    if (sortColumn !== col) return null
    return sortDir === 'asc' ? (
      <IconArrowUp size={12} className="inline ml-0.5" />
    ) : (
      <IconArrowDown size={12} className="inline ml-0.5" />
    )
  }

  // ── Loading ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="h-7 w-44 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-80 rounded-xl bg-muted/30 animate-pulse" />
      </div>
    )
  }

  // ── Error ───────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Failed to load recruits. Check your connection.</p>
      </div>
    )
  }

  // ── Empty state ─────────────────────────────────────────
  if (data?.recruits?.length === 0) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">
        <PageHeader
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onAdd={() => setShowCreate(true)}
          onCSVImport={() => setShowCSVImport(true)}
        />
        <EmptyState
          icon={IconUserPlus}
          title="No recruits yet"
          description="Start building your pipeline by adding your first recruit."
          action={{ label: 'Add Recruit', onClick: () => setShowCreate(true) }}
        />
        <CreateRecruitModal open={showCreate} onClose={() => setShowCreate(false)} />
      <CSVImportModal open={showCSVImport} onClose={() => setShowCSVImport(false)} />
      </motion.div>
    )
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="flex h-full min-h-0 flex-col gap-3 overflow-hidden pt-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex-none">
        <PageHeader
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          onAdd={() => setShowCreate(true)}
          onCSVImport={() => setShowCSVImport(true)}
        />
      </motion.div>

      {/* Search bar + pipeline toolbar — only for pipeline view */}
      {viewMode === 'pipeline' && (
        <motion.div variants={itemVariants} className="flex-none flex items-center gap-4">
          {/* Search — constrained width with focus animation */}
          <motion.div
            className="relative flex-shrink-0"
            animate={{ width: isSearchFocused ? 320 : 256 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          >
            <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search recruits..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className="pl-9 h-8 w-full bg-card border-border"
            />
            {searchQuery && (
              <Button variant="ghost" size="icon" onClick={() => setSearchQuery('')} className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6">
                <IconX size={12} />
              </Button>
            )}
          </motion.div>

          <Tabs value={pipelineView} onValueChange={(v) => setPipelineView(v as 'board' | 'table')}>
            <TabsList className="h-8">
              <TabsTrigger value="board" className="h-7 gap-1.5 px-2.5 text-xs">
                <IconLayoutKanban size={14} /> Board
              </TabsTrigger>
              <TabsTrigger value="table" className="h-7 gap-1.5 px-2.5 text-xs">
                <IconTable size={14} /> Table
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Filters — right-aligned */}
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[130px] h-8 text-xs bg-card border-border">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="facebook_ads">Online Ads</SelectItem>
              <SelectItem value="in_person">In-Person</SelectItem>
              <SelectItem value="referral">Referral</SelectItem>
              <SelectItem value="website_form">Website Form</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[140px] h-8 text-xs bg-card border-border">
              <SelectValue placeholder="All Stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {PIPELINE_STAGES.map((stage) => (
                <SelectItem key={stage} value={stage}>{RECRUIT_STAGE_LABELS[stage]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </motion.div>
      )}

      {/* Stats row — only for pipeline view */}
      {viewMode === 'pipeline' && stats && (
        <motion.div variants={itemVariants} className="flex-none grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricCard label="Total Recruits" value={stats.total} icon={<IconUsers size={20} />} color="#3b82f6" />
          <MetricCard label="This Week" value={stats.thisWeek} icon={<IconUserPlus size={20} />} color="#8b5cf6" />
          <MetricCard
            label="Conversion Rate"
            value={`${stats.conversionRate.toFixed(1)}%`}
            icon={<IconTrendingUp size={20} />}
            color="#10b981"
          />
          <MetricCard
            label="Avg Days to Active"
            value={(stats.avgDaysToActive ?? stats.avgDaysInPipeline).toFixed(0)}
            icon={<IconClock size={20} />}
            color="#f59e0b"
          />
          <MetricCard
            label="In Licensing"
            value={stats.inLicensingCount ?? (recruitsByStage['IN_COURSE']?.length || 0)}
            icon={<IconCertificate size={20} />}
            color="#f97316"
          />
          <MetricCard
            label="30-Day Alerts"
            value={stats.thirtyDayAlerts ?? 0}
            icon={<IconAlertTriangle size={20} />}
            color="#ef4444"
          />
        </motion.div>
      )}

      {/* ── View Content ──────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
      <AnimatePresence mode="wait" custom={tabDirection}>
        <motion.div
          key={viewMode}
          custom={tabDirection}
          variants={tabContentVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.15 }}
          className="h-full min-h-0 w-full"
        >
          {viewMode === 'dashboard' && (
            <Suspense fallback={<RecruitingTabFallback />}>
              <RecruitDashboard />
            </Suspense>
          )}

          {viewMode === 'pipeline' && (
            <AnimatePresence mode="wait">
              <motion.div
                key={pipelineView}
                initial={{ opacity: 0, x: pipelineView === 'board' ? -12 : 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: pipelineView === 'board' ? 12 : -12 }}
                transition={{ duration: 0.15 }}
                className={isPipelineBoard ? "flex h-full min-h-0 flex-col" : "h-full overflow-y-auto pb-6"}
              >
                {pipelineView === 'board' && (
                  <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                    <div className="flex flex-col flex-1 min-h-0 gap-3">
                      {/* Grouped pipeline stages */}
                      <div className="flex gap-2.5 overflow-x-auto flex-1 min-h-0 pb-1 pt-1 custom-scrollbar">
                        {STAGE_GROUPS.map((group, gi) => (
                          <div key={group.name} className="flex gap-2 shrink-0 self-stretch">
                            {gi > 0 && (
                              <Separator orientation="vertical" className="mx-1 self-stretch" />
                            )}
                            <div className="flex flex-col gap-2 self-stretch">
                              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1">
                                {group.name}
                              </span>
                              <div className="flex gap-2 flex-1 min-h-0">
                                {group.stages.map((stage) => (
                                  <KanbanColumn
                                    key={stage}
                                    stage={stage}
                                    recruits={recruitsByStage[stage] || []}
                                    onCardClick={(recruit) => setSelectedRecruitId(recruit.id)}
                                    onAdvance={handleAdvanceRecruit}
                                    onExpand={setExpandedStage}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Terminal: REJECTED only */}
                      <div className="flex-none grid grid-cols-1 gap-3">
                        {TERMINAL_STAGES.map(({ stage, icon: Icon, accent }) => {
                          const recruits = recruitsByStage[stage] || []
                          const isOpen = !!terminalExpanded[stage]
                          return (
                            <motion.div
                              key={stage}
                              whileHover={{ scale: 1.01 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                              className="rounded-xl border border-border bg-card/50 overflow-hidden"
                            >
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  setTerminalExpanded((prev) => ({
                                    ...prev,
                                    [stage]: !prev[stage],
                                  }))
                                }
                                className="w-full justify-start px-4 py-3 h-auto"
                              >
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                  style={{ background: `${accent}15` }}
                                >
                                  <Icon size={16} style={{ color: accent }} />
                                </div>
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="text-sm font-semibold text-foreground">
                                    {RECRUIT_STAGE_LABELS[stage]}
                                  </span>
                                  <Badge
                                    className="text-xs font-bold px-2 py-0.5"
                                    style={{ background: `${accent}20`, color: accent }}
                                  >
                                    {recruits.length}
                                  </Badge>
                                </div>
                                {isOpen ? (
                                  <IconChevronDown size={16} className="text-muted-foreground shrink-0" />
                                ) : (
                                  <IconChevronRight size={16} className="text-muted-foreground shrink-0" />
                                )}
                              </Button>

                              {isOpen && recruits.length > 0 && (
                                <div className="border-t border-border/40 px-3 py-2 grid grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                                  {recruits.map((r) => (
                                    <Button
                                      key={r.id}
                                      variant="outline"
                                      onClick={() => setSelectedRecruitId(r.id)}
                                      className="h-auto py-2 justify-start text-left"
                                    >
                                      <div
                                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                                        style={{ background: `${accent}20`, color: accent }}
                                      >
                                        {r.firstName[0]}
                                        {r.lastName[0]}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium text-foreground truncate">
                                          {r.firstName} {r.lastName}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground truncate">
                                          {r.source ?? r.email}
                                        </p>
                                      </div>
                                    </Button>
                                  ))}
                                </div>
                              )}

                              {isOpen && recruits.length === 0 && (
                                <div className="border-t border-border/40 px-4 py-4 text-center text-xs text-muted-foreground">
                                  No recruits in this stage
                                </div>
                              )}
                            </motion.div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Drag overlay */}
                    <DragOverlay>
                      {draggedRecruit && (
                        <motion.div
                          initial={{ scale: 1 }}
                          animate={{ scale: 1.05, rotate: 1 }}
                          className="shadow-2xl ring-1 ring-primary/30 rounded-lg"
                        >
                          <RecruitCard
                            recruit={draggedRecruit}
                            onClick={() => {}}
                          />
                        </motion.div>
                      )}
                    </DragOverlay>
                  </DndContext>
                )}

                {pipelineView === 'table' && (
                  <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
                    {/* Bulk actions bar */}
                    {selectedRecruitIds.size > 0 && (
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border-b border-border/40">
                        <span className="text-sm font-medium text-foreground">
                          {selectedRecruitIds.size} selected
                        </span>
                        <Select value={bulkStageTarget} onValueChange={(v) => setBulkStageTarget(v as RecruitStage)}>
                          <SelectTrigger className="h-8 w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RECRUIT_STAGES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {RECRUIT_STAGE_LABELS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" onClick={handleBulkMove}>
                          Move
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRecruitIds(new Set())}
                          className="ml-auto text-xs"
                        >
                          Clear
                        </Button>
                      </div>
                    )}

                    {/* Table */}
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-border/40 text-xs text-muted-foreground font-medium">
                          <TableHead className="pl-4 pr-2 w-10">
                            <Checkbox
                              checked={
                                sortedRecruits.length > 0 &&
                                selectedRecruitIds.size === sortedRecruits.length
                              }
                              onCheckedChange={toggleSelectAll}
                            />
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:text-foreground transition-colors"
                            onClick={() => toggleSort('name')}
                          >
                            Name <SortIcon col="name" />
                          </TableHead>
                          <TableHead
                            className="cursor-pointer hover:text-foreground transition-colors"
                            onClick={() => toggleSort('email')}
                          >
                            Email <SortIcon col="email" />
                          </TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead
                            className="cursor-pointer hover:text-foreground transition-colors"
                            onClick={() => toggleSort('stage')}
                          >
                            Stage <SortIcon col="stage" />
                          </TableHead>
                          <TableHead>Agent Type</TableHead>
                          <TableHead className="text-right">Days</TableHead>
                          <TableHead
                            className="text-right cursor-pointer hover:text-foreground transition-colors pr-4"
                            onClick={() => toggleSort('createdAt')}
                          >
                            Created <SortIcon col="createdAt" />
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedRecruits.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="px-4 py-8 text-center text-muted-foreground text-sm">
                              No recruits match your filters
                            </TableCell>
                          </TableRow>
                        ) : (
                          sortedRecruits.map((r) => {
                            const days = Math.floor(
                              (Date.now() - new Date(r.createdAt).getTime()) / 86400000
                            )
                            const stageColor = RECRUIT_STAGE_COLORS[r.stage]
                            return (
                              <TableRow key={r.id}>
                                <TableCell className="pl-4 pr-2">
                                  <Checkbox
                                    checked={selectedRecruitIds.has(r.id)}
                                    onCheckedChange={() => toggleSelect(r.id)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button
                                    variant="link"
                                    onClick={() => setSelectedRecruitId(r.id)}
                                    className="px-0 h-auto font-medium truncate block max-w-[200px]"
                                  >
                                    {r.firstName} {r.lastName}
                                  </Button>
                                </TableCell>
                                <TableCell className="text-muted-foreground truncate max-w-[200px]">
                                  {r.email}
                                </TableCell>
                                <TableCell className="text-muted-foreground truncate">
                                  {r.phone ?? '--'}
                                </TableCell>
                                <TableCell className="text-muted-foreground truncate">
                                  {r.source ?? '--'}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    className="inline-block px-2 py-0.5"
                                    style={{ background: `${stageColor}20`, color: stageColor }}
                                  >
                                    {RECRUIT_STAGE_LABELS[r.stage]}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-muted-foreground truncate">
                                  {r.agentType ?? '--'}
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground tabular-nums">
                                  {days}d
                                </TableCell>
                                <TableCell className="text-right text-muted-foreground pr-4 tabular-nums">
                                  {new Date(r.createdAt).toLocaleDateString()}
                                </TableCell>
                              </TableRow>
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {viewMode === 'agents' && (
            <Suspense fallback={<RecruitingTabFallback />}>
              <div className="h-full overflow-y-auto pb-6">
                <AgentsPageContent />
              </div>
            </Suspense>
          )}
          {viewMode === 'org-chart' && (
            <Suspense fallback={<RecruitingTabFallback />}>
              <OrgChartPage />
            </Suspense>
          )}
        </motion.div>
      </AnimatePresence>
      </div>

      {/* ── Expanded column dialog ─────────────────────────── */}
      <Dialog open={!!expandedStage} onOpenChange={(open) => !open && setExpandedStage(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {expandedStage && (
                <>
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: RECRUIT_STAGE_COLORS[expandedStage] }}
                  />
                  {RECRUIT_STAGE_LABELS[expandedStage]}
                  <span className="text-sm font-normal text-muted-foreground ml-1">
                    ({(recruitsByStage[expandedStage] || []).length} recruits)
                  </span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {expandedStage && (recruitsByStage[expandedStage] || []).map((recruit) => (
              <RecruitCard
                key={recruit.id}
                recruit={recruit}
                onClick={() => { setExpandedStage(null); setSelectedRecruitId(recruit.id) }}
                onAdvance={handleAdvanceRecruit}
              />
            ))}
            {expandedStage && (recruitsByStage[expandedStage] || []).length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No recruits in this stage
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Detail panel (slide-over) ──────────────────────── */}
      {selectedRecruitId && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 animate-fade-in"
            onClick={() => setSelectedRecruitId(null)}
          />
          <RecruitDetailPanel
            recruitId={selectedRecruitId}
            onClose={() => setSelectedRecruitId(null)}
          />
        </>
      )}

      {/* Create modal */}
      <CreateRecruitModal open={showCreate} onClose={() => setShowCreate(false)} />
      <CSVImportModal open={showCSVImport} onClose={() => setShowCSVImport(false)} />
    </motion.div>
  )
}

// ── View mode type ────────────────────────────────────────────
type ViewMode = 'dashboard' | 'pipeline' | 'agents' | 'org-chart'

// ── View titles ──────────────────────────────────────────────
const VIEW_TITLES: Record<ViewMode, { title: string; subtitle: string }> = {
  dashboard: { title: 'Recruit Dashboard', subtitle: 'Real-time recruit pipeline overview' },
  pipeline: { title: 'Pipeline', subtitle: 'Manage your recruitment pipeline' },
  agents: { title: 'Agents', subtitle: 'View and manage all agents' },
  'org-chart': { title: 'Org Chart', subtitle: 'Visualize your team hierarchy' },
}

// ── Subcomponent: page header ────────────────────────────────
function PageHeader({
  viewMode,
  onViewModeChange,
  onAdd,
  onCSVImport,
  subtitleOverride,
}: {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  onAdd: () => void
  onCSVImport: () => void
  subtitleOverride?: string
}) {
  const { title, subtitle: defaultSubtitle } = VIEW_TITLES[viewMode]
  const subtitle = subtitleOverride || defaultSubtitle

  return (
    <div className="flex items-center gap-6 pb-1">
      {/* Left: Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-bold text-foreground leading-tight">{title}</h1>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>

      {/* Center: Tabs — take remaining space, centered */}
      <div className="flex-1 flex justify-center">
        <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="dashboard" className="gap-1.5">
              <IconLayoutDashboard size={14} /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-1.5">
              <IconUsers size={14} /> Pipeline
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-1.5">
              <IconUserCheck size={14} /> Agents
            </TabsTrigger>
            <TabsTrigger value="org-chart" className="gap-1.5">
              <IconHierarchy2 size={14} /> Org Chart
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Right: Action buttons — context-sensitive */}
      <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
        {(viewMode === 'pipeline' || viewMode === 'dashboard') && (
          <>
            <AILeadImportWidget />
            <Button variant="outline" size="sm" onClick={onCSVImport}>
              <IconFileSpreadsheet size={15} className="mr-1.5" />
              CSV Import
            </Button>
            <Button size="sm" onClick={onAdd}>
              <IconPlus size={15} className="mr-1.5" />
              Add Recruit
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
