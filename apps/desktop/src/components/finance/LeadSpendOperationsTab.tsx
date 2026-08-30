import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  IconChartBar,
  IconFilterOff,
  IconPlugConnected,
  IconPlus,
  IconReceipt,
  IconRepeat,
  IconTrash,
  IconTrendingUp,
  IconUsers,
} from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import EmptyState from '../EmptyState'
import MetricCard from '../MetricCard'
import EmailInvoiceImportTab from './EmailInvoiceImportTab'
import { useAuthStore } from '../../store'
import { useMyTeam } from '../../hooks/useOrgChart'
import {
  LEAD_BATCH_STATUSES,
  LEAD_COST_MODELS,
  LEAD_INTEGRATION_STATUSES,
  LEAD_SOURCE_STATUSES,
  LEAD_VENDOR_TYPES,
  RECURRING_SPEND_CADENCES,
  addCadenceDate,
  deleteLeadSpendBatch,
  getLeadSourceProfiles,
  getLeadSpendBatches,
  getRecurringSpendRules,
  getVendorSyncStatuses,
  saveLeadSourceProfile,
  saveLeadSpendBatch,
  saveRecurringSpendRule,
  updateLeadSourceProfile,
  updateRecurringSpendRule,
  upsertVendorSyncStatus,
  type LeadBatchStatus,
  type LeadCostModel,
  type LeadIntegrationStatus,
  type LeadSourceProfile,
  type LeadSourceStatus,
  type LeadSpendBatch,
  type LeadVendorType,
  type RecurringSpendCadence,
} from '../../lib/lead-spend-local'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

const chartConfig = {
  spend: { label: 'Spend', color: 'hsl(var(--primary))' },
  leads: { label: 'Leads', color: '#3b82f6' },
} satisfies ChartConfig

function label(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char: string) => char.toUpperCase())
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function currentPeriod() {
  return new Date().toISOString().slice(0, 7)
}

function statusVariant(status: string) {
  if (['active', 'api_connected'].includes(status)) return 'success'
  if (['testing', 'import_only', 'needs_review'].includes(status)) return 'warning'
  if (['paused', 'disputed', 'killed'].includes(status)) return 'destructive'
  return 'secondary'
}

export default function LeadSpendOperationsTab() {
  const user = useAuthStore((state) => state.user)
  const { data: teamAgents } = useMyTeam()
  const [sources, setSources] = useState<LeadSourceProfile[]>(() => getLeadSourceProfiles())
  const [batches, setBatches] = useState<LeadSpendBatch[]>(() => getLeadSpendBatches())
  const [rules, setRules] = useState(() => getRecurringSpendRules())
  const [syncStatuses, setSyncStatuses] = useState(() => getVendorSyncStatuses())
  const [sourceFilter, setSourceFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')
  const [sourceForm, setSourceForm] = useState({
    name: '',
    vendorType: 'internet' as LeadVendorType,
    status: 'testing' as LeadSourceStatus,
    contactName: '',
    contactEmail: '',
    targetStates: '',
    targetProducts: '',
    costModel: 'per_lead' as LeadCostModel,
    integrationStatus: 'manual' as LeadIntegrationStatus,
    notes: '',
  })
  const [batchForm, setBatchForm] = useState({
    sourceId: '',
    campaignName: '',
    agentId: user?.discordId ?? '',
    purchaseDate: today(),
    period: currentPeriod(),
    leadCount: '',
    totalSpend: '',
    receiptUrl: '',
    status: 'active' as LeadBatchStatus,
    notes: '',
  })
  const [ruleForm, setRuleForm] = useState({
    sourceId: '',
    agentId: user?.discordId ?? '',
    cadence: 'weekly' as RecurringSpendCadence,
    amount: '',
    expectedLeadCount: '',
    startDate: today(),
    endDate: '',
    nextRunDate: today(),
    notes: '',
  })

  const agentOptions = useMemo(() => {
    const options = new Map<string, string>()
    if (user?.discordId) options.set(user.discordId, user.displayName || 'My Business')
    ;(teamAgents ?? []).forEach((agent) => {
      const name = [agent.firstName, agent.lastName].filter(Boolean).join(' ').trim()
      options.set(agent.id, name || agent.discordUsername || agent.id)
    })
    return [...options.entries()].map(([id, name]) => ({ id, name }))
  }, [teamAgents, user?.discordId, user?.displayName])

  const sourceName = (sourceId: string) => sources.find((source) => source.id === sourceId)?.name ?? 'Unknown source'
  const agentName = (agentId: string) => agentOptions.find((agent) => agent.id === agentId)?.name ?? agentId

  const filteredBatches = useMemo(
    () =>
      batches.filter((batch) => {
        if (sourceFilter && batch.sourceId !== sourceFilter) return false
        if (agentFilter && batch.agentId !== agentFilter) return false
        if (periodFrom && batch.period < periodFrom) return false
        if (periodTo && batch.period > periodTo) return false
        return true
      }),
    [agentFilter, batches, periodFrom, periodTo, sourceFilter],
  )

  const totals = useMemo(() => {
    const totalSpend = filteredBatches.reduce((sum, batch) => sum + batch.totalSpend, 0)
    const totalLeads = filteredBatches.reduce((sum, batch) => sum + batch.leadCount, 0)
    return {
      totalSpend,
      totalLeads,
      cpl: totalLeads > 0 ? totalSpend / totalLeads : 0,
      projectedNet: totalSpend * 1.8,
    }
  }, [filteredBatches])

  const chartData = useMemo(
    () =>
      sources.map((source) => {
        const sourceBatches = filteredBatches.filter((batch) => batch.sourceId === source.id)
        return {
          source: source.name,
          spend: sourceBatches.reduce((sum, batch) => sum + batch.totalSpend, 0),
          leads: sourceBatches.reduce((sum, batch) => sum + batch.leadCount, 0),
        }
      }).filter((row) => row.spend > 0 || row.leads > 0),
    [filteredBatches, sources],
  )

  const refreshLocal = () => {
    setSources(getLeadSourceProfiles())
    setBatches(getLeadSpendBatches())
    setRules(getRecurringSpendRules())
    setSyncStatuses(getVendorSyncStatuses())
  }

  const handleCreateSource = () => {
    const name = sourceForm.name.trim()
    if (!name) {
      toast.error('Lead source name is required')
      return
    }
    const source = saveLeadSourceProfile({ ...sourceForm, name, notes: sourceForm.notes.trim() })
    upsertVendorSyncStatus({
      sourceId: source.id,
      provider: source.name,
      status: source.integrationStatus,
      lastSyncAt: '',
      importedBatchCount: 0,
      errorMessage: '',
      manualOverride: source.integrationStatus === 'manual',
    })
    setSourceForm({ ...sourceForm, name: '', contactName: '', contactEmail: '', targetStates: '', targetProducts: '', notes: '' })
    setBatchForm((current) => ({ ...current, sourceId: source.id }))
    setRuleForm((current) => ({ ...current, sourceId: source.id }))
    refreshLocal()
    toast.success('Lead source created')
  }

  const handleCreateBatch = () => {
    const leadCount = Number(batchForm.leadCount)
    const totalSpend = Number(batchForm.totalSpend)
    if (!batchForm.sourceId || !batchForm.agentId || leadCount <= 0 || totalSpend <= 0) {
      toast.error('Source, agent, lead count, and spend are required')
      return
    }
    saveLeadSpendBatch({
      ...batchForm,
      campaignName: batchForm.campaignName.trim() || `${sourceName(batchForm.sourceId)} ${batchForm.period}`,
      agentName: agentName(batchForm.agentId),
      leadCount,
      totalSpend,
      notes: batchForm.notes.trim(),
    })
    setBatchForm({ ...batchForm, campaignName: '', leadCount: '', totalSpend: '', receiptUrl: '', notes: '' })
    refreshLocal()
    toast.success('Spend batch logged')
  }

  const handleCreateRule = () => {
    const amount = Number(ruleForm.amount)
    const expectedLeadCount = Number(ruleForm.expectedLeadCount)
    if (!ruleForm.sourceId || !ruleForm.agentId || amount <= 0 || expectedLeadCount <= 0) {
      toast.error('Source, agent, amount, and expected lead count are required')
      return
    }
    saveRecurringSpendRule({
      ...ruleForm,
      amount,
      expectedLeadCount,
      agentName: agentName(ruleForm.agentId),
      active: true,
      notes: ruleForm.notes.trim(),
    })
    setRuleForm({ ...ruleForm, amount: '', expectedLeadCount: '', notes: '' })
    refreshLocal()
    toast.success('Recurring spend rule created')
  }

  const runRuleNow = (ruleId: string) => {
    const rule = rules.find((item) => item.id === ruleId)
    if (!rule || !rule.active) return
    saveLeadSpendBatch({
      sourceId: rule.sourceId,
      campaignName: `${sourceName(rule.sourceId)} recurring ${rule.nextRunDate}`,
      agentId: rule.agentId,
      agentName: rule.agentName,
      purchaseDate: rule.nextRunDate,
      period: rule.nextRunDate.slice(0, 7),
      leadCount: rule.expectedLeadCount,
      totalSpend: rule.amount,
      receiptUrl: '',
      notes: rule.notes,
      status: 'active',
      createdByRuleId: rule.id,
    })
    updateRecurringSpendRule(rule.id, { nextRunDate: addCadenceDate(rule.nextRunDate, rule.cadence) })
    refreshLocal()
    toast.success('Recurring batch created')
  }

  const toggleSourceStatus = (source: LeadSourceProfile) => {
    updateLeadSourceProfile(source.id, { status: source.status === 'paused' ? 'active' : 'paused' })
    refreshLocal()
  }

  const clearFilters = () => {
    setSourceFilter('')
    setAgentFilter('')
    setPeriodFrom('')
    setPeriodTo('')
  }

  const hasFilters = !!(sourceFilter || agentFilter || periodFrom || periodTo)

  return (
    <div className="h-full space-y-5 overflow-y-auto pr-1 pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard label="Lead Spend" value={currency.format(totals.totalSpend)} icon={<IconReceipt size={22} />} color="#f59e0b" sparklineData={filteredBatches.map((batch) => batch.totalSpend)} />
        <MetricCard label="Leads Bought" value={totals.totalLeads.toLocaleString()} icon={<IconUsers size={22} />} color="#3b82f6" sparklineData={filteredBatches.map((batch) => batch.leadCount)} />
        <MetricCard label="Cost Per Lead" value={money.format(totals.cpl)} icon={<IconChartBar size={22} />} color="#22c55e" />
        <MetricCard label="Projected Net" value={currency.format(totals.projectedNet)} icon={<IconTrendingUp size={22} />} color="#22c55e" />
      </div>

      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <Select value={sourceFilter || '_all'} onValueChange={(value) => setSourceFilter(value === '_all' ? '' : value)}>
            <SelectTrigger className="w-52"><SelectValue placeholder="All lead sources" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All lead sources</SelectItem>
              {sources.map((source) => <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={agentFilter || '_all'} onValueChange={(value) => setAgentFilter(value === '_all' ? '' : value)}>
            <SelectTrigger className="w-52"><SelectValue placeholder="All agents" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All agents</SelectItem>
              {agentOptions.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="month" value={periodFrom} onChange={(event) => setPeriodFrom(event.target.value)} className="w-40" />
          <Input type="month" value={periodTo} onChange={(event) => setPeriodTo(event.target.value)} className="w-40" />
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <IconFilterOff size={14} className="mr-1.5" />
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="manual">
        <TabsList>
          <TabsTrigger value="manual">Manual Ops</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="recurring">Recurring Rules</TabsTrigger>
          <TabsTrigger value="email-import">Email Invoice Import</TabsTrigger>
          <TabsTrigger value="sync">Vendor Sync</TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-[420px_minmax(0,1fr)] gap-4">
            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Log Spend Batch</CardTitle>
                <CardDescription>Track each vendor purchase, campaign, agent assignment, and receipt.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={batchForm.sourceId || undefined} onValueChange={(sourceId) => setBatchForm({ ...batchForm, sourceId })}>
                  <SelectTrigger><SelectValue placeholder="Lead source" /></SelectTrigger>
                  <SelectContent>{sources.map((source) => <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={batchForm.campaignName} onChange={(event) => setBatchForm({ ...batchForm, campaignName: event.target.value })} placeholder="Campaign name" />
                <Select value={batchForm.agentId || undefined} onValueChange={(agentId) => setBatchForm({ ...batchForm, agentId })}>
                  <SelectTrigger><SelectValue placeholder="Assigned agent" /></SelectTrigger>
                  <SelectContent>{agentOptions.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>)}</SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="date" value={batchForm.purchaseDate} onChange={(event) => setBatchForm({ ...batchForm, purchaseDate: event.target.value })} />
                  <Input type="month" value={batchForm.period} onChange={(event) => setBatchForm({ ...batchForm, period: event.target.value })} />
                  <Input type="number" min="0" value={batchForm.totalSpend} onChange={(event) => setBatchForm({ ...batchForm, totalSpend: event.target.value })} placeholder="Spend" />
                  <Input type="number" min="0" value={batchForm.leadCount} onChange={(event) => setBatchForm({ ...batchForm, leadCount: event.target.value })} placeholder="Lead count" />
                </div>
                <Select value={batchForm.status} onValueChange={(status) => setBatchForm({ ...batchForm, status: status as LeadBatchStatus })}>
                  <SelectTrigger><SelectValue placeholder="Batch status" /></SelectTrigger>
                  <SelectContent>{LEAD_BATCH_STATUSES.map((status) => <SelectItem key={status} value={status}>{label(status)}</SelectItem>)}</SelectContent>
                </Select>
                <Input value={batchForm.receiptUrl} onChange={(event) => setBatchForm({ ...batchForm, receiptUrl: event.target.value })} placeholder="Receipt URL" />
                <Textarea value={batchForm.notes} onChange={(event) => setBatchForm({ ...batchForm, notes: event.target.value })} placeholder="Quality notes, states, product focus..." />
                <Button className="w-full" onClick={handleCreateBatch} disabled={sources.length === 0}>Save Spend Batch</Button>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur border-border/50">
              <CardHeader>
                <CardTitle className="text-base">Source Performance</CardTitle>
                <CardDescription>Batch rollups by source. Policy-issued and chargeback attribution plugs in once backend linkage lands.</CardDescription>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-72 w-full">
                    <BarChart data={chartData}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="source" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="spend" fill="var(--color-spend)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <EmptyState icon={IconReceipt} title="No spend batches yet" description="Create a lead source, then log the first spend batch." />
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Spend Batch Ledger</CardTitle>
              <CardDescription>Normalized operating ledger for vendor spend and lead volume.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">CPL</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBatches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{batch.period}</TableCell>
                      <TableCell>{sourceName(batch.sourceId)}</TableCell>
                      <TableCell>{batch.campaignName}</TableCell>
                      <TableCell className="text-muted-foreground">{batch.agentName}</TableCell>
                      <TableCell className="text-right font-mono">{money.format(batch.totalSpend)}</TableCell>
                      <TableCell className="text-right font-mono">{batch.leadCount}</TableCell>
                      <TableCell className="text-right font-mono">{money.format(batch.totalSpend / Math.max(batch.leadCount, 1))}</TableCell>
                      <TableCell><Badge variant={statusVariant(batch.status)}>{label(batch.status)}</Badge></TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => { deleteLeadSpendBatch(batch.id); refreshLocal(); }}>
                          <IconTrash size={14} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredBatches.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-10">No spend batches found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vendors" className="space-y-4 mt-4">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Vendor / Lead Source Profile</CardTitle>
              <CardDescription>Store operational details QuickBooks cannot model.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <Input value={sourceForm.name} onChange={(event) => setSourceForm({ ...sourceForm, name: event.target.value })} placeholder="Goat Leads, SmartFinancial..." />
              <Input value={sourceForm.contactEmail} onChange={(event) => setSourceForm({ ...sourceForm, contactEmail: event.target.value })} placeholder="Vendor email" />
              <Input value={sourceForm.targetStates} onChange={(event) => setSourceForm({ ...sourceForm, targetStates: event.target.value })} placeholder="Target states" />
              <Input value={sourceForm.targetProducts} onChange={(event) => setSourceForm({ ...sourceForm, targetProducts: event.target.value })} placeholder="Target products" />
              <Select value={sourceForm.vendorType} onValueChange={(vendorType) => setSourceForm({ ...sourceForm, vendorType: vendorType as LeadVendorType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEAD_VENDOR_TYPES.map((type) => <SelectItem key={type} value={type}>{label(type)}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={sourceForm.costModel} onValueChange={(costModel) => setSourceForm({ ...sourceForm, costModel: costModel as LeadCostModel })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEAD_COST_MODELS.map((model) => <SelectItem key={model} value={model}>{label(model)}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={sourceForm.status} onValueChange={(status) => setSourceForm({ ...sourceForm, status: status as LeadSourceStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEAD_SOURCE_STATUSES.map((status) => <SelectItem key={status} value={status}>{label(status)}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={sourceForm.integrationStatus} onValueChange={(integrationStatus) => setSourceForm({ ...sourceForm, integrationStatus: integrationStatus as LeadIntegrationStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{LEAD_INTEGRATION_STATUSES.map((status) => <SelectItem key={status} value={status}>{label(status)}</SelectItem>)}</SelectContent>
              </Select>
              <Textarea className="md:col-span-2 xl:col-span-3" value={sourceForm.notes} onChange={(event) => setSourceForm({ ...sourceForm, notes: event.target.value })} placeholder="Vendor notes, API/import details, quality issues..." />
              <Button onClick={handleCreateSource}>Create Lead Source</Button>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {sources.map((source) => (
              <motion.div key={source.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="bg-card/50 backdrop-blur border-border/50">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{source.name}</CardTitle>
                        <CardDescription>{label(source.vendorType)} · {label(source.costModel)}</CardDescription>
                      </div>
                      <Badge variant={statusVariant(source.status)}>{label(source.status)}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <p className="text-muted-foreground">{source.targetStates || 'No states'} · {source.targetProducts || 'No products'}</p>
                    <p className="text-muted-foreground line-clamp-2">{source.notes || 'No operating notes yet.'}</p>
                    <div className="flex items-center justify-between">
                      <Badge variant={statusVariant(source.integrationStatus)}>{label(source.integrationStatus)}</Badge>
                      <Button variant="outline" size="sm" onClick={() => toggleSourceStatus(source)}>
                        {source.status === 'paused' ? 'Resume' : 'Pause'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="recurring" className="space-y-4 mt-4">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Recurring Spend Rule</CardTitle>
              <CardDescription>Example: $1,500 weekly to Goat Leads, assigned to one rep.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <Select value={ruleForm.sourceId || undefined} onValueChange={(sourceId) => setRuleForm({ ...ruleForm, sourceId })}>
                <SelectTrigger><SelectValue placeholder="Lead source" /></SelectTrigger>
                <SelectContent>{sources.map((source) => <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={ruleForm.agentId || undefined} onValueChange={(agentId) => setRuleForm({ ...ruleForm, agentId })}>
                <SelectTrigger><SelectValue placeholder="Assigned agent" /></SelectTrigger>
                <SelectContent>{agentOptions.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={ruleForm.cadence} onValueChange={(cadence) => setRuleForm({ ...ruleForm, cadence: cadence as RecurringSpendCadence })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RECURRING_SPEND_CADENCES.map((cadence) => <SelectItem key={cadence} value={cadence}>{label(cadence)}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="number" value={ruleForm.amount} onChange={(event) => setRuleForm({ ...ruleForm, amount: event.target.value })} placeholder="Amount" />
              <Input type="number" value={ruleForm.expectedLeadCount} onChange={(event) => setRuleForm({ ...ruleForm, expectedLeadCount: event.target.value })} placeholder="Expected leads" />
              <Input type="date" value={ruleForm.startDate} onChange={(event) => setRuleForm({ ...ruleForm, startDate: event.target.value })} />
              <Input type="date" value={ruleForm.nextRunDate} onChange={(event) => setRuleForm({ ...ruleForm, nextRunDate: event.target.value })} />
              <Button onClick={handleCreateRule} disabled={sources.length === 0}>Create Rule</Button>
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Cadence</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Expected Leads</TableHead>
                    <TableHead>Next Run</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>{sourceName(rule.sourceId)}</TableCell>
                      <TableCell>{rule.agentName}</TableCell>
                      <TableCell>{label(rule.cadence)}</TableCell>
                      <TableCell className="text-right font-mono">{money.format(rule.amount)}</TableCell>
                      <TableCell className="text-right font-mono">{rule.expectedLeadCount}</TableCell>
                      <TableCell className="font-mono text-xs">{rule.nextRunDate}</TableCell>
                      <TableCell><Badge variant={rule.active ? 'success' : 'secondary'}>{rule.active ? 'Active' : 'Paused'}</Badge></TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm" onClick={() => { updateRecurringSpendRule(rule.id, { active: !rule.active }); refreshLocal(); }}>
                          {rule.active ? 'Pause' : 'Resume'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => runRuleNow(rule.id)} disabled={!rule.active}>
                          Run Now
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rules.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-10">No recurring spend rules yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email-import" className="mt-4">
          <EmailInvoiceImportTab />
        </TabsContent>

        <TabsContent value="sync" className="space-y-4 mt-4">
          <Card className="bg-card/50 backdrop-blur border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Vendor Integration Layer</CardTitle>
              <CardDescription>Approved APIs, CSV exports, invoice imports, and email parsing. Unauthorized reverse-engineered connectors stay out of production scope.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {syncStatuses.map((status) => (
                <Card key={status.id} className="bg-background/50 border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <IconPlugConnected size={16} />
                      {sourceName(status.sourceId)}
                    </CardTitle>
                    <CardDescription>{status.provider}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-xs">
                    <Badge variant={statusVariant(status.status)}>{label(status.status)}</Badge>
                    <p className="text-muted-foreground">Last sync: {status.lastSyncAt || 'Never'}</p>
                    <p className="text-muted-foreground">Imported batches: {status.importedBatchCount}</p>
                    <p className="text-muted-foreground">{status.errorMessage || 'No sync errors.'}</p>
                  </CardContent>
                </Card>
              ))}
              {syncStatuses.length === 0 && (
                <EmptyState icon={IconPlugConnected} title="No vendor sync profiles" description="Create a lead source to initialize manual/import/API sync tracking." />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
