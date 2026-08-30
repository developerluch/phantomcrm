import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { PieChart, Pie, Cell } from 'recharts'
import { useLockIns, useCreateLockIn } from '../hooks/useLockIns'
import { toast } from 'sonner'
import { IconPlus, IconMapPin, IconCalendar, IconUsers, IconCash, IconCalendarStats } from '@tabler/icons-react'
import EmptyState from '../components/EmptyState'
import type { LockInStatus } from '../types/portal'
import { LOCK_IN_STATUS_COLORS } from '../types/portal'
import { motion } from 'framer-motion'

// ── Constants ──────────────────────────────────────────────────

const STATUS_LABELS: Record<LockInStatus, string> = {
  planning: 'Planning',
  booked: 'Booked',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'planning', label: 'Planning' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
] as const

// ── Chart Config ───────────────────────────────────────────────

const lockInChartConfig = {
  planning: { label: 'Planning', color: '#3b82f6' },
  booked: { label: 'Booked', color: '#8b5cf6' },
  confirmed: { label: 'Confirmed', color: '#22c55e' },
  in_progress: { label: 'In Progress', color: '#f59e0b' },
  completed: { label: 'Completed', color: '#10b981' },
  cancelled: { label: 'Cancelled', color: '#6b7280' },
} satisfies ChartConfig

// ── Animation Variants ─────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24, mass: 0.8 } },
}

// ── Helpers ────────────────────────────────────────────────────

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

// ── Component ──────────────────────────────────────────────────

export default function LockInsPage() {
  const navigate = useNavigate()
  const { data: lockIns, isLoading } = useLockIns()
  const createLockIn = useCreateLockIn()
  const [filter, setFilter] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    name: '', startDate: '', endDate: '', city: '', state: '',
    estimatedHeadcount: 0, budgetTarget: 0, salesGoal: 0, description: '',
  })

  const filtered = (lockIns ?? []).filter((li) => {
    if (filter === 'all') return true
    if (filter === 'planning') return li.status === 'planning'
    if (filter === 'active') return ['booked', 'confirmed', 'in_progress'].includes(li.status)
    if (filter === 'completed') return ['completed', 'cancelled'].includes(li.status)
    return true
  })

  // ── Chart Data ────────────────────────────────────────────

  const statusChartData = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const li of lockIns ?? []) {
      counts[li.status] = (counts[li.status] ?? 0) + 1
    }
    return Object.entries(counts).map(([status, count]) => ({
      name: status,
      value: count,
      fill: lockInChartConfig[status as LockInStatus]?.color ?? '#6b7280',
    }))
  }, [lockIns])

  // ── Handlers ──────────────────────────────────────────────

  const handleCreate = async () => {
    if (!form.name || !form.startDate || !form.endDate || !form.city || !form.state) {
      toast.error('Please fill all required fields')
      return
    }
    try {
      const li = await createLockIn.mutateAsync(form)
      toast.success('Lock-in created')
      setShowModal(false)
      setForm({ name: '', startDate: '', endDate: '', city: '', state: '', estimatedHeadcount: 0, budgetTarget: 0, salesGoal: 0, description: '' })
      navigate(`/lock-ins/${li.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create lock-in'
      toast.error(message)
    }
  }

  // ── Loading skeleton ──────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-5 animate-fade-in pt-6">
        <div className="flex items-center justify-between">
          <div className="h-7 w-36 bg-muted rounded animate-pulse" />
          <div className="h-9 w-36 bg-muted rounded-lg animate-pulse" />
        </div>
        <div className="h-9 w-72 bg-muted/50 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card/50 backdrop-blur p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div className="h-5 w-2/3 bg-muted rounded animate-pulse" />
                <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
              </div>
              <div className="space-y-2">
                <div className="h-3.5 w-1/2 bg-muted/70 rounded animate-pulse" />
                <div className="h-3.5 w-2/3 bg-muted/70 rounded animate-pulse" />
                <div className="h-3.5 w-1/3 bg-muted/70 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Lock-Ins</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Plan and manage multi-day sales events</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <IconPlus className="w-4 h-4 mr-1" /> Create Lock-In
        </Button>
      </motion.div>

      {/* Filter tabs + Status Donut */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-start gap-4">
        <Tabs value={filter} onValueChange={setFilter}>
          <TabsList>
            {FILTER_TABS.map((tab) => (
              <TabsTrigger key={tab.key} value={tab.key}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {statusChartData.length > 0 && (
          <Card className="bg-card/50 backdrop-blur border-border/50 flex-shrink-0">
            <CardHeader className="p-3 pb-0">
              <CardTitle className="text-xs font-medium text-muted-foreground">Status Overview</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <div className="flex items-center gap-3">
                <ChartContainer config={lockInChartConfig} className="h-[100px] w-[100px] aspect-square">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                    <Pie
                      data={statusChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={28}
                      outerRadius={45}
                      strokeWidth={2}
                      stroke="hsl(var(--background))"
                    >
                      {statusChartData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="flex flex-col gap-0.5">
                  {statusChartData.map((entry) => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-[10px]">
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: entry.fill }}
                      />
                      <span className="text-muted-foreground">
                        {lockInChartConfig[entry.name as LockInStatus]?.label ?? entry.name}
                      </span>
                      <span className="font-medium text-foreground ml-auto pl-2">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <motion.div variants={itemVariants}>
          <EmptyState
            icon={IconCalendarStats}
            title="No lock-ins yet"
            description="Create your first lock-in event to start planning a multi-day sales event."
          />
        </motion.div>
      ) : (
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((li) => (
            <motion.div key={li.id} variants={itemVariants}>
              <Card
                className="bg-card/50 backdrop-blur border-border/50 hover:shadow-md transition-all hover:border-border cursor-pointer"
                onClick={() => navigate(`/lock-ins/${li.id}`)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-lg leading-tight">{li.name}</h3>
                    <Badge style={{ backgroundColor: LOCK_IN_STATUS_COLORS[li.status], color: '#fff' }}>
                      {STATUS_LABELS[li.status] ?? li.status}
                    </Badge>
                  </div>
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <IconMapPin className="w-3.5 h-3.5" />
                      {li.city}, {li.state}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <IconCalendar className="w-3.5 h-3.5" />
                      {formatDate(li.startDate)} - {formatDate(li.endDate)}
                    </div>
                    <div className="flex items-center gap-4 pt-1">
                      <span className="flex items-center gap-1">
                        <IconUsers className="w-3.5 h-3.5" /> {li.agentCount ?? 0} agents
                      </span>
                      <span className="flex items-center gap-1">
                        <IconCash className="w-3.5 h-3.5" /> {formatCurrency(li.budgetTotal ?? 0)}
                      </span>
                    </div>
                    {li.partners && li.partners.length > 0 && (
                      <div className="text-xs pt-1">
                        {li.partners.length} partner{li.partners.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Create Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Lock-In</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Event name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Start Date *</label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">End Date *</label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="City *" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              <Input placeholder="State *" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Headcount</label>
                <Input type="number" value={form.estimatedHeadcount || ''} onChange={(e) => setForm({ ...form, estimatedHeadcount: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Budget Target</label>
                <Input type="number" value={form.budgetTarget || ''} onChange={(e) => setForm({ ...form, budgetTarget: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Sales Goal</label>
                <Input type="number" value={form.salesGoal || ''} onChange={(e) => setForm({ ...form, salesGoal: Number(e.target.value) })} />
              </div>
            </div>
            <Textarea
              className="min-h-[80px]"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createLockIn.isPending}>
              {createLockIn.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
