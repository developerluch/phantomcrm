import { useState } from 'react'
import {
  useDripCampaigns,
  useDripCampaign,
  useCreateDripCampaign,
  useUpdateDripCampaign,
  useDeleteDripCampaign,
  useDripExecutions,
  useCreateDripStep,
  useDeleteDripStep,
} from '../../hooks/useDripCampaigns'
import { RECRUIT_STAGES, RECRUIT_STAGE_LABELS } from '../../types/portal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  IconPlus,
  IconTrash,
  IconClock,
  IconMessageCircle,
  IconLoader2,
  IconArrowLeft,
} from '@tabler/icons-react'
import EmptyState from '../EmptyState'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { toast } from 'sonner'

const CHANNEL_OPTIONS = ['whatsapp', 'sms'] as const
const TEMPLATE_HINTS = '{{firstName}}, {{lastName}}, {{email}}, {{phone}}, {{city}}, {{bookingLink}}'

function formatDelay(minutes: number): string {
  if (minutes === 0) return 'Immediately'
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`
  return `${Math.round(minutes / 1440)}d`
}

export default function DripSequenceEditor() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', channel: 'whatsapp', triggerStage: 'NEW_LEAD' })
  const [newStep, setNewStep] = useState({ delayMinutes: 0, delayUnit: 'minutes' as 'minutes' | 'hours' | 'days', messageTemplate: '' })

  const { data: campaigns = [], isLoading } = useDripCampaigns()
  const { data: detail } = useDripCampaign(selectedId ?? '')
  const { data: executions = [] } = useDripExecutions(selectedId ?? '')
  const createCampaign = useCreateDripCampaign()
  const updateCampaign = useUpdateDripCampaign()
  const deleteCampaign = useDeleteDripCampaign()
  const createStep = useCreateDripStep()
  const deleteStep = useDeleteDripStep()

  const steps = detail?.steps ?? []

  function handleCreate() {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    createCampaign.mutate(form, {
      onSuccess: () => { toast.success('Drip campaign created'); setShowCreate(false); setForm({ name: '', channel: 'whatsapp', triggerStage: 'NEW_LEAD' }) },
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
    })
  }

  function handleToggleActive(id: string, isActive: boolean) {
    updateCampaign.mutate({ id, data: { isActive: !isActive } }, {
      onSuccess: () => toast.success(isActive ? 'Paused' : 'Activated'),
    })
  }

  function handleDelete(id: string) {
    deleteCampaign.mutate(id, {
      onSuccess: () => { toast.success('Deleted'); if (selectedId === id) setSelectedId(null) },
    })
  }

  function getDelayMinutes(): number {
    const v = Number(newStep.delayMinutes) || 0
    if (newStep.delayUnit === 'hours') return v * 60
    if (newStep.delayUnit === 'days') return v * 1440
    return v
  }

  function handleAddStep() {
    if (!selectedId || !newStep.messageTemplate.trim()) { toast.error('Message template is required'); return }
    createStep.mutate({
      campaignId: selectedId,
      data: {
        stepOrder: steps.length + 1,
        delayMinutes: getDelayMinutes(),
        messageTemplate: newStep.messageTemplate.trim(),
      },
    }, {
      onSuccess: () => { toast.success('Step added'); setNewStep({ delayMinutes: 0, delayUnit: 'minutes', messageTemplate: '' }) },
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
    })
  }

  function handleDeleteStep(stepId: string) {
    if (!selectedId) return
    deleteStep.mutate({ campaignId: selectedId, stepId }, {
      onSuccess: () => toast.success('Step removed'),
    })
  }

  // Detail view
  if (selectedId && detail) {
    const activeExecCount = executions.filter((e) => e.status === 'active').length
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)} className="text-muted-foreground hover:text-foreground transition-colors h-7 w-7">
            <IconArrowLeft size={18} />
          </Button>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{detail.name}</h2>
            <p className="text-xs text-muted-foreground">
              {detail.channel} · triggers on {RECRUIT_STAGE_LABELS[detail.triggerStage as keyof typeof RECRUIT_STAGE_LABELS] ?? detail.triggerStage}
              {activeExecCount > 0 && <span className="ml-2 text-blue-400">{activeExecCount} active</span>}
            </p>
          </div>
        </div>

        {/* Steps timeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{steps.length} step{steps.length !== 1 ? 's' : ''}</CardTitle>
          </CardHeader>
          <CardContent>
            {steps.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No steps yet. Add your first step below.</p>
            ) : (
              <div className="relative ml-3 border-l border-border/50 pl-6 space-y-4">
                {steps.sort((a, b) => a.stepOrder - b.stepOrder).map((step) => (
                  <div key={step.id} className="relative">
                    <div className="absolute -left-[31px] top-1 w-3 h-3 rounded-full bg-card border-2 border-border" />
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-foreground">Step {step.stepOrder}</span>
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <IconClock size={10} />
                            {formatDelay(step.delayMinutes)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                          {step.messageTemplate}
                        </p>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteStep(step.id)}
                            className="text-muted-foreground hover:text-red-400 transition-colors shrink-0 mt-0.5 h-6 w-6"
                          >
                            <IconTrash size={13} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete step</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add step form */}
            <div className="mt-5 pt-4 border-t border-border/50 space-y-3">
              <div className="flex items-center gap-2">
                <div className="space-y-1 flex-shrink-0">
                  <label className="text-xs text-muted-foreground">Delay</label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      value={newStep.delayMinutes}
                      onChange={(e) => setNewStep((s) => ({ ...s, delayMinutes: Number(e.target.value) }))}
                      className="h-8 w-20 text-xs"
                    />
                    <Select value={newStep.delayUnit} onValueChange={(v) => setNewStep((s) => ({ ...s, delayUnit: v as 'minutes' | 'hours' | 'days' }))}>
                      <SelectTrigger className="h-8 w-[80px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">min</SelectItem>
                        <SelectItem value="hours">hours</SelectItem>
                        <SelectItem value="days">days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Message Template</label>
                <Textarea
                  value={newStep.messageTemplate}
                  onChange={(e) => setNewStep((s) => ({ ...s, messageTemplate: e.target.value }))}
                  placeholder="Hi {{firstName}}, ..."
                  rows={3}
                  className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-xs text-foreground resize-none placeholder:text-muted-foreground"
                />
                <p className="text-[10px] text-muted-foreground/60">Variables: {TEMPLATE_HINTS}</p>
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleAddStep}
                  disabled={!newStep.messageTemplate.trim() || createStep.isPending}
                >
                  {createStep.isPending ? <IconLoader2 size={14} className="animate-spin mr-1" /> : <IconPlus size={14} className="mr-1" />}
                  Add Step
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Campaign list view
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <IconPlus size={14} className="mr-1" />
          New Drip Sequence
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">New Drip Sequence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Welcome Flow"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Channel</label>
                <Select value={form.channel} onValueChange={(v) => setForm((f) => ({ ...f, channel: v }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Trigger Stage</label>
                <Select value={form.triggerStage} onValueChange={(v) => setForm((f) => ({ ...f, triggerStage: v }))}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECRUIT_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{RECRUIT_STAGE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={createCampaign.isPending}>
                {createCampaign.isPending ? <IconLoader2 size={14} className="animate-spin mr-1" /> : null}
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{campaigns.length} sequence{campaigns.length !== 1 ? 's' : ''}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 rounded-lg bg-card border border-border animate-pulse" />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <EmptyState
              icon={IconMessageCircle}
              title="No drip sequences"
              description="Create automated message sequences triggered by pipeline stage changes."
              action={{ label: 'New Drip Sequence', onClick: () => setShowCreate(true) }}
            />
          ) : (
            <div className="space-y-2">
              {campaigns.map((c) => (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border hover:bg-white/[0.02] transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                      <Badge variant={c.isActive ? 'success' : 'secondary'} className="text-[10px]">
                        {c.isActive ? 'active' : 'paused'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.channel} · triggers on {RECRUIT_STAGE_LABELS[c.triggerStage as keyof typeof RECRUIT_STAGE_LABELS] ?? c.triggerStage}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => { e.stopPropagation(); handleToggleActive(c.id, c.isActive) }}
                          className={`px-2 py-1 h-auto text-[10px] font-medium ${c.isActive ? 'hover:bg-yellow-500/10 text-yellow-400' : 'hover:bg-green-500/10 text-green-400'}`}
                        >
                          {c.isActive ? 'Pause' : 'Activate'}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{c.isActive ? 'Pause' : 'Activate'}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); handleDelete(c.id) }}
                          className="text-muted-foreground hover:text-red-400 transition-colors h-6 w-6"
                        >
                          <IconTrash size={14} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
