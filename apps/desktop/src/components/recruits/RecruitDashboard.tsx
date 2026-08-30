import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Responsive, useContainerWidth, getCompactor } from 'react-grid-layout'
import type { ResponsiveLayouts, Layout, LayoutItem } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import MetricCard from '../MetricCard'
import AtRiskBanner from '../AtRiskBanner'
import MasterChartWidget from '../charts/MasterChartWidget'
import ChartExpandModal from '../charts/ChartExpandModal'
import { useFunnel, useSummary, useAtRisk, useRevenueChart, useLeaderboard, usePipelineValue } from '../../hooks/useDashboard'
import { useDragAutoScroll } from '../../hooks/useDragAutoScroll'
import { Button } from '@/components/ui/button'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  IconUsers,
  IconCircleCheck,
  IconAlertTriangle,
  IconAlertCircle,
  IconClockHour4,
  IconSchool,
  IconLicense,
  IconUserX,
  IconTrophy,
  IconGripVertical,
  IconCheck,
  IconRefresh,
  IconX,
  IconArrowsMaximize,
  IconPencil,
  IconPlus,
} from '@tabler/icons-react'

// ─── Types & Config ─────────────────────────────────────────────

type WidgetId = 'funnel' | 'totalRecruits' | 'activeAgents' | 'atRisk' | 'avgDays' | 'students' | 'licensed' | 'removed' | 'atRiskList' | 'leaderboard'

const STAT_IDS: WidgetId[] = ['totalRecruits', 'activeAgents', 'atRisk', 'avgDays', 'students', 'licensed', 'removed']

interface WidgetConfig {
  id: WidgetId
  title: string
  removable: boolean
}

const WIDGETS: WidgetConfig[] = [
  { id: 'funnel', title: 'Recruit Pipeline', removable: false },
  { id: 'totalRecruits', title: 'Total Recruits', removable: true },
  { id: 'activeAgents', title: 'Active Agents', removable: true },
  { id: 'atRisk', title: 'At Risk', removable: true },
  { id: 'avgDays', title: 'Avg Days to Active', removable: true },
  { id: 'students', title: 'Students', removable: true },
  { id: 'licensed', title: 'Licensed', removable: true },
  { id: 'removed', title: 'Removed', removable: true },
  { id: 'atRiskList', title: 'At-Risk Agents', removable: true },
  { id: 'leaderboard', title: 'Top Agents', removable: true },
]

const DEFAULT_LAYOUTS: ResponsiveLayouts = {
  lg: [
    { i: 'funnel',        x: 0, y: 0, w: 8, h: 4, minW: 4, minH: 3 },
    { i: 'atRiskList',    x: 8, y: 0, w: 4, h: 4, minW: 4, minH: 2 },
    { i: 'totalRecruits', x: 0,  y: 4, w: 3, h: 1, minW: 2, minH: 1, maxH: 1 },
    { i: 'activeAgents',  x: 3,  y: 4, w: 3, h: 1, minW: 2, minH: 1, maxH: 1 },
    { i: 'atRisk',        x: 6,  y: 4, w: 3, h: 1, minW: 2, minH: 1, maxH: 1 },
    { i: 'avgDays',       x: 9,  y: 4, w: 3, h: 1, minW: 2, minH: 1, maxH: 1 },
    { i: 'students',      x: 0,  y: 5, w: 3, h: 1, minW: 2, minH: 1, maxH: 1 },
    { i: 'licensed',      x: 3,  y: 5, w: 3, h: 1, minW: 2, minH: 1, maxH: 1 },
    { i: 'removed',       x: 6,  y: 5, w: 3, h: 1, minW: 2, minH: 1, maxH: 1 },
    { i: 'leaderboard',   x: 0, y: 6, w: 6, h: 4, minW: 3, minH: 2 },
  ],
  md: [
    { i: 'funnel',        x: 0, y: 0, w: 7, h: 4 },
    { i: 'atRiskList',    x: 7, y: 0, w: 5, h: 4 },
    { i: 'totalRecruits', x: 0, y: 4, w: 3, h: 1, maxH: 1 },
    { i: 'activeAgents',  x: 3, y: 4, w: 3, h: 1, maxH: 1 },
    { i: 'atRisk',        x: 6, y: 4, w: 3, h: 1, maxH: 1 },
    { i: 'avgDays',       x: 9, y: 4, w: 3, h: 1, maxH: 1 },
    { i: 'students',      x: 0, y: 5, w: 3, h: 1, maxH: 1 },
    { i: 'licensed',      x: 3, y: 5, w: 3, h: 1, maxH: 1 },
    { i: 'removed',       x: 6, y: 5, w: 3, h: 1, maxH: 1 },
    { i: 'leaderboard',   x: 0, y: 6, w: 6, h: 4 },
  ],
  sm: [
    { i: 'funnel',        x: 0, y: 0,  w: 6, h: 4, static: true },
    { i: 'atRiskList',    x: 0, y: 4,  w: 6, h: 4, static: true },
    { i: 'totalRecruits', x: 0, y: 8,  w: 3, h: 1, static: true },
    { i: 'activeAgents',  x: 3, y: 8,  w: 3, h: 1, static: true },
    { i: 'atRisk',        x: 0, y: 9,  w: 3, h: 1, static: true },
    { i: 'avgDays',       x: 3, y: 9,  w: 3, h: 1, static: true },
    { i: 'students',      x: 0, y: 10, w: 3, h: 1, static: true },
    { i: 'licensed',      x: 3, y: 10, w: 3, h: 1, static: true },
    { i: 'removed',       x: 0, y: 11, w: 3, h: 1, static: true },
    { i: 'leaderboard',   x: 0, y: 12, w: 6, h: 4, static: true },
  ],
}

const LAYOUT_WRITE_DEBOUNCE_MS = 150

// ─── Helpers ────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded-xl bg-card/50 backdrop-blur-sm border border-border/50 animate-pulse ${className}`} />
}

// ─── Session-scoped confirmation skip (resets on page refresh) ──
let skipRemoveConfirm = false

// ─── Remove Button with Confirmation ────────────────────────────

function RemoveButton({ id, title, onRemove }: { id: string; title: string; onRemove: (id: string) => void }) {
  const [open, setOpen] = useState(false)

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (skipRemoveConfirm) {
      onRemove(id)
    } else {
      setOpen(true)
    }
  }, [id, onRemove])

  const handleConfirm = useCallback(() => {
    setOpen(false)
    onRemove(id)
  }, [id, onRemove])

  const handleDontAskAgain = useCallback(() => {
    skipRemoveConfirm = true
    setOpen(false)
    onRemove(id)
  }, [id, onRemove])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClick}
          className="h-5 w-5 rounded-full bg-zinc-600/90 hover:bg-zinc-500 text-white shadow-md p-0"
        >
          <IconX size={10} />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-56 p-3" onPointerDownOutside={(e) => e.preventDefault()}>
        <p className="text-xs text-foreground mb-3">
          Remove <span className="font-semibold">{title}</span> from dashboard?
        </p>
        <div className="flex flex-col gap-1.5">
          <Button size="sm" variant="outline" onClick={handleConfirm} className="w-full text-xs">
            Remove
          </Button>
          <Button size="sm" variant="ghost" onClick={handleDontAskAgain} className="w-full text-xs text-muted-foreground">
            Remove &amp; don&apos;t ask again
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Widget Wrapper ─────────────────────────────────────────────

function WidgetWrapper({
  id, title, editMode, onRemove, removable, compact, expandable, onExpand, children, index = 0
}: {
  id: string; title: string; editMode: boolean; onRemove: (id: string) => void; removable: boolean; compact?: boolean; expandable?: boolean; onExpand?: () => void; children: React.ReactNode; index?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 12 }}
      animate={{
        opacity: 1,
        scale: 1,
        y: 0,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 24, mass: 0.8, delay: index * 0.03 }}
      className={`h-full w-full rounded-xl box-border overflow-hidden flex flex-col border border-border/50 bg-card/50 backdrop-blur-sm ${editMode ? 'select-none' : ''}`}
      style={{
        outline: editMode ? '2px dashed rgba(125, 211, 252, 0.45)' : 'none',
        outlineOffset: '-2px',
      }}
    >
      {compact ? (
        <div className={`flex-1 min-h-0 overflow-hidden relative h-full ${editMode ? 'drag-handle cursor-grab active:cursor-grabbing' : ''}`}>
          <div className="h-full w-full">
            {children}
          </div>
          <AnimatePresence>
            {editMode && removable && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                className="absolute top-1 right-1 z-50"
              >
                <RemoveButton id={id} title={title} onRemove={onRemove} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <>
          <div className={`flex-none flex items-center justify-between px-5 py-3 border-b border-border/30 ${editMode ? 'drag-handle cursor-grab active:cursor-grabbing bg-muted/20' : ''}`}>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 pointer-events-none">
              {editMode && <IconGripVertical size={12} className="text-[#7dd3fc]/60" />}
              {title}
            </span>
            <div className="flex items-center gap-1">
              {expandable && !editMode && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={onExpand}
                      className="w-5 h-5"
                    >
                      <IconArrowsMaximize size={11} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Expand</TooltipContent>
                </Tooltip>
              )}
              <AnimatePresence>
                {editMode && removable && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                  >
                    <RemoveButton id={id} title={title} onRemove={onRemove} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          <div className="flex-1 min-h-0 relative p-4">
            <div className="h-full w-full overflow-auto">
              {children}
            </div>
          </div>
        </>
      )}
    </motion.div>
  )
}

// ─── Main Component ─────────────────────────────────────────────

export default function RecruitDashboard() {
  const navigate = useNavigate()
  const { data: funnel, isLoading: funnelLoading, isError: funnelError, refetch: refetchFunnel } = useFunnel()
  const { data: summary, isLoading: summaryLoading, isError: summaryError, refetch: refetchSummary } = useSummary()
  const { data: atRisk, isLoading: atRiskLoading } = useAtRisk()
  const { data: revenue = [] } = useRevenueChart()
  const { data: leaderboard = [], isLoading: leaderboardLoading } = useLeaderboard()
  const { data: pipeline = [] } = usePipelineValue()

  const { width, containerRef, mounted } = useContainerWidth()
  const scrollRef = useRef<HTMLDivElement>(null)
  const layoutFrameRef = useRef<number | null>(null)
  const queuedLayoutsRef = useRef<ResponsiveLayouts | null>(null)
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const queuedPersistRef = useRef<ResponsiveLayouts | null>(null)

  const LAYOUT_VERSION = 'v12'
  const [editMode, setEditMode] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [layouts, setLayouts] = useState<ResponsiveLayouts>(() => {
    const ver = localStorage.getItem('phantom-recruit-dashboard-layout-version')
    if (ver !== LAYOUT_VERSION) {
      localStorage.removeItem('phantom-recruit-dashboard-layout')
      localStorage.removeItem('phantom-recruit-dashboard-hidden-widgets')
      localStorage.setItem('phantom-recruit-dashboard-layout-version', LAYOUT_VERSION)
      return DEFAULT_LAYOUTS
    }
    const saved = localStorage.getItem('phantom-recruit-dashboard-layout')
    return saved ? JSON.parse(saved) : DEFAULT_LAYOUTS
  })
  const [hiddenWidgets, setHiddenWidgets] = useState<WidgetId[]>(() => {
    const saved = localStorage.getItem('phantom-recruit-dashboard-hidden-widgets')
    return saved ? JSON.parse(saved) : []
  })

  useDragAutoScroll(scrollRef, isDragging)

  const persistLayouts = useCallback((nextLayouts: ResponsiveLayouts, mode: 'now' | 'debounced' = 'debounced') => {
    queuedPersistRef.current = nextLayouts

    if (mode === 'now') {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current)
        persistTimerRef.current = null
      }
      localStorage.setItem('phantom-recruit-dashboard-layout', JSON.stringify(nextLayouts))
      queuedPersistRef.current = null
      return
    }

    if (persistTimerRef.current) clearTimeout(persistTimerRef.current)
    persistTimerRef.current = setTimeout(() => {
      if (!queuedPersistRef.current) return
      localStorage.setItem('phantom-recruit-dashboard-layout', JSON.stringify(queuedPersistRef.current))
      queuedPersistRef.current = null
      persistTimerRef.current = null
    }, LAYOUT_WRITE_DEBOUNCE_MS)
  }, [])

  const commitLayouts = useCallback((nextLayouts: ResponsiveLayouts, mode: 'now' | 'debounced' = 'debounced') => {
    if (mode === 'now') {
      if (layoutFrameRef.current !== null) {
        cancelAnimationFrame(layoutFrameRef.current)
        layoutFrameRef.current = null
      }
      queuedLayoutsRef.current = null
      setLayouts(nextLayouts)
      persistLayouts(nextLayouts, 'now')
      return
    }

    queuedLayoutsRef.current = nextLayouts
    if (layoutFrameRef.current !== null) return

    layoutFrameRef.current = requestAnimationFrame(() => {
      layoutFrameRef.current = null
      const queuedLayouts = queuedLayoutsRef.current
      if (!queuedLayouts) return
      queuedLayoutsRef.current = null
      setLayouts(queuedLayouts)
      persistLayouts(queuedLayouts)
    })
  }, [persistLayouts])

  useEffect(() => {
    return () => {
      if (layoutFrameRef.current !== null) {
        cancelAnimationFrame(layoutFrameRef.current)
        layoutFrameRef.current = null
      }
      const queuedLayouts = queuedLayoutsRef.current
      if (queuedLayouts) {
        localStorage.setItem('phantom-recruit-dashboard-layout', JSON.stringify(queuedLayouts))
        queuedPersistRef.current = null
      }
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current)
        persistTimerRef.current = null
      }
      const queuedPersist = queuedPersistRef.current
      if (!queuedLayouts && queuedPersist) {
        localStorage.setItem('phantom-recruit-dashboard-layout', JSON.stringify(queuedPersist))
      }
    }
  }, [])

  const removeWidget = (id: string) => {
    const widgetId = id as WidgetId
    const newHidden = [...hiddenWidgets, widgetId]
    setHiddenWidgets(newHidden)
    localStorage.setItem('phantom-recruit-dashboard-hidden-widgets', JSON.stringify(newHidden))
    const newLayouts: ResponsiveLayouts = {}
    for (const bp of Object.keys(layouts)) {
      const bpLayout = layouts[bp]
      if (bpLayout) {
        newLayouts[bp] = bpLayout.filter((l: LayoutItem) => l.i !== id)
      }
    }
    commitLayouts(newLayouts, 'now')
  }

  const restoreWidget = (id: WidgetId) => {
    const newHidden = hiddenWidgets.filter(h => h !== id)
    setHiddenWidgets(newHidden)
    localStorage.setItem('phantom-recruit-dashboard-hidden-widgets', JSON.stringify(newHidden))
    const newLayouts: ResponsiveLayouts = {}
    for (const bp of Object.keys(DEFAULT_LAYOUTS)) {
      const defaultLayout = DEFAULT_LAYOUTS[bp]
      const defaultItem = defaultLayout?.find((l: LayoutItem) => l.i === id)
      if (defaultItem) {
        newLayouts[bp] = [...(layouts[bp] || []), { ...defaultItem, y: Infinity }]
      } else {
        newLayouts[bp] = layouts[bp] || []
      }
    }
    commitLayouts(newLayouts, 'now')
  }

  const resetLayout = () => {
    commitLayouts(DEFAULT_LAYOUTS, 'now')
    setHiddenWidgets([])
    localStorage.removeItem('phantom-recruit-dashboard-layout')
    localStorage.removeItem('phantom-recruit-dashboard-hidden-widgets')
  }

  const handleFunnelHeightChange = useCallback((expanded: boolean) => {
    setLayouts(prev => {
      const next: ResponsiveLayouts = {}
      for (const bp of Object.keys(prev)) {
        next[bp] = (prev[bp] || []).map((item: LayoutItem) =>
          item.i === 'funnel' ? { ...item, h: expanded ? 8 : 4 } : item
        )
      }
      persistLayouts(next)
      return next
    })
  }, [persistLayouts])

  const [expandedWidget, setExpandedWidget] = useState<WidgetId | null>(null)
  const EXPANDABLE_IDS: WidgetId[] = ['funnel', 'atRiskList', 'leaderboard']
  const visibleWidgets = WIDGETS.filter(w => !hiddenWidgets.includes(w.id))

  function renderEmptyState(icon: React.ReactNode, label: string) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-muted-foreground/60">
        <div className="text-center">
          {icon}
          <span>{label}</span>
        </div>
      </div>
    )
  }

  function renderWidget(id: WidgetId) {
    switch (id) {
      case 'funnel':
        if (funnelLoading && !funnel) return <Skeleton className="h-full" />
        if (funnel) return (
          <MasterChartWidget
            stages={funnel.stages}
            revenue={revenue}
            pipeline={pipeline}
            onStageClick={(s) => navigate(`/agents?stage=${s}`)}
            prevStages={undefined}
            prevRevenue={undefined}
            prevPipeline={undefined}
            onHeightChange={handleFunnelHeightChange}
          />
        )
        return renderEmptyState(<IconAlertCircle size={24} className="mx-auto mb-1 opacity-20" />, 'No pipeline data')
      case 'totalRecruits':
        if (summaryLoading && !summary) return <Skeleton className="h-full" />
        if (summary) return <MetricCard label="Total Recruits" value={summary.total_agents} icon={<IconUsers size={18} />} color="#3b82f6" />
        return renderEmptyState(<IconUsers size={24} className="mx-auto mb-1 opacity-20" />, 'No data available')
      case 'activeAgents':
        if (summaryLoading && !summary) return <Skeleton className="h-full" />
        if (summary) return <MetricCard label="Active Agents" value={summary.active_agents} icon={<IconCircleCheck size={18} />} color="#22c55e" />
        return renderEmptyState(<IconCircleCheck size={24} className="mx-auto mb-1 opacity-20" />, 'No data available')
      case 'atRisk':
        if (summaryLoading && !summary) return <Skeleton className="h-full" />
        if (summary) return <MetricCard label="At Risk" value={summary.at_risk_count} icon={<IconAlertTriangle size={18} />} color="#f97316" />
        return renderEmptyState(<IconAlertTriangle size={24} className="mx-auto mb-1 opacity-20" />, 'No data available')
      case 'avgDays':
        if (summaryLoading && !summary) return <Skeleton className="h-full" />
        if (summary) return <MetricCard label="Avg Days to Active" value={summary.avg_days_to_activation ?? '—'} icon={<IconClockHour4 size={18} />} color="#a855f7" subtitle={summary.avg_days_to_activation ? 'days' : 'No data yet'} />
        return renderEmptyState(<IconClockHour4 size={24} className="mx-auto mb-1 opacity-20" />, 'No data available')
      case 'students':
        if (summaryLoading && !summary) return <Skeleton className="h-full" />
        if (summary) return <MetricCard label="Students" value={summary.students} icon={<IconSchool size={18} />} color="#f59e0b" />
        return renderEmptyState(<IconSchool size={24} className="mx-auto mb-1 opacity-20" />, 'No data available')
      case 'licensed':
        if (summaryLoading && !summary) return <Skeleton className="h-full" />
        if (summary) return <MetricCard label="Licensed" value={summary.licensed_count} icon={<IconLicense size={18} />} color="#06b6d4" />
        return renderEmptyState(<IconLicense size={24} className="mx-auto mb-1 opacity-20" />, 'No data available')
      case 'removed':
        if (summaryLoading && !summary) return <Skeleton className="h-full" />
        if (summary) return <MetricCard label="Removed" value={summary.kicked_count} icon={<IconUserX size={18} />} color="#6b7280" />
        return renderEmptyState(<IconUserX size={24} className="mx-auto mb-1 opacity-20" />, 'No data available')
      case 'atRiskList':
        if (atRiskLoading && !atRisk) return <Skeleton className="h-full" />
        if (atRisk) return <AtRiskBanner agents={atRisk} onAgentClick={(agentId) => navigate(`/agents/${agentId}`)} />
        return renderEmptyState(<IconAlertCircle size={24} className="mx-auto mb-1 opacity-20" />, 'No at-risk agents')
      case 'leaderboard':
        if (leaderboardLoading && !leaderboard.length) return <Skeleton className="h-full" />
        if (leaderboard.length > 0) return (
          <div className="h-full overflow-y-auto space-y-1.5 custom-scrollbar">
            <div className="flex items-center gap-2 mb-1">
              <IconTrophy size={14} className="text-yellow-400" />
              <span className="text-xs font-medium text-foreground">Top Agents This Month</span>
            </div>
            {leaderboard.slice(0, 10).map((entry, i) => (
              <div key={entry.agentId} className="flex items-center gap-2 text-xs">
                <span className={`w-5 text-center font-bold ${i < 3 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                  {i + 1}
                </span>
                <span className="flex-1 text-foreground truncate">{entry.name}</span>
                <span className="text-muted-foreground text-[10px]">{entry.policyCount} pol</span>
                <span className="text-foreground font-medium w-16 text-right">${entry.totalPremium.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )
        return renderEmptyState(<IconTrophy size={24} className="mx-auto mb-1 opacity-20" />, 'No leaderboard data')
      default:
        return null
    }
  }

  function renderExpandedContent(id: WidgetId) {
    switch (id) {
      case 'funnel':
        return funnel ? (
          <MasterChartWidget
            stages={funnel.stages}
            revenue={revenue}
            pipeline={pipeline}
            onStageClick={(s) => { setExpandedWidget(null); navigate(`/agents?stage=${s}`) }}
          />
        ) : null
      case 'atRiskList':
        return atRisk ? <AtRiskBanner agents={atRisk} onAgentClick={(agentId) => { setExpandedWidget(null); navigate(`/agents/${agentId}`) }} /> : null
      case 'leaderboard':
        return leaderboard.length > 0 ? (
          <div className="space-y-3 overflow-y-auto h-full">
            <div className="flex items-center gap-2 mb-2">
              <IconTrophy size={18} className="text-yellow-400" />
              <span className="text-base font-medium text-foreground">Top Agents This Month</span>
            </div>
            {leaderboard.map((entry, i) => (
              <div key={entry.agentId} className="flex items-center gap-3 text-sm px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                <span className={`w-7 text-center font-bold ${i < 3 ? 'text-yellow-400' : 'text-muted-foreground'}`}>{i + 1}</span>
                <span className="flex-1 text-foreground">{entry.name}</span>
                <span className="text-muted-foreground text-xs">{entry.policyCount} policies</span>
                <span className="text-foreground font-medium w-24 text-right">${entry.totalPremium.toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : null
      default:
        return null
    }
  }

  const isOffline = funnelError && summaryError

  return (
    <>
      <div className="flex h-full min-h-0 flex-col">
        {/* Edit Controls */}
        <AnimatePresence mode="wait">
          {editMode ? (
            <motion.div
              key="edit-toolbar"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="sticky top-0 z-40 -mx-6 px-6 py-2.5 bg-card/95 backdrop-blur-xl border-b border-[#7dd3fc]/20 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#7dd3fc] animate-pulse" />
                  <span className="text-xs font-semibold text-[#7dd3fc]/80 uppercase tracking-wider">
                    Editing Layout
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={resetLayout}>
                    <IconRefresh size={14} className="mr-1.5" />
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    className="bg-[#7dd3fc]/15 text-[#7dd3fc] border border-[#7dd3fc]/30 hover:bg-[#7dd3fc]/25"
                    onClick={() => setEditMode(false)}
                  >
                    <IconCheck size={14} className="mr-1.5" />
                    Done
                  </Button>
                </div>
              </div>
              {hiddenWidgets.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider self-center mr-1">
                    Hidden:
                  </span>
                  {hiddenWidgets.map(id => {
                    const w = WIDGETS.find(w => w.id === id)
                    return w ? (
                      <Button
                        key={id}
                        variant="outline"
                        size="sm"
                        onClick={() => restoreWidget(id)}
                        className="text-xs border-[#7dd3fc]/20 hover:border-[#7dd3fc]/40 h-7"
                      >
                        <IconPlus size={12} className="mr-1" />
                        {w.title}
                      </Button>
                    ) : null
                  })}
                </div>
              )}
            </motion.div>
          ) : (
            <div className="shrink-0 px-1 pb-2">
              <div className="flex items-center justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditMode(true)}
                >
                  <IconPencil size={14} className="mr-1.5" />
                  Edit Layout
                </Button>
              </div>
            </div>
          )}
        </AnimatePresence>

        {/* Offline banner */}
        {isOffline && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-2"
          >
            <IconAlertCircle size={14} className="text-amber-400 shrink-0" />
            <span className="text-xs text-amber-300">
              Connection lost — showing cached data
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { refetchFunnel(); refetchSummary() }}
              className="ml-auto text-xs text-amber-400 h-6"
            >
              <IconRefresh size={12} className="mr-1" />
              Retry
            </Button>
          </motion.div>
        )}

        {/* Scrollable Grid */}
        <div
          ref={(el) => {
            // Assign to both refs
            (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
            (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el
          }}
          className={`flex-1 overflow-y-auto overflow-x-hidden ${editMode ? 'editing-grid pt-2' : ''}`}
          style={editMode ? {
            backgroundImage: 'radial-gradient(circle, rgba(125, 211, 252, 0.04) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          } : undefined}
        >
          {mounted && (
            <Responsive
              className="layout"
              width={width}
              layouts={layouts}
              breakpoints={{ lg: 900, md: 600, sm: 0 }}
              cols={{ lg: 12, md: 12, sm: 6 }}
              rowHeight={80}
              compactor={getCompactor('vertical', false, false)}
              dragConfig={{ enabled: editMode, handle: '.drag-handle', bounded: true }}
              resizeConfig={{ enabled: editMode, handles: ['se', 's', 'e'] }}
              onDragStart={() => setIsDragging(true)}
              onDragStop={() => setIsDragging(false)}
              onLayoutChange={(_currentLayout: Layout, allLayouts: ResponsiveLayouts) => {
                commitLayouts(allLayouts)
              }}
              margin={[12, 12] as const}
              containerPadding={[0, 0] as const}
            >
              {visibleWidgets.map((widget, index) => {
                const isMetric = STAT_IDS.includes(widget.id)
                const isExpandable = EXPANDABLE_IDS.includes(widget.id)
                const content = renderWidget(widget.id)
                return (
                  <div key={widget.id} className="h-full">
                    <WidgetWrapper
                      id={widget.id}
                      title={widget.title}
                      editMode={editMode}
                      onRemove={removeWidget}
                      removable={widget.removable}
                      compact={isMetric}
                      expandable={isExpandable}
                      onExpand={() => setExpandedWidget(widget.id)}
                      index={index}
                    >
                      {content ?? (
                        <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                          No data available
                        </div>
                      )}
                    </WidgetWrapper>
                  </div>
                )
              })}
            </Responsive>
          )}
        </div>
      </div>

      {/* Expand Modal */}
      <ChartExpandModal
        open={expandedWidget !== null}
        onClose={() => setExpandedWidget(null)}
        title={WIDGETS.find(w => w.id === expandedWidget)?.title || ''}
      >
        {expandedWidget && renderExpandedContent(expandedWidget)}
      </ChartExpandModal>
    </>
  )
}
