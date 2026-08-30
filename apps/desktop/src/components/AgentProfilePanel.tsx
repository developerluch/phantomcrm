import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { toast } from 'sonner'
import {
  IconX,
  IconShieldCheck,
  IconSend,
  IconUnlink,
  IconPlus,
  IconCurrencyDollar,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChartContainer, type ChartConfig } from '@/components/ui/chart'
import { AreaChart, Area } from 'recharts'
import { STAGE_NAMES, STAGE_COLORS } from '../types/agent'
import type { OrgChartNode } from '../types/portal'
import { POLICY_TYPES, AGENT_ROLES, AGENT_ROLE_LABELS, AGENT_ROLE_COLORS } from '../types/portal'
import type { AgentRole } from '../types/portal'

const fmtUSD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

interface Props {
  agent: OrgChartNode
  onClose: () => void
}

export default function AgentProfilePanel({ agent, onClose }: Props) {
  const queryClient = useQueryClient()
  const [verifying, setVerifying] = useState(false)
  const [messaging, setMessaging] = useState(false)
  const [message, setMessage] = useState('')
  const [removingManager, setRemovingManager] = useState(false)
  const [showSaleForm, setShowSaleForm] = useState(false)
  const [saleForm, setSaleForm] = useState({
    clientName: '',
    policyType: 'life',
    carrier: '',
    premium: '',
    commission: '',
    policyNumber: '',
    notes: '',
  })
  const [creatingSale, setCreatingSale] = useState(false)

  const { data: agentDetail } = useQuery({
    queryKey: ['agent', agent.id],
    queryFn: () => api.getAgent(agent.id),
  })

  const { data: sales } = useQuery({
    queryKey: ['agent-sales', agent.id],
    queryFn: () => api.getAgentSales(agent.id),
  })

  const { data: saleStats } = useQuery({
    queryKey: ['agent-sale-stats', agent.id],
    queryFn: () => api.getAgentSalesStats(agent.id),
  })

  const stageNum = agentDetail?.current_stage ?? 0
  const stageName = agent.stage?.name ?? STAGE_NAMES[stageNum] ?? 'Unknown'
  const stageColor = agent.stage?.color ?? STAGE_COLORS[stageNum] ?? '#6b7280'

  const handleVerify = async () => {
    setVerifying(true)
    try {
      const result = await api.verifyAgent(agent.id)
      if (result.verified) {
        toast.success(`License verified! NPN: ${result.npn}`)
        queryClient.invalidateQueries({ queryKey: ['org-chart'] })
        queryClient.invalidateQueries({ queryKey: ['agent', agent.id] })
      } else {
        toast.error(result.error || 'License not found')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  const handleSendMessage = async () => {
    if (!message.trim()) return
    setMessaging(true)
    try {
      await api.fetchMutate(`/api/v1/agents/${agent.id}/message`, 'POST', { message: message.trim() })
      toast.success('Message sent')
      setMessage('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setMessaging(false)
    }
  }

  const handleRemoveManager = async () => {
    setRemovingManager(true)
    try {
      await api.setManager(agent.id, null)
      toast.success('Manager removed')
      queryClient.invalidateQueries({ queryKey: ['org-chart'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove manager')
    } finally {
      setRemovingManager(false)
    }
  }

  const handleCreateSale = async () => {
    if (!saleForm.clientName.trim() || !saleForm.carrier.trim() || !saleForm.premium) return
    setCreatingSale(true)
    try {
      await api.createSale({
        agentId: agent.id,
        clientName: saleForm.clientName.trim(),
        policyType: saleForm.policyType,
        carrier: saleForm.carrier.trim(),
        premium: Number(saleForm.premium),
        commission: saleForm.commission ? Number(saleForm.commission) : undefined,
        policyNumber: saleForm.policyNumber.trim() || undefined,
        notes: saleForm.notes.trim() || undefined,
      })
      toast.success('Sale recorded!')
      setSaleForm({ clientName: '', policyType: 'life', carrier: '', premium: '', commission: '', policyNumber: '', notes: '' })
      setShowSaleForm(false)
      queryClient.invalidateQueries({ queryKey: ['agent-sales', agent.id] })
      queryClient.invalidateQueries({ queryKey: ['agent-sale-stats', agent.id] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create sale')
    } finally {
      setCreatingSale(false)
    }
  }

  return (
    <div className="absolute right-0 top-0 z-50 h-full w-96 border-l border-border bg-card/95 backdrop-blur-sm overflow-y-auto shadow-2xl">
      {/* Close button */}
      <div className="absolute right-3 top-3 z-10">
        <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
          <IconX size={16} />
        </Button>
      </div>

      <div className="p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          {agent.profile?.photoUrl ? (
            <img
              src={agent.profile.photoUrl}
              alt={`${agent.firstName} ${agent.lastName}`}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground">
              {agent.firstName?.[0]}{agent.lastName?.[0]}
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {agent.firstName} {agent.lastName}
            </h3>
            <Badge variant="outline" className="gap-1.5 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stageColor }} />
              {stageName}
            </Badge>
          </div>
        </div>

        {/* Profile Info */}
        <Card className="bg-card/30 backdrop-blur border-border/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <InfoRow label="Agency" value={agentDetail?.agency} />
            <InfoRow label="State" value={agentDetail?.resident_state} />
            <InfoRow label="Experience" value={agentDetail?.experience_level} />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">License</span>
              {agentDetail?.npn ? (
                <Badge className="bg-emerald-400/10 text-emerald-400 border-emerald-400/20">Verified</Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground/50">Not verified</Badge>
              )}
            </div>
            {/* Role Selector */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Role</span>
              <Select
                value={((agent as unknown as Record<string, string>).role) || 'AGENT'}
                onValueChange={async (role) => {
                  try {
                    await api.updateAgentRole(agent.id, role)
                    queryClient.invalidateQueries({ queryKey: ['org-chart'] })
                    toast.success('Role updated')
                  } catch {
                    toast.error('Failed to update role')
                  }
                }}
              >
                <SelectTrigger className="w-40 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: AGENT_ROLE_COLORS[role] }} />
                        {AGENT_ROLE_LABELS[role]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* License Details */}
        {agentDetail?.npn && (
          <Card className="bg-card/30 backdrop-blur border-border/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                License Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <InfoRow label="NPN" value={agentDetail.npn} />
              <InfoRow label="License #" value={agentDetail.license_number} />
              <InfoRow label="Verified At" value={agentDetail.verified_at ? new Date(agentDetail.verified_at).toLocaleDateString() : undefined} />
            </CardContent>
          </Card>
        )}

        {/* Sales */}
        <Card className="bg-card/30 backdrop-blur border-border/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Sales
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSaleForm(!showSaleForm)}
              >
                <IconPlus size={12} />
                Add Sale
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Sparkline */}
            {saleStats && (
              <ChartContainer
                config={{ premium: { label: 'Premium', color: '#22c55e' } } satisfies ChartConfig}
                className="h-16 w-full"
              >
                <AreaChart
                  data={[
                    { month: 'Last', premium: saleStats.lastMonth?.premium ?? 0 },
                    { month: 'This', premium: saleStats.thisMonth?.premium ?? 0 },
                  ]}
                  margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient id="salesPanelGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-premium)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-premium)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="premium" stroke="var(--color-premium)" fill="url(#salesPanelGrad)" strokeWidth={1.5} isAnimationActive={false} />
                </AreaChart>
              </ChartContainer>
            )}

            {/* Stats Grid */}
            {saleStats && (
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border/30 bg-card/30 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground uppercase">Total Sales</p>
                  <p className="text-sm font-bold text-foreground tabular-nums">{saleStats.totalSales}</p>
                </div>
                <div className="rounded-lg border border-border/30 bg-card/30 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground uppercase">Total Premium</p>
                  <p className="text-sm font-bold text-blue-400 tabular-nums">
                    {fmtUSD.format(saleStats.totalPremium)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/30 bg-card/30 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground uppercase">Commission</p>
                  <p className="text-sm font-bold text-emerald-400 tabular-nums">
                    {fmtUSD.format(saleStats.totalCommission)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/30 bg-card/30 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground uppercase">This Month</p>
                  <p className="text-sm font-bold text-amber-400 tabular-nums">
                    {saleStats.thisMonth.count}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {fmtUSD.format(saleStats.thisMonth.premium)}
                  </p>
                </div>
              </div>
            )}

            {/* Recent Sales */}
            {sales && sales.length > 0 && (
              <div className="space-y-1.5">
                {sales.slice(0, 5).map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between rounded-md bg-card/40 px-2.5 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">{sale.clientName}</div>
                      <div className="text-muted-foreground">{sale.policyType} · {sale.carrier}</div>
                    </div>
                    <div className="ml-2 text-right">
                      <div className="font-medium text-foreground">{fmtUSD.format(sale.premium)}</div>
                      <SaleStatusBadge status={sale.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sales && sales.length === 0 && !showSaleForm && (
              <p className="text-xs text-muted-foreground">No sales recorded yet.</p>
            )}

            {/* Add Sale Form */}
            {showSaleForm && (
              <div className="space-y-2 rounded-md border border-border bg-card/60 p-3">
                <Input
                  value={saleForm.clientName}
                  onChange={(e) => setSaleForm({ ...saleForm, clientName: e.target.value })}
                  placeholder="Client Name"
                />
                <Select value={saleForm.policyType} onValueChange={(v) => setSaleForm({ ...saleForm, policyType: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POLICY_TYPES.map((pt) => (
                      <SelectItem key={pt} value={pt}>
                        {pt.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  value={saleForm.carrier}
                  onChange={(e) => setSaleForm({ ...saleForm, carrier: e.target.value })}
                  placeholder="Carrier"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={saleForm.premium}
                    onChange={(e) => setSaleForm({ ...saleForm, premium: e.target.value })}
                    placeholder="Premium ($)"
                    type="number"
                    step="0.01"
                  />
                  <Input
                    value={saleForm.commission}
                    onChange={(e) => setSaleForm({ ...saleForm, commission: e.target.value })}
                    placeholder="Commission ($)"
                    type="number"
                    step="0.01"
                  />
                </div>
                <Input
                  value={saleForm.policyNumber}
                  onChange={(e) => setSaleForm({ ...saleForm, policyNumber: e.target.value })}
                  placeholder="Policy Number (optional)"
                />
                <Input
                  value={saleForm.notes}
                  onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })}
                  placeholder="Notes (optional)"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={handleCreateSale}
                    disabled={creatingSale || !saleForm.clientName || !saleForm.carrier || !saleForm.premium}
                  >
                    <IconCurrencyDollar size={14} />
                    {creatingSale ? 'Saving...' : 'Record Sale'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSaleForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-card/30 backdrop-blur border-border/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* Verify License */}
            {stageNum < 5 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
                onClick={handleVerify}
                disabled={verifying}
              >
                <IconShieldCheck size={16} />
                {verifying ? 'Verifying...' : 'Verify License'}
              </Button>
            )}

            {/* Send Message */}
            <div className="flex gap-1.5">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Send a DM..."
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                className="flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendMessage}
                disabled={messaging || !message.trim()}
              >
                <IconSend size={14} />
              </Button>
            </div>

            {/* Change Stage */}
            <Select
              value={String(stageNum)}
              onValueChange={(val) => {
                api.fetchMutate(`/api/v1/agents/${agent.id}/stage`, 'POST', { stage: Number(val) })
                  .then(() => {
                    toast.success('Stage updated')
                    queryClient.invalidateQueries({ queryKey: ['org-chart'] })
                    queryClient.invalidateQueries({ queryKey: ['agent', agent.id] })
                  })
                  .catch(() => toast.error('Failed to update stage'))
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Change stage" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STAGE_NAMES).map(([num, name]) => (
                  <SelectItem key={num} value={num}>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STAGE_COLORS[Number(num)] }} />
                      {name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Remove Manager */}
            {agent.profile?.managerId && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start text-red-400 hover:text-red-300"
                onClick={handleRemoveManager}
                disabled={removingManager}
              >
                <IconUnlink size={16} />
                {removingManager ? 'Removing...' : 'Remove Manager'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      {value ? (
        <span className="text-foreground">{value}</span>
      ) : (
        <span className="text-muted-foreground/40 text-xs italic">Not set</span>
      )}
    </div>
  )
}

const STATUS_BADGE_COLORS: Record<string, string> = {
  submitted: 'bg-amber-500/20 text-amber-400',
  approved: 'bg-blue-500/20 text-blue-400',
  issued: 'bg-purple-500/20 text-purple-400',
  paid: 'bg-emerald-500/20 text-emerald-400',
  cancelled: 'bg-red-500/20 text-red-400',
}

function SaleStatusBadge({ status }: { status: string }) {
  const color = STATUS_BADGE_COLORS[status] ?? 'bg-zinc-500/20 text-muted-foreground'
  return <Badge className={`text-[10px] ${color}`}>{status}</Badge>
}
