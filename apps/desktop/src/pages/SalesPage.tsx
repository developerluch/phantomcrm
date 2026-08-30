import { useState, useMemo } from 'react'
import { getAnnualizedPremium } from '@/lib/premium'
import { motion } from 'framer-motion'
import { useSales, useUpdateSale, useSalesPipeline, useSalesAgentDirectory } from '../hooks/useSales'
import { SALE_STATUSES, POLICY_TYPES } from '../types/portal'
import CreateSaleModal from '../components/sales/CreateSaleModal'
import PipelineFunnel from '../components/sales/PipelineFunnel'
import SalesTable from '../components/sales/SalesTable'
import ChargebackPanel from '../components/sales/ChargebackPanel'
import AgentSalesView from '../components/sales/AgentSalesView'
import SalesAnalytics from '../components/sales/SalesAnalytics'
import BusinessDashboardTab from '../components/business/BusinessDashboardTab'
import SubmittedBusinessTab from '../components/business/SubmittedBusinessTab'
import MetricCard from '../components/MetricCard'
import EmptyState from '../components/EmptyState'
import { toast } from 'sonner'
import { IconReceipt, IconPlus, IconCash, IconTrendingUp, IconChartBar, IconShieldCheck, IconReportAnalytics } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { containerVariants, itemVariants } from '../lib/motion'

const ACTIVE_STATUSES = ['issued', 'paid', 'placed', 'active']
const CHARGEBACKS_BACKEND_ENABLED = import.meta.env.VITE_CHARGEBACKS_BACKEND === 'true'

export default function SalesPage() {
  const [page, setPage] = useState(1)
  const [bookPage, setBookPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [policyTypeFilter, setPolicyTypeFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [activeTab, setActiveTab] = useState('all')

  const { data, isLoading, isError } = useSales({
    page,
    status: statusFilter || undefined,
    agentId: agentFilter || undefined,
    policyType: policyTypeFilter || undefined,
  })
  const updateSale = useUpdateSale()
  const { data: pipeline } = useSalesPipeline({
    agentId: agentFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  })
  const { data: salesAgents } = useSalesAgentDirectory()

  const sales = data?.sales ?? []
  const total = data?.total ?? 0

  const totalPremium = sales.reduce((sum, s) => sum + getAnnualizedPremium(s), 0)
  const totalCommission = sales.reduce((sum, s) => sum + (s.commission ?? 0), 0)

  const activePolicies = useMemo(
    () => sales.filter((s) => ACTIVE_STATUSES.includes(s.status?.toLowerCase())).length,
    [sales],
  )
  const totalAP = useMemo(
    () => sales
      .filter((s) => ACTIVE_STATUSES.includes(s.status?.toLowerCase()))
      .reduce((sum, s) => sum + getAnnualizedPremium(s), 0),
    [sales],
  )

  const agents = (salesAgents ?? [])
    .filter((agent) => agent.isActive !== false)
    .map((agent) => ({
      agentId: agent.agentId,
      displayName: agent.displayName || agent.email || `Agent ${agent.agentId.slice(0, 8)}`,
    }))

  const handleStatusChange = (id: string, newStatus: string) => {
    updateSale.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: () => toast.success('Status updated'),
        onError: () => toast.error('Failed to update status'),
      }
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="h-12 bg-muted/50 rounded-xl animate-pulse" />
        <div className="h-96 bg-muted/30 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Failed to load sales.</p>
      </div>
    )
  }

  const hasActiveFilters = !!(statusFilter || agentFilter || policyTypeFilter)

  if (total === 0 && !hasActiveFilters) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sales & Book of Business</h1>
            <p className="text-sm text-muted-foreground mt-1">Track pipeline, policies, and your full book</p>
          </div>
        </div>
        <EmptyState
          icon={IconReceipt}
          title="No sales recorded"
          description="Start tracking your team's production by recording the first sale."
          action={{ label: 'New Sale', onClick: () => setShowCreate(true) }}
        />
        <CreateSaleModal open={showCreate} onClose={() => setShowCreate(false)} />
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-6 pt-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales & Book of Business</h1>
          <p className="text-sm text-muted-foreground mt-1">Track pipeline, policies, and your full book</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={agentFilter || '_all'} onValueChange={(v) => { setAgentFilter(v === '_all' ? '' : v); setPage(1) }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All agents</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.agentId} value={a.agentId}>{a.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-36"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-36"
          />
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <IconPlus size={16} className="mr-1.5" />
            New Sale
          </Button>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          label="Total Premium"
          value={`$${totalPremium.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<IconCash size={22} />}
          color="#3b82f6"
        />
        <MetricCard
          label="Net Commission"
          value={`$${totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<IconCash size={22} />}
          color="#22c55e"
        />
        <MetricCard
          label="Close Rate"
          value={pipeline ? `${(pipeline.closeRate * 100).toFixed(1)}%` : '—'}
          icon={<IconTrendingUp size={22} />}
          color="#8b5cf6"
        />
        <MetricCard
          label="Persistency"
          value={pipeline ? `${(pipeline.persistencyRate * 100).toFixed(1)}%` : '—'}
          icon={<IconChartBar size={22} />}
          color="#14b8a6"
        />
        <MetricCard
          label="Active Policies"
          value={activePolicies.toLocaleString()}
          icon={<IconShieldCheck size={22} />}
          color="#f59e0b"
        />
        <MetricCard
          label="Total AP"
          value={`$${totalAP.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={<IconReportAnalytics size={22} />}
          color="#ec4899"
        />
      </motion.div>

      {/* Tabs */}
      <motion.div variants={itemVariants}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All Sales</TabsTrigger>
            <TabsTrigger value="book">Book of Business</TabsTrigger>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="agent">By Agent</TabsTrigger>
            {CHARGEBACKS_BACKEND_ENABLED ? (
              <TabsTrigger value="chargebacks">Chargebacks</TabsTrigger>
            ) : (
              <TabsTrigger value="chargebacks-disabled" disabled>Chargebacks unavailable</TabsTrigger>
            )}
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>
          {!CHARGEBACKS_BACKEND_ENABLED && (
            <p className="mt-2 text-xs text-muted-foreground">Chargebacks are not available yet in the production backend.</p>
          )}

          <TabsContent value="all" className="mt-6 space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={statusFilter || '_all'} onValueChange={(v) => { setStatusFilter(v === '_all' ? '' : v); setPage(1) }}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All statuses</SelectItem>
                  {SALE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={policyTypeFilter || '_all'} onValueChange={(v) => { setPolicyTypeFilter(v === '_all' ? '' : v); setPage(1) }}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All policy types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">All policy types</SelectItem>
                  {POLICY_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="ml-auto text-sm text-muted-foreground">
                {total} sales &middot; ${totalPremium.toLocaleString()} total premium
              </div>
            </div>

            <SalesTable
              sales={sales}
              total={total}
              page={page}
              onPageChange={setPage}
              onStatusChange={handleStatusChange}
            />
          </TabsContent>

          <TabsContent value="book" className="mt-6">
            <SubmittedBusinessTab
              sales={sales}
              total={total}
              page={bookPage}
              onPageChange={setBookPage}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="pipeline" className="mt-6">
            <PipelineFunnel
              agentId={agentFilter || undefined}
              dateFrom={dateFrom || undefined}
              dateTo={dateTo || undefined}
            />
          </TabsContent>

          <TabsContent value="agent" className="mt-6">
            <AgentSalesView agents={agents} />
          </TabsContent>

          {CHARGEBACKS_BACKEND_ENABLED && (
            <TabsContent value="chargebacks" className="mt-6">
              <ChargebackPanel agentId={agentFilter || undefined} />
            </TabsContent>
          )}

          <TabsContent value="analytics" className="mt-6 space-y-6">
            <SalesAnalytics
              agentId={agentFilter || undefined}
              dateFrom={dateFrom || undefined}
              dateTo={dateTo || undefined}
            />
            <BusinessDashboardTab sales={sales} isLoading={isLoading} />
          </TabsContent>
        </Tabs>
      </motion.div>

      <CreateSaleModal open={showCreate} onClose={() => setShowCreate(false)} />
    </motion.div>
  )
}
