import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { useSales, useUpdateSale, useSalesAgentDirectory } from '../hooks/useSales'
import { useRepairAuthIdentity } from '../hooks/useAuthRepair'
import { useAuthStore } from '../store'
import ImportPoliciesDialog from '../components/sales/import/ImportPoliciesDialog'
import SalesTable from '../components/sales/SalesTable'
import EmptyState from '../components/EmptyState'
import MockModeBanner from '../components/sales/MockModeBanner'
import PoliciesSummaryStrip from '../components/sales/PoliciesSummaryStrip'
import PoliciesToolbar, { type SubmitBusinessMode } from '../components/sales/PoliciesToolbar'
import PolicyPageSwitcher from '../components/sales/PolicyPageSwitcher'
import { toast } from 'sonner'
import { IconAlertTriangle, IconLoader2, IconReceipt } from '@tabler/icons-react'
import { containerVariants, itemVariants } from '../lib/motion'
import { getAccountAgentId } from '../lib/agent-id'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

export default function BookOfBusinessPage() {
  const [submitBusinessMode, setSubmitBusinessMode] = useState<SubmitBusinessMode | null>(null)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('all')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const [datePreset, setDatePreset] = useState<string>('all')
  const [searchValue, setSearchValue] = useState('')

  const user = useAuthStore((s) => s.user)
  const accountAgentId = getAccountAgentId(user)
  const repairAuth = useRepairAuthIdentity()
  const { data: salesAgents, isLoading: agentsLoading } = useSalesAgentDirectory()
  const currentSalesAgentId =
    accountAgentId || salesAgents?.find((agent) => agent.isCurrentUser)?.agentId || ''
  const agents = useMemo(
    () =>
      (salesAgents ?? [])
        .filter((agent) => agent.agentId !== currentSalesAgentId && agent.isActive !== false)
        .map((agent) => ({
          agentId: agent.agentId,
          displayName: agent.displayName,
          email: agent.email,
        })),
    [currentSalesAgentId, salesAgents],
  )

  const agentIdParam = useMemo(() => {
    if (agentFilter === 'all') return undefined
    if (agentFilter === 'mine') return currentSalesAgentId || undefined
    return agentFilter
  }, [agentFilter, currentSalesAgentId])

  const { data: salesData, isLoading } = useSales({
    page,
    status: statusFilter || undefined,
    agentId: agentIdParam,
    dateFrom: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
    dateTo: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined,
  })

  const updateSale = useUpdateSale()

  const sales = salesData?.sales ?? []
  const totalSales = salesData?.total ?? 0

  const filteredSales = useMemo(() => {
    const q = searchValue.trim().toLowerCase()
    if (!q) return sales
    return sales.filter((s) => {
      const name = (s.clientName ?? '').toLowerCase()
      const policy = (s.policyNumber ?? '').toLowerCase()
      return name.includes(q) || policy.includes(q)
    })
  }, [sales, searchValue])

  const displayTotal = searchValue.trim() ? filteredSales.length : totalSales

  const handleStatusChange = (id: string, newStatus: string) => {
    updateSale.mutate(
      { id, data: { status: newStatus } },
      { onSuccess: () => toast.success('Status updated') },
    )
  }

  const handleRepairAccountAgentId = () => {
    repairAuth.mutate(undefined, {
      onSuccess: (repaired) => {
        if (getAccountAgentId(repaired)) {
          toast.success('Account Agent ID repaired')
        } else {
          toast.error('Repair completed, but no Account Agent ID was returned')
        }
      },
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : 'Failed to repair Account Agent ID'),
    })
  }

  const handleSubmitBusiness = () => {
    if (currentSalesAgentId) {
      setSubmitBusinessMode('manual')
      return
    }
    repairAuth.mutate(undefined, {
      onSuccess: (repaired) => {
        if (getAccountAgentId(repaired)) {
          toast.success('Account Agent ID repaired')
          setSubmitBusinessMode('manual')
        } else {
          toast.error('Repair completed, but no Account Agent ID was returned')
        }
      },
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : 'Failed to repair Account Agent ID'),
    })
  }

  return (
    <motion.div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="sticky top-0 z-30 -mx-6 flex-shrink-0 space-y-5 border-b border-border/40 bg-background/80 px-6 pt-6 pb-5 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <MockModeBanner />

        {!currentSalesAgentId && (
          <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-100">
            <IconAlertTriangle className="text-amber-300" />
            <AlertTitle>Account Agent ID missing</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>Submit Business needs a backend Account Agent ID before policies can be assigned.</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRepairAccountAgentId}
                disabled={repairAuth.isPending}
                className="border-amber-300/40 bg-background/40"
              >
                {repairAuth.isPending ? (
                  <>
                    <IconLoader2 size={14} className="animate-spin" />
                    Repairing
                  </>
                ) : (
                  'Repair Agent ID'
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <motion.div variants={itemVariants} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Book of Business</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage all policies and submit new business.</p>
          </div>
          <div className="justify-self-center">
            <PolicyPageSwitcher />
          </div>
          <div aria-hidden />
        </motion.div>

        <motion.div variants={itemVariants}>
          <PoliciesToolbar
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            statusFilter={statusFilter}
            onStatusFilterChange={(v) => {
              setStatusFilter(v)
              setPage(1)
            }}
            agentFilter={agentFilter}
            onAgentFilterChange={(v) => {
              setAgentFilter(v)
              setPage(1)
            }}
            dateRange={dateRange}
            onDateRangeChange={(r) => {
              setDateRange(r)
              setPage(1)
            }}
            datePreset={datePreset}
            onDatePresetChange={setDatePreset}
            agents={agents}
            accountAgentId={currentSalesAgentId}
            agentsLoading={agentsLoading}
            onSubmitBusiness={handleSubmitBusiness}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <PoliciesSummaryStrip sales={sales} isLoading={isLoading} />
        </motion.div>
      </div>

      <motion.div variants={itemVariants} className="flex min-h-0 flex-1 flex-col overflow-y-auto pt-5 pr-1">
        {isLoading ? (
          <div className="h-64 bg-muted/30 rounded-xl animate-pulse" />
        ) : totalSales === 0 && !statusFilter && agentFilter === 'all' ? (
          <EmptyState
            icon={IconReceipt}
            title="No policies found"
            description="Start tracking your business by submitting the first policy."
            action={{ label: 'Submit Business', onClick: handleSubmitBusiness }}
          />
        ) : (
          <SalesTable
            sales={filteredSales}
            total={displayTotal}
            page={page}
            onPageChange={setPage}
            onStatusChange={handleStatusChange}
          />
        )}
      </motion.div>

      <ImportPoliciesDialog
        open={submitBusinessMode !== null}
        initialTab={submitBusinessMode ?? 'manual'}
        onClose={() => setSubmitBusinessMode(null)}
      />
    </motion.div>
  )
}
