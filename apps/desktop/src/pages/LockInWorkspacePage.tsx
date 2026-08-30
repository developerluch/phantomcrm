import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  useLockIn, useUpdateLockIn, useDeleteLockIn,
  useLockInAgents, useAddLockInAgent, useUpdateLockInAgent,
  useLockInBudget, useAddBudgetItem,
  useLockInItinerary, useAddItineraryItem,
  useInvitePartner,
  useSendLockInChat,
} from '../hooks/useLockIns'
import { toast } from 'sonner'
import {
  IconArrowLeft, IconPlus, IconTrash, IconSend, IconUsers, IconCash,
  IconCalendarEvent, IconMessageCircle, IconInfoCircle, IconCheck,
} from '@tabler/icons-react'
import type { LockInStatus, LockInAgent } from '../types/portal'
import { LOCK_IN_STATUS_COLORS, BUDGET_CATEGORIES, ITINERARY_CATEGORIES } from '../types/portal'

const STATUS_LABELS: Record<LockInStatus, string> = {
  planning: 'Planning', booked: 'Booked', confirmed: 'Confirmed',
  in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled',
}

const STATUS_STEPS: LockInStatus[] = ['planning', 'booked', 'confirmed', 'in_progress', 'completed']

const ITINERARY_COLORS: Record<string, string> = {
  training: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  calls: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  meal: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  activity: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  travel: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  general: 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200',
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) } catch { return iso }
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

const TABS = [
  { key: 'overview', label: 'Overview', icon: IconInfoCircle },
  { key: 'agents', label: 'Agents & Flights', icon: IconUsers },
  { key: 'budget', label: 'Budget', icon: IconCash },
  { key: 'itinerary', label: 'Itinerary', icon: IconCalendarEvent },
  { key: 'chat', label: 'AI Chat', icon: IconMessageCircle },
] as const

export default function LockInWorkspacePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: lockIn, isLoading } = useLockIn(id)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!lockIn) {
    return <div className="p-8 text-center text-muted-foreground">Lock-in not found</div>
  }

  return (
    <div className="space-y-6 pt-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigate('/lock-ins')}>
          <IconArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{lockIn.name}</h1>
          <p className="text-sm text-muted-foreground">{lockIn.city}, {lockIn.state} &middot; {formatDate(lockIn.startDate)} - {formatDate(lockIn.endDate)}</p>
        </div>
        <Badge style={{ backgroundColor: LOCK_IN_STATUS_COLORS[lockIn.status], color: '#fff' }} className="text-sm px-3 py-1">
          {STATUS_LABELS[lockIn.status] ?? lockIn.status}
        </Badge>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start overflow-x-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="flex items-center gap-1.5 text-sm">
              <t.icon className="w-4 h-4" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview"><OverviewTab lockInId={id!} /></TabsContent>
        <TabsContent value="agents"><AgentsTab lockInId={id!} /></TabsContent>
        <TabsContent value="budget"><BudgetTab lockInId={id!} /></TabsContent>
        <TabsContent value="itinerary"><ItineraryTab lockInId={id!} lockIn={lockIn} /></TabsContent>
        <TabsContent value="chat"><ChatTab lockInId={id!} /></TabsContent>
      </Tabs>
    </div>
  )
}

// ── Tab 1: Overview ──────────────────────────────────────────────

function OverviewTab({ lockInId }: { lockInId: string }) {
  const { data: lockIn } = useLockIn(lockInId)
  const updateLockIn = useUpdateLockIn()
  const deleteLockIn = useDeleteLockIn()
  const invitePartner = useInvitePartner()
  const navigate = useNavigate()
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ orgId: 0, orgName: '' })

  if (!lockIn) return null

  const daysUntil = Math.max(0, Math.ceil((new Date(lockIn.startDate).getTime() - Date.now()) / 86400000))
  const currentStepIdx = STATUS_STEPS.indexOf(lockIn.status)

  const handleDelete = async () => {
    if (!confirm('Delete this lock-in? This cannot be undone.')) return
    try {
      await deleteLockIn.mutateAsync(lockInId)
      toast.success('Lock-in deleted')
      navigate('/lock-ins')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const handleInvite = async () => {
    if (!inviteForm.orgName) return
    try {
      await invitePartner.mutateAsync({ lockInId, data: inviteForm })
      toast.success('Partner invited')
      setShowInvite(false)
      setInviteForm({ orgId: 0, orgName: '' })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Status progression */}
      <Card className="p-4">
        <h3 className="font-medium mb-3">Event Progress</h3>
        <div className="flex items-center gap-1">
          {STATUS_STEPS.map((step, i) => (
            <div key={step} className="flex items-center flex-1">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0 ${
                i <= currentStepIdx ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {i < currentStepIdx ? <IconCheck className="w-4 h-4" /> : i + 1}
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div className={`h-1 flex-1 mx-1 rounded ${i < currentStepIdx ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {STATUS_STEPS.map((step) => (
            <span key={step} className="text-[10px] text-muted-foreground">{STATUS_LABELS[step]}</span>
          ))}
        </div>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{lockIn.agentCount ?? 0}</div>
          <div className="text-sm text-muted-foreground">Total Agents</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{formatCurrency(lockIn.budgetTotal ?? 0)}</div>
          <div className="text-sm text-muted-foreground">Total Budget</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{daysUntil}</div>
          <div className="text-sm text-muted-foreground">Days Until Event</div>
        </Card>
      </div>

      {/* Details */}
      <Card className="p-4 space-y-2">
        <h3 className="font-medium">Details</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-muted-foreground">Location:</span> {lockIn.city}, {lockIn.state}</div>
          <div><span className="text-muted-foreground">Dates:</span> {formatDate(lockIn.startDate)} - {formatDate(lockIn.endDate)}</div>
          <div><span className="text-muted-foreground">Headcount:</span> {lockIn.estimatedHeadcount}</div>
          <div><span className="text-muted-foreground">Budget Target:</span> {formatCurrency(lockIn.budgetTarget)}</div>
          <div><span className="text-muted-foreground">Sales Goal:</span> {formatCurrency(lockIn.salesGoal)}</div>
        </div>
        {lockIn.description && <p className="text-sm mt-2">{lockIn.description}</p>}
      </Card>

      {/* Partners */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium">Partner Agencies</h3>
          <Button size="sm" variant="outline" onClick={() => setShowInvite(true)}>
            <IconPlus className="w-3.5 h-3.5 mr-1" /> Invite Partner
          </Button>
        </div>
        {lockIn.partners && lockIn.partners.length > 0 ? (
          <div className="space-y-2">
            {lockIn.partners.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="font-medium">{p.orgName}</span>
                <Badge variant={p.status === 'approved' ? 'default' : p.status === 'declined' ? 'destructive' : 'secondary'}>
                  {p.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No partners invited yet.</p>
        )}
      </Card>

      {/* Delete */}
      <div className="flex justify-end">
        <Button variant="destructive" size="sm" onClick={handleDelete}>
          <IconTrash className="w-4 h-4 mr-1" /> Delete Lock-In
        </Button>
      </div>

      {/* Invite modal */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite Partner</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Organization name" value={inviteForm.orgName} onChange={(e) => setInviteForm({ ...inviteForm, orgName: e.target.value })} />
            <Input placeholder="Org ID (optional)" type="number" value={inviteForm.orgId || ''} onChange={(e) => setInviteForm({ ...inviteForm, orgId: Number(e.target.value) })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={invitePartner.isPending}>Invite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Tab 2: Agents & Flights ─────────────────────────────────────

function AgentsTab({ lockInId }: { lockInId: string }) {
  const { data: agents, isLoading } = useLockInAgents(lockInId)
  const addAgent = useAddLockInAgent()
  const updateAgent = useUpdateLockInAgent()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ agentName: '', agentDiscordId: '', orgId: 0 })
  const [editingCell, setEditingCell] = useState<{ agentId: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState('')

  const handleAdd = async () => {
    if (!form.agentName) return
    try {
      await addAgent.mutateAsync({ lockInId, data: form })
      toast.success('Agent added')
      setShowAdd(false)
      setForm({ agentName: '', agentDiscordId: '', orgId: 0 })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const startEdit = (agent: LockInAgent, field: string) => {
    setEditingCell({ agentId: agent.id, field })
    setEditValue((agent as any)[field] || '')
  }

  const saveEdit = async () => {
    if (!editingCell) return
    const fieldMap: Record<string, string> = {
      flightAirline: 'flight_airline',
      flightNumber: 'flight_number',
      lodgingAssignment: 'lodging_assignment',
    }
    const dbField = fieldMap[editingCell.field] || editingCell.field
    try {
      await updateAgent.mutateAsync({ lockInId, agentId: editingCell.agentId, data: { [dbField]: editValue } as any })
      setEditingCell(null)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const renderCell = (agent: LockInAgent, field: string) => {
    if (editingCell?.agentId === agent.id && editingCell.field === field) {
      return (
        <Input
          className="h-7 text-xs"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
          autoFocus
        />
      )
    }
    const val = (agent as any)[field] || ''
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="cursor-pointer hover:bg-muted px-1 rounded min-w-[60px] inline-block"
            onClick={() => startEdit(agent, field)}
          >
            {val || <span className="text-muted-foreground italic">-</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent>Click to edit</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Agents ({agents?.length ?? 0})</h3>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <IconPlus className="w-3.5 h-3.5 mr-1" /> Add Agent
        </Button>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted rounded" />)}
        </div>
      ) : !agents?.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">No agents registered yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Org</th>
                <th className="pb-2 font-medium">Airline</th>
                <th className="pb-2 font-medium">Flight #</th>
                <th className="pb-2 font-medium">Lodging</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2 font-medium">{a.agentName}</td>
                  <td className="py-2">{a.orgId}</td>
                  <td className="py-2">{renderCell(a, 'flightAirline')}</td>
                  <td className="py-2">{renderCell(a, 'flightNumber')}</td>
                  <td className="py-2">{renderCell(a, 'lodgingAssignment')}</td>
                  <td className="py-2">
                    <Badge variant={a.status === 'confirmed' ? 'default' : 'secondary'}>{a.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Agent</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Agent name *" value={form.agentName} onChange={(e) => setForm({ ...form, agentName: e.target.value })} />
            <Input placeholder="Discord ID" value={form.agentDiscordId} onChange={(e) => setForm({ ...form, agentDiscordId: e.target.value })} />
            <Input placeholder="Org ID" type="number" value={form.orgId || ''} onChange={(e) => setForm({ ...form, orgId: Number(e.target.value) })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addAgent.isPending}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Tab 3: Budget ───────────────────────────────────────────────

function BudgetTab({ lockInId }: { lockInId: string }) {
  const { data: budgetData, isLoading } = useLockInBudget(lockInId)
  const { data: lockIn } = useLockIn(lockInId)
  const addItem = useAddBudgetItem()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ category: 'lodging', description: '', amount: 0, splitType: 'even' })

  const items = budgetData?.items ?? []
  const summary = budgetData?.summary

  const handleAdd = async () => {
    if (!form.description || !form.amount) return
    try {
      await addItem.mutateAsync({ lockInId, data: form })
      toast.success('Budget item added')
      setShowAdd(false)
      setForm({ category: 'lodging', description: '', amount: 0, splitType: 'even' })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const roi = lockIn && lockIn.salesGoal > 0 && summary
    ? ((lockIn.salesGoal - summary.total) / summary.total * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{formatCurrency(summary?.total ?? 0)}</div>
          <div className="text-sm text-muted-foreground">Total / {formatCurrency(lockIn?.budgetTarget ?? 0)} Target</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{formatCurrency(summary?.perAgentCost ?? 0)}</div>
          <div className="text-sm text-muted-foreground">Per Agent Cost</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold">{roi > 0 ? `${roi.toFixed(0)}%` : '-'}</div>
          <div className="text-sm text-muted-foreground">Projected ROI</div>
        </Card>
      </div>

      {/* Category breakdown */}
      {summary && Object.keys(summary.byCategory).length > 0 && (
        <Card className="p-4">
          <h3 className="font-medium mb-3">By Category</h3>
          <div className="space-y-2">
            {Object.entries(summary.byCategory).map(([cat, amt]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="w-20 text-sm capitalize">{cat}</span>
                <Progress
                  className="flex-1"
                  value={summary.total > 0 ? (amt / summary.total) * 100 : 0}
                />
                <span className="text-sm font-medium w-24 text-right">{formatCurrency(amt)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Items table */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Budget Items ({items.length})</h3>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <IconPlus className="w-3.5 h-3.5 mr-1" /> Add Item
        </Button>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted rounded" />)}
        </div>
      ) : !items.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">No budget items yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Category</th>
                <th className="pb-2 font-medium">Description</th>
                <th className="pb-2 font-medium text-right">Amount</th>
                <th className="pb-2 font-medium">Split</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="py-2 capitalize">{item.category}</td>
                  <td className="py-2">{item.description}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(item.amount)}</td>
                  <td className="py-2">{item.splitType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Budget Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className="w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUDGET_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Description *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input type="number" placeholder="Amount *" value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            <Select value={form.splitType} onValueChange={(v) => setForm({ ...form, splitType: v })}>
              <SelectTrigger className="w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="even">Even Split</SelectItem>
                <SelectItem value="by_headcount">By Headcount</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addItem.isPending}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Tab 4: Itinerary ────────────────────────────────────────────

function ItineraryTab({ lockInId, lockIn }: { lockInId: string; lockIn: { startDate: string; endDate: string } }) {
  const { data: items, isLoading } = useLockInItinerary(lockInId)
  const addItem = useAddItineraryItem()
  const [showAdd, setShowAdd] = useState<number | null>(null)
  const [form, setForm] = useState({ startTime: '09:00', endTime: '10:00', title: '', description: '', location: '', category: 'general' })

  // Calculate number of days
  const start = new Date(lockIn.startDate)
  const end = new Date(lockIn.endDate)
  const dayCount = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1)
  const days = Array.from({ length: dayCount }, (_, i) => i + 1)

  const handleAdd = async (dayNumber: number) => {
    if (!form.title) return
    try {
      await addItem.mutateAsync({ lockInId, data: { ...form, dayNumber } })
      toast.success('Item added')
      setShowAdd(null)
      setForm({ startTime: '09:00', endTime: '10:00', title: '', description: '', location: '', category: 'general' })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const getItemsForDay = (dayNum: number) => (items ?? []).filter((it) => it.dayNumber === dayNum)

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2].map((i) => <div key={i} className="h-24 bg-muted rounded" />)}
        </div>
      ) : (
        days.map((dayNum) => {
          const dayDate = new Date(start)
          dayDate.setDate(dayDate.getDate() + dayNum - 1)
          const dayItems = getItemsForDay(dayNum)

          return (
            <Card key={dayNum} className="overflow-hidden">
              <div className="flex items-center justify-between p-4 bg-muted/50 border-b">
                <div>
                  <span className="font-semibold">Day {dayNum}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    {dayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowAdd(dayNum)}>
                  <IconPlus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>
              <div className="p-4">
                {dayItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No items scheduled</p>
                ) : (
                  <div className="space-y-2">
                    {dayItems.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                        <span className="text-sm font-mono text-muted-foreground whitespace-nowrap">
                          {item.startTime?.slice(0, 5)} - {item.endTime?.slice(0, 5)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.title}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${ITINERARY_COLORS[item.category] || ITINERARY_COLORS.general}`}>
                              {item.category}
                            </span>
                          </div>
                          {item.location && <p className="text-xs text-muted-foreground mt-0.5">{item.location}</p>}
                          {item.description && <p className="text-sm mt-1">{item.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          )
        })
      )}

      <Dialog open={showAdd !== null} onOpenChange={(open) => { if (!open) setShowAdd(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Item - Day {showAdd}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Start</label>
                <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">End</label>
                <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
              </div>
            </div>
            <Input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className="w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITINERARY_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Textarea
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm min-h-[60px]"
              placeholder="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(null)}>Cancel</Button>
            <Button onClick={() => showAdd !== null && handleAdd(showAdd)} disabled={addItem.isPending}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Tab 5: AI Chat ──────────────────────────────────────────────

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}

function ChatTab({ lockInId }: { lockInId: string }) {
  const sendChat = useSendLockInChat()
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (msg?: string) => {
    const text = msg || input.trim()
    if (!text) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    try {
      const res = await sendChat.mutateAsync({ lockInId, message: text })
      setMessages((prev) => [...prev, { role: 'assistant', content: res.message }])
    } catch (err: unknown) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` }])
    }
  }

  const quickPrompts = [
    'Calculate per-agent cost',
    'Summarize the budget breakdown',
    'Build a 3-day itinerary',
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] min-h-[400px]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground py-12 space-y-4">
            <p>Ask the AI assistant about this lock-in event.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickPrompts.map((p) => (
                <Button
                  key={p}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSend(p)}
                  className="rounded-full"
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {sendChat.isPending && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-4 py-2 text-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            placeholder="Ask about this lock-in..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            disabled={sendChat.isPending}
          />
          <Button onClick={() => handleSend()} disabled={sendChat.isPending || !input.trim()}>
            <IconSend className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
