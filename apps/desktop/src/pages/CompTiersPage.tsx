import { useState, useMemo, type DragEvent } from 'react'
import {
  useCompTiers,
  useCreateCompTier,
  useUpdateCompTier,
  useDeleteCompTier,
  useReorderCompTiers,
} from '../hooks/useCompTiers'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList } from 'recharts'
import {
  IconPlus, IconTrash, IconGripVertical, IconEdit, IconCheck, IconX,
  IconPlugConnectedX, IconCash,
} from '@tabler/icons-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import EmptyState from '../components/EmptyState'

const compTierChartConfig = {
  agents: { label: 'Agents', color: '#3b82f6' },
} satisfies ChartConfig

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24, mass: 0.8 } },
}

export default function CompTiersPage() {
  const { data: tiers, isLoading, isError } = useCompTiers()
  const createTier = useCreateCompTier()
  const updateTier = useUpdateCompTier()
  const deleteTier = useDeleteCompTier()
  const reorderTiers = useReorderCompTiers()

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [percentage, setPercentage] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPercentage, setEditPercentage] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)

  const chartData = useMemo(() => {
    if (!tiers || tiers.length === 0) return []
    return tiers.map((t) => ({
      name: t.name,
      agents: t.profiles?.length ?? 0,
      percentage: t.percentage,
    }))
  }, [tiers])

  function handleCreate() {
    if (!name.trim() || !percentage) return
    createTier.mutate(
      { name: name.trim(), percentage: parseInt(percentage) },
      {
        onSuccess: () => {
          toast.success('Tier created')
          setName('')
          setPercentage('')
          setShowForm(false)
        },
        onError: () => toast.error('Failed to create tier'),
      }
    )
  }

  function handleEdit(id: string) {
    if (!editName.trim() || !editPercentage) return
    updateTier.mutate(
      { id, data: { name: editName.trim(), percentage: parseInt(editPercentage) } },
      {
        onSuccess: () => {
          toast.success('Tier updated')
          setEditingId(null)
        },
        onError: () => toast.error('Failed to update tier'),
      }
    )
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this comp tier? Agents assigned to it will be unassigned.')) return
    deleteTier.mutate(id, {
      onSuccess: () => toast.success('Tier deleted'),
      onError: () => toast.error('Failed to delete tier'),
    })
  }

  function handleDragStart(e: DragEvent, id: string) {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function handleDrop(e: DragEvent, targetId: string) {
    e.preventDefault()
    if (!draggedId || draggedId === targetId || !tiers) return

    const ids = tiers.map((t) => t.id)
    const fromIdx = ids.indexOf(draggedId)
    const toIdx = ids.indexOf(targetId)
    if (fromIdx === -1 || toIdx === -1) return

    const reordered = [...ids]
    reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, draggedId)

    reorderTiers.mutate(reordered, {
      onError: () => toast.error('Failed to reorder'),
    })

    setDraggedId(null)
  }

  // ── Loading skeleton ──────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="h-7 w-44 bg-muted rounded animate-pulse" />
        <div className="h-48 bg-muted/30 rounded-xl animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────

  if (isError) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5">
        <motion.div variants={itemVariants}>
          <h1 className="text-xl font-bold text-foreground">Comp Tiers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Manage compensation tiers and assign agents</p>
        </motion.div>
        <motion.div variants={itemVariants}>
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <div className="p-12 text-center">
              <IconPlugConnectedX size={48} className="mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-2">Could not load compensation tiers.</p>
              <p className="text-sm text-muted-foreground">
                Make sure your server is running and the API URL is configured correctly in Settings.
              </p>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    )
  }

  // ── Main content ──────────────────────────────────────────

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5 pt-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Comp Tiers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage compensation tiers and assign agents
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} variant="gradient" size="sm" className="flex items-center gap-1">
          <IconPlus size={14} />
          Add Tier
        </Button>
      </motion.div>

      {/* Create form */}
      {showForm && (
        <motion.div variants={itemVariants}>
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">Percentage</label>
                  <Input value={percentage} onChange={(e) => setPercentage(e.target.value)} type="number" min="0" max="100" placeholder="e.g. 60" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreate} variant="gradient" size="sm" disabled={!name.trim() || !percentage || createTier.isPending}>
                  {createTier.isPending ? 'Creating...' : 'Create'}
                </Button>
                <Button onClick={() => setShowForm(false)} variant="outline" size="sm">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {!tiers || tiers.length === 0 ? (
        <motion.div variants={itemVariants}>
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <EmptyState
              icon={IconCash}
              title="No comp tiers yet"
              description="Create your first compensation tier to organize agent payouts."
              action={{ label: 'Add Tier', onClick: () => setShowForm(true) }}
            />
          </Card>
        </motion.div>
      ) : (
        <>
          {/* Agents Per Tier Chart */}
          {chartData.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card className="bg-card/50 backdrop-blur border-border/50 p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Agents Per Tier</h3>
                <ChartContainer config={compTierChartConfig} className="h-52 w-full">
                  <BarChart data={chartData} margin={{ top: 16, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={32} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, _name, item) => (
                            <span>
                              {value} agent{Number(value) !== 1 ? 's' : ''} ({item.payload.percentage}%)
                            </span>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="agents" fill="var(--color-agents)" radius={[6, 6, 0, 0]}>
                      <LabelList dataKey="agents" position="top" className="fill-muted-foreground text-[11px]" />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </Card>
            </motion.div>
          )}

          {/* Tier list */}
          <div className="space-y-3">
            {tiers.map((tier) => (
              <motion.div key={tier.id} variants={itemVariants}>
                <Card
                  draggable
                  onDragStart={(e) => handleDragStart(e as unknown as DragEvent, tier.id)}
                  onDragOver={(e) => handleDragOver(e as unknown as DragEvent)}
                  onDrop={(e) => handleDrop(e as unknown as DragEvent, tier.id)}
                  className="bg-card/50 backdrop-blur border-border/50 p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className="cursor-grab text-muted-foreground hover:text-foreground">
                      <IconGripVertical size={16} />
                    </div>

                    {editingId === tier.id ? (
                      <div className="flex flex-1 items-center gap-3">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          value={editPercentage}
                          onChange={(e) => setEditPercentage(e.target.value)}
                          type="number"
                          min="0"
                          max="100"
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-emerald-500 hover:bg-emerald-500/10"
                          onClick={() => handleEdit(tier.id)}
                        >
                          <IconCheck size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={() => setEditingId(null)}
                        >
                          <IconX size={14} />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{tier.name}</p>
                            <Badge className="bg-blue-500/20 px-2.5 py-0.5 text-blue-400 hover:bg-blue-500/20">
                              {tier.percentage}%
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {tier.profiles.length} agent{tier.profiles.length !== 1 ? 's' : ''}
                          </p>
                        </div>

                        {tier.profiles.length > 0 && (
                          <div className="flex -space-x-2">
                            {tier.profiles.slice(0, 5).map((p) => (
                              <Tooltip key={p.agentId}>
                                <TooltipTrigger asChild>
                                  <div
                                    className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#111] bg-muted text-[10px] font-semibold text-foreground"
                                  >
                                    {p.agent.firstName[0]}{p.agent.lastName[0]}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>{p.agent.firstName} {p.agent.lastName}</TooltipContent>
                              </Tooltip>
                            ))}
                            {tier.profiles.length > 5 && (
                              <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#111] bg-muted text-[10px] font-medium text-muted-foreground">
                                +{tier.profiles.length - 5}
                              </div>
                            )}
                          </div>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground"
                          onClick={() => {
                            setEditingId(tier.id)
                            setEditName(tier.name)
                            setEditPercentage(String(tier.percentage))
                          }}
                        >
                          <IconEdit size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => handleDelete(tier.id)}
                        >
                          <IconTrash size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  )
}
