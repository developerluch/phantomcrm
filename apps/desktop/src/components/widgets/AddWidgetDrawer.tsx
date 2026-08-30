import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconCheck, IconSearch, IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useWidgetContext } from '@/contexts/WidgetContext'
import type { WidgetDefinition } from '@/lib/widget-registry'

interface AddWidgetDrawerProps {
  open: boolean
  onClose: () => void
}

// ── Animated Mini Mockups ────────────────────────────────────────────────────

function MiniBarChart() {
  const bars = [40, 65, 45, 80, 55, 70, 90]
  return (
    <svg viewBox="0 0 120 48" className="w-full h-full">
      {bars.map((h, i) => (
        <motion.rect
          key={i}
          x={4 + i * 17}
          y={48 - (h / 100) * 40}
          width={12}
          rx={2}
          height={(h / 100) * 40}
          fill={i === 6 ? '#7DD3FC' : 'hsl(0 0% 30%)'}
          initial={{ height: 0, y: 48 }}
          animate={{ height: (h / 100) * 40, y: 48 - (h / 100) * 40 }}
          transition={{ delay: i * 0.08, duration: 0.5, ease: 'easeOut' }}
        />
      ))}
    </svg>
  )
}

function MiniAreaChart() {
  const points = [
    { x: 0, y: 35 }, { x: 20, y: 25 }, { x: 40, y: 30 },
    { x: 60, y: 15 }, { x: 80, y: 20 }, { x: 100, y: 8 }, { x: 120, y: 12 },
  ]
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const area = `${line} L120,48 L0,48 Z`

  return (
    <svg viewBox="0 0 120 48" className="w-full h-full">
      <defs>
        <linearGradient id="miniAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7DD3FC" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#7DD3FC" stopOpacity={0} />
        </linearGradient>
      </defs>
      <motion.path
        d={area}
        fill="url(#miniAreaGrad)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke="#7DD3FC"
        strokeWidth={2}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />
    </svg>
  )
}

function MiniDonut() {
  const segments = [
    { pct: 0.45, color: '#7DD3FC' },
    { pct: 0.30, color: '#3b82f6' },
    { pct: 0.25, color: 'hsl(0 0% 25%)' },
  ]
  const r = 16
  const cx = 24
  const cy = 24
  const circumference = 2 * Math.PI * r
  let offset = 0

  return (
    <svg viewBox="0 0 48 48" className="w-full h-full">
      {segments.map((seg, i) => {
        const dashLen = seg.pct * circumference
        const dashOffset = -offset
        offset += dashLen
        return (
          <motion.circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={6}
            strokeDasharray={`${dashLen} ${circumference - dashLen}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.2, duration: 0.5 }}
          />
        )
      })}
    </svg>
  )
}

function MiniMetricCards() {
  return (
    <svg viewBox="0 0 120 48" className="w-full h-full">
      {[0, 1, 2, 3].map((i) => (
        <motion.g key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1, duration: 0.4 }}
        >
          <rect x={2 + i * 30} y={4} width={26} height={40} rx={4} fill="hsl(0 0% 12%)" stroke="hsl(0 0% 18%)" strokeWidth={0.5} />
          <rect x={6 + i * 30} y={10} width={14} height={3} rx={1} fill="hsl(0 0% 25%)" />
          <rect x={6 + i * 30} y={18} width={18} height={5} rx={1} fill={i === 0 ? '#7DD3FC' : 'hsl(0 0% 35%)'} />
          <motion.path
            d={`M${6 + i * 30},36 l3,-4 l3,2 l3,-6 l3,3 l3,-2`}
            fill="none"
            stroke={i === 0 ? '#7DD3FC' : 'hsl(0 0% 30%)'}
            strokeWidth={1}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.5 + i * 0.1, duration: 0.6 }}
          />
        </motion.g>
      ))}
    </svg>
  )
}

function MiniFunnel() {
  const stages = [
    { w: 100, color: '#3b82f6' },
    { w: 75, color: '#8b5cf6' },
    { w: 50, color: '#7DD3FC' },
    { w: 30, color: '#22c55e' },
  ]
  return (
    <svg viewBox="0 0 120 48" className="w-full h-full">
      {stages.map((s, i) => (
        <motion.rect
          key={i}
          x={(120 - s.w) / 2}
          y={2 + i * 12}
          width={s.w}
          height={10}
          rx={3}
          fill={s.color}
          opacity={0.7}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: i * 0.12, duration: 0.4, ease: 'easeOut' }}
          style={{ transformOrigin: 'center' }}
        />
      ))}
    </svg>
  )
}

function MiniListFeed() {
  return (
    <svg viewBox="0 0 120 48" className="w-full h-full">
      {[0, 1, 2, 3].map((i) => (
        <motion.g key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.15, duration: 0.3 }}
        >
          <circle cx={10} cy={6 + i * 12} r={3} fill={['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6'][i]} />
          <rect x={18} y={3 + i * 12} width={60 - i * 8} height={3} rx={1} fill="hsl(0 0% 25%)" />
          <rect x={18} y={8 + i * 12} width={30} height={2} rx={1} fill="hsl(0 0% 18%)" />
        </motion.g>
      ))}
    </svg>
  )
}

function MiniQuickActions() {
  const colors = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6']
  return (
    <svg viewBox="0 0 120 48" className="w-full h-full">
      {[0, 1, 2, 3].map((i) => {
        const col = i % 2
        const row = Math.floor(i / 2)
        return (
          <motion.g key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.1, duration: 0.3, type: 'spring' }}
            style={{ transformOrigin: `${12 + col * 56}px ${10 + row * 24}px` }}
          >
            <rect x={2 + col * 60} y={2 + row * 24} width={56} height={22} rx={4} fill="hsl(0 0% 12%)" stroke="hsl(0 0% 18%)" strokeWidth={0.5} />
            <circle cx={18 + col * 60} cy={13 + row * 24} r={4} fill={colors[i]} opacity={0.3} />
            <rect x={26 + col * 60} y={11 + row * 24} width={24} height={3} rx={1} fill="hsl(0 0% 30%)" />
          </motion.g>
        )
      })}
    </svg>
  )
}

function MiniGauge() {
  return (
    <svg viewBox="0 0 120 48" className="w-full h-full">
      <motion.circle
        cx={60}
        cy={36}
        r={28}
        fill="none"
        stroke="hsl(0 0% 15%)"
        strokeWidth={5}
        strokeDasharray={`${Math.PI * 28} ${Math.PI * 28}`}
        strokeLinecap="round"
        transform="rotate(180 60 36)"
      />
      <motion.circle
        cx={60}
        cy={36}
        r={28}
        fill="none"
        stroke="#7DD3FC"
        strokeWidth={5}
        strokeDasharray={`${Math.PI * 28 * 0.72} ${Math.PI * 28}`}
        strokeLinecap="round"
        transform="rotate(180 60 36)"
        initial={{ strokeDasharray: `0 ${Math.PI * 28}` }}
        animate={{ strokeDasharray: `${Math.PI * 28 * 0.72} ${Math.PI * 28}` }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
      <motion.text
        x={60}
        y={32}
        textAnchor="middle"
        fill="#7DD3FC"
        fontSize={12}
        fontWeight="bold"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        72%
      </motion.text>
    </svg>
  )
}

function MiniCalendar() {
  return (
    <svg viewBox="0 0 120 48" className="w-full h-full">
      <rect x={4} y={2} width={112} height={10} rx={3} fill="hsl(0 0% 15%)" />
      {Array.from({ length: 14 }).map((_, i) => {
        const col = i % 7
        const row = Math.floor(i / 7)
        const isHighlight = i === 3 || i === 8 || i === 11
        return (
          <motion.rect
            key={i}
            x={6 + col * 16}
            y={16 + row * 14}
            width={12}
            height={12}
            rx={2}
            fill={isHighlight ? '#7DD3FC' : 'hsl(0 0% 12%)'}
            opacity={isHighlight ? 0.4 : 1}
            initial={{ opacity: 0 }}
            animate={{ opacity: isHighlight ? 0.4 : 1 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
          />
        )
      })}
    </svg>
  )
}

// Map widget types to their mini mockup
const MOCKUP_MAP: Record<string, () => React.JSX.Element> = {
  'stat-cards': MiniMetricCards,
  'funnel-chart': MiniFunnel,
  'activity-feed': MiniListFeed,
  'at-risk': MiniListFeed,
  'leaderboard': MiniListFeed,
  'revenue-trend': MiniAreaChart,
  'pipeline-overview': MiniBarChart,
  'agent-distribution': MiniDonut,
  'finance-summary': MiniAreaChart,
  'recruit-stats': MiniMetricCards,
  'chargeback-tracker': MiniGauge,
  'lead-roi': MiniBarChart,
  'upcoming-appointments': MiniCalendar,
  'conversion-rate': MiniGauge,
  'stage-duration': MiniBarChart,
  'quick-actions': MiniQuickActions,
  'master-chart': MiniAreaChart,
}

// ── Widget Card ──────────────────────────────────────────────────────────────

function WidgetCard({
  def,
  isAdded,
  index,
  onAdd,
}: {
  def: WidgetDefinition
  isAdded: boolean
  index: number
  onAdd: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const Mockup = MOCKUP_MAP[def.type] ?? MiniBarChart
  const Icon = def.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
    >
      <Button
        variant="ghost"
        className={`w-full h-auto p-0 rounded-xl border transition-all duration-200 text-left justify-start flex flex-col overflow-hidden ${
          isAdded
            ? 'border-border/20 opacity-50 cursor-default'
            : 'border-border/30 hover:border-[#7DD3FC]/30 hover:bg-card/60 bg-card/30'
        }`}
        onClick={() => !isAdded && onAdd()}
        disabled={isAdded}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Mini Mockup Preview */}
        <div className="w-full h-[72px] px-3 pt-3 pb-1 relative overflow-hidden">
          {hovered && !isAdded ? <Mockup /> : (
            <div className="w-full h-full flex items-center justify-center">
              <Icon size={28} className="text-muted-foreground/30" />
            </div>
          )}
          {isAdded && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Badge variant="outline" className="text-[10px] gap-1 border-border/30">
                <IconCheck size={10} /> Added
              </Badge>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="w-full px-3 pb-3 pt-1">
          <div className="text-xs font-medium text-foreground truncate">{def.title}</div>
          <div className="mt-1.5 space-y-0.5">
            {def.features.slice(0, 3).map((f, i) => (
              <div key={i} className="flex items-start gap-1.5">
                <div className="w-1 h-1 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
                <span className="text-[10px] text-muted-foreground leading-tight font-normal">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </Button>
    </motion.div>
  )
}

// ── Main Bottom Sheet ────────────────────────────────────────────────────────

export function AddWidgetDrawer({ open, onClose }: AddWidgetDrawerProps) {
  const { addWidget, widgets, registry } = useWidgetContext()
  const [search, setSearch] = useState('')
  const existingTypes = new Set(widgets.map((w) => w.type))

  const allWidgets = Object.values(registry)
  const filtered = search.trim()
    ? allWidgets.filter(
        (d) =>
          d.title.toLowerCase().includes(search.toLowerCase()) ||
          d.description.toLowerCase().includes(search.toLowerCase())
      )
    : allWidgets

  // Reset search when closing
  useEffect(() => {
    if (!open) setSearch('')
  }, [open])

  function handleAdd(type: string) {
    addWidget(type)
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent
        side="bottom"
        className="max-h-[55vh] rounded-t-2xl border-t border-border/30 bg-background/95 backdrop-blur-xl px-6 pb-6 pt-0 [&>button]:hidden"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        {/* Header */}
        <SheetHeader className="pb-4 flex-row items-center justify-between space-y-0">
          <div>
            <SheetTitle className="text-base">Add Widget</SheetTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filtered.length} widgets available · {existingTypes.size} added
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <IconSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search widgets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 w-48 pl-8 text-xs bg-muted/50 border-border/30"
              />
              {search && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5"
                  onClick={() => setSearch('')}
                >
                  <IconX size={12} />
                </Button>
              )}
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>
              Done
            </Button>
          </div>
        </SheetHeader>

        {/* Widget Grid */}
        <div className="overflow-y-auto flex-1" style={{ maxHeight: 'calc(55vh - 120px)' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={search}
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {filtered.map((def, i) => (
                <WidgetCard
                  key={def.type}
                  def={def}
                  isAdded={existingTypes.has(def.type)}
                  index={i}
                  onAdd={() => handleAdd(def.type)}
                />
              ))}
            </motion.div>
          </AnimatePresence>

          {filtered.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">No widgets match &ldquo;{search}&rdquo;</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
