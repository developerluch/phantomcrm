import { useState, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import {
  IconCash,
  IconPlus,
  IconTrash,
  IconChevronLeft,
  IconChevronRight,
  IconX,
  IconFilterOff,
} from '@tabler/icons-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ChartConfig } from '@/components/ui/chart'
import EmptyState from '../components/EmptyState'
import MetricCard from '../components/MetricCard'
import LeadSpendOperationsTab from '../components/finance/LeadSpendOperationsTab'
import { useExpenses, useCreateExpense, useDeleteExpense, useFinanceSummary, useLeadROI } from '../hooks/useExpenses'
import { EXPENSE_CATEGORIES } from '../types/portal'
import type { FinanceSummary, LeadROI } from '../types/portal'
import { createExpenseSchema, type CreateExpenseFormData } from '../lib/schemas'

type Tab = 'lead-spend' | 'expenses' | 'pnl'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24, mass: 0.8 } },
}

const monthlyChartConfig = {
  revenue: { label: 'Revenue', color: '#3b82f6' },
  expenses: { label: 'Expenses', color: '#f59e0b' },
} satisfies ChartConfig

const ROI_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4']

function dollarFormatter(value: number): string {
  return `$${value.toLocaleString()}`
}

function computeTrend(data: { month: string; revenue: number; expenses: number; net: number }[] | undefined, key: 'revenue' | 'expenses' | 'net'): number | undefined {
  if (!data || data.length < 2) return undefined
  const prev = data[data.length - 2][key]
  const curr = data[data.length - 1][key]
  if (prev === 0) return undefined
  return ((curr - prev) / Math.abs(prev)) * 100
}

function buildRoiChartConfig(roiData: LeadROI[]): ChartConfig {
  const config: Record<string, { label: string; color: string }> = {}
  roiData.forEach((r, i) => {
    config[r.source] = { label: r.source, color: ROI_COLORS[i % ROI_COLORS.length] }
  })
  return config
}

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<Tab>('lead-spend')

  // -- Expenses tab state --
  const [page, setPage] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading, isError } = useExpenses({
    page,
    category: categoryFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  })
  const createExpense = useCreateExpense()
  const deleteExpense = useDeleteExpense()

  const expenses = data?.expenses ?? []
  const total = data?.total ?? 0
  const perPage = 20
  const pageCount = Math.ceil(total / perPage)

  // -- P&L tab data --
  const { data: summary, isLoading: summaryLoading } = useFinanceSummary({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  })
  const { data: leadROI, isLoading: roiLoading } = useLeadROI()

  // -- Computed chart data --
  const roiChartData = useMemo(() => {
    if (!leadROI) return []
    return leadROI.map((r) => ({ name: r.source, value: r.cost }))
  }, [leadROI])

  const roiChartConfig = useMemo(() => {
    if (!leadROI) return {} as ChartConfig
    return buildRoiChartConfig(leadROI)
  }, [leadROI])

  const revenueTrend = useMemo(() => computeTrend(summary?.byMonth, 'revenue'), [summary])
  const expensesTrend = useMemo(() => computeTrend(summary?.byMonth, 'expenses'), [summary])
  const netTrend = useMemo(() => computeTrend(summary?.byMonth, 'net'), [summary])

  // -- Inline form --
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateExpenseFormData>({
    resolver: zodResolver(createExpenseSchema),
  })

  const onSubmit = (formData: CreateExpenseFormData) => {
    createExpense.mutate(
      {
        category: formData.category,
        description: formData.description,
        amount: formData.amount,
        expenseDate: formData.expenseDate || undefined,
        agentDiscordId: formData.agentDiscordId || undefined,
        receiptUrl: formData.receiptUrl || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Expense created')
          reset()
          setShowForm(false)
        },
        onError: () => toast.error('Failed to create expense'),
      }
    )
  }

  const handleDelete = (id: string) => {
    deleteExpense.mutate(id, {
      onSuccess: () => toast.success('Expense deleted'),
      onError: () => toast.error('Failed to delete expense'),
    })
  }

  const resetFilters = () => {
    setCategoryFilter('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const hasActiveFilters = !!(categoryFilter || dateFrom || dateTo)

  // -- Loading: Expenses tab --
  if (activeTab === 'expenses' && isLoading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="h-7 w-44 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-[60vh] bg-muted/30 rounded-xl animate-pulse" />
      </div>
    )
  }

  // -- Loading: P&L tab --
  if (activeTab === 'pnl' && summaryLoading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="h-7 w-44 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-muted/30 rounded-xl animate-pulse" />
        <div className="h-48 bg-muted/30 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Failed to load finance data.</p>
      </div>
    )
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-5 pt-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Finance</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Track lead spend, receipts, revenue, and policy profitability.</p>
        </div>
      </motion.div>

      {/* Tab toggle */}
      <motion.div variants={itemVariants}>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="lead-spend">Lead Spend</TabsTrigger>
            <TabsTrigger value="expenses">Receipts</TabsTrigger>
            <TabsTrigger value="pnl">P&L Summary</TabsTrigger>
          </TabsList>
        </Tabs>
      </motion.div>

      {activeTab === 'lead-spend' && (
        <motion.div variants={itemVariants}>
          <LeadSpendOperationsTab />
        </motion.div>
      )}

      {/* EXPENSES TAB */}
      {activeTab === 'expenses' && (
        <>
          {/* Filters */}
          <motion.div variants={itemVariants} className="flex items-center gap-3 flex-wrap">
            <Select value={categoryFilter || "_all"} onValueChange={(v) => { setCategoryFilter(v === "_all" ? "" : v); setPage(1) }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All categories</SelectItem>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
              className="w-40"
              placeholder="From date"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
              className="w-40"
              placeholder="To date"
            />
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <IconFilterOff size={14} className="mr-1.5" />
                Reset
              </Button>
            )}
            <div className="ml-auto">
              <Button size="sm" onClick={() => setShowForm(!showForm)}>
                {showForm ? (
                  <>
                    <IconX size={16} className="mr-1.5" />
                    Cancel
                  </>
                ) : (
                  <>
                    <IconPlus size={16} className="mr-1.5" />
                    Add Expense
                  </>
                )}
              </Button>
            </div>
          </motion.div>

          {/* Inline expense form */}
          {showForm && (
            <motion.div variants={itemVariants}>
              <Card className="bg-card/50 backdrop-blur border-border/50 p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">New Expense</h3>
                <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Category *</label>
                    <Select value={watch('category') || undefined} onValueChange={(v) => setValue('category', v, { shouldValidate: true })}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.category && <p className="text-xs text-red-400 mt-1">{errors.category.message}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Description *</label>
                    <Input {...register('description')} placeholder="Expense description" />
                    {errors.description && <p className="text-xs text-red-400 mt-1">{errors.description.message}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Amount *</label>
                    <Input {...register('amount')} type="number" step="0.01" placeholder="0.00" />
                    {errors.amount && <p className="text-xs text-red-400 mt-1">{errors.amount.message}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Date</label>
                    <Input {...register('expenseDate')} type="date" />
                    {errors.expenseDate && <p className="text-xs text-red-400 mt-1">{errors.expenseDate.message}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Agent Discord ID</label>
                    <Input {...register('agentDiscordId')} placeholder="Optional" />
                    {errors.agentDiscordId && <p className="text-xs text-red-400 mt-1">{errors.agentDiscordId.message}</p>}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Receipt URL</label>
                    <Input {...register('receiptUrl')} placeholder="https://..." />
                    {errors.receiptUrl && <p className="text-xs text-red-400 mt-1">{errors.receiptUrl.message}</p>}
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3 flex justify-end">
                    <Button type="submit" size="sm" disabled={isSubmitting || createExpense.isPending}>
                      {createExpense.isPending ? 'Saving...' : 'Save Expense'}
                    </Button>
                  </div>
                </form>
              </Card>
            </motion.div>
          )}

          {/* Empty state */}
          {total === 0 && !hasActiveFilters && !showForm ? (
            <motion.div variants={itemVariants}>
              <EmptyState
                icon={IconCash}
                title="No expenses recorded"
                description="Start tracking your business expenses by adding the first one."
                action={{ label: 'Add Expense', onClick: () => setShowForm(true) }}
              />
            </motion.div>
          ) : (
            <>
              {/* Expenses table */}
              <motion.div variants={itemVariants}>
                <Card className="bg-card/50 backdrop-blur border-border/50 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-card/50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agent</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((expense) => (
                        <tr key={expense.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {new Date(expense.expenseDate).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground capitalize">{expense.category}</td>
                          <td className="px-4 py-3 text-foreground">{expense.description}</td>
                          <td className="px-4 py-3 text-right text-foreground font-medium font-mono">
                            ${expense.amount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {expense.agentDiscordId ? expense.agentDiscordId.slice(0, 8) : '\u2014'}
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(expense.id)}
                              className="text-muted-foreground hover:text-red-400 transition-colors h-auto p-1"
                            >
                              <IconTrash size={14} />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {expenses.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                            <IconCash size={32} className="mx-auto mb-2 opacity-30" />
                            No expenses found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Card>
              </motion.div>

              {/* Pagination */}
              {pageCount > 1 && (
                <motion.div variants={itemVariants} className="flex items-center justify-center gap-3">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    <IconChevronLeft size={14} />
                  </Button>
                  <span className="text-sm text-muted-foreground">Page {page} of {pageCount}</span>
                  <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
                    <IconChevronRight size={14} />
                  </Button>
                </motion.div>
              )}
            </>
          )}
        </>
      )}

      {/* P&L SUMMARY TAB */}
      {activeTab === 'pnl' && (
        <>
          {/* Metric cards with sparklines */}
          {summary ? (
            <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricCard
                label="Total Revenue"
                value={`$${summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={<IconCash size={22} />}
                color="#3b82f6"
                trend={revenueTrend}
                sparklineData={summary.byMonth?.map((m: FinanceSummary['byMonth'][number]) => m.revenue) ?? []}
              />
              <MetricCard
                label="Total Expenses"
                value={`$${summary.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={<IconCash size={22} />}
                color="#f59e0b"
                trend={expensesTrend}
                sparklineData={summary.byMonth?.map((m: FinanceSummary['byMonth'][number]) => m.expenses) ?? []}
              />
              <MetricCard
                label="Net Profit"
                value={`$${summary.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                icon={<IconCash size={22} />}
                color={summary.netProfit >= 0 ? '#22c55e' : '#ef4444'}
                trend={netTrend}
                sparklineData={summary.byMonth?.map((m: FinanceSummary['byMonth'][number]) => m.net) ?? []}
              />
            </motion.div>
          ) : null}

          {/* Monthly Trend Chart */}
          {summary && summary.byMonth.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card className="bg-card/50 backdrop-blur border-border/50 p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Monthly Trend</h3>
                <ChartContainer config={monthlyChartConfig} className="h-64 w-full">
                  <AreaChart data={summary.byMonth} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="fillExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={dollarFormatter} tick={{ fontSize: 11 }} width={70} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--color-revenue)"
                      strokeWidth={2}
                      fill="url(#fillRevenue)"
                    />
                    <Area
                      type="monotone"
                      dataKey="expenses"
                      stroke="var(--color-expenses)"
                      strokeWidth={2}
                      fill="url(#fillExpenses)"
                    />
                  </AreaChart>
                </ChartContainer>
              </Card>
            </motion.div>
          )}

          {/* Monthly breakdown table */}
          {summary && summary.byMonth.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card className="bg-card/50 backdrop-blur border-border/50 overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">Monthly Breakdown</h3>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-card/50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Month</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Revenue</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expenses</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byMonth.map((row) => (
                      <tr key={row.month} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-foreground">{row.month}</td>
                        <td className="px-4 py-3 text-right text-foreground font-mono">${row.revenue.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground font-mono">${row.expenses.toFixed(2)}</td>
                        <td className={`px-4 py-3 text-right font-medium font-mono ${row.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ${row.net.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </motion.div>
          )}

          {/* Lead ROI Donut Chart + Table */}
          {roiLoading ? (
            <motion.div variants={itemVariants} className="h-48 bg-muted/30 rounded-xl animate-pulse" />
          ) : leadROI && leadROI.length > 0 ? (
            <>
              {/* Donut Chart */}
              <motion.div variants={itemVariants}>
                <Card className="bg-card/50 backdrop-blur border-border/50 p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Lead Cost Distribution</h3>
                  <ChartContainer config={roiChartConfig} className="h-52 w-full">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                      <Pie
                        data={roiChartData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                      >
                        {roiChartData.map((entry, index) => (
                          <Cell
                            key={entry.name}
                            fill={ROI_COLORS[index % ROI_COLORS.length]}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                </Card>
              </motion.div>

              {/* Lead ROI table */}
              <motion.div variants={itemVariants}>
                <Card className="bg-card/50 backdrop-blur border-border/50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-border">
                    <h3 className="text-sm font-semibold text-foreground">Lead ROI by Source</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-card/50">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Source</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cost</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recruits</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Converted</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cost/Recruit</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cost/Conversion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadROI.map((row) => (
                        <tr key={row.source} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-foreground capitalize">{row.source}</td>
                          <td className="px-4 py-3 text-right text-foreground font-mono">${row.cost.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground font-mono">{row.recruitCount}</td>
                          <td className="px-4 py-3 text-right text-muted-foreground font-mono">{row.convertedCount}</td>
                          <td className="px-4 py-3 text-right text-foreground font-mono">${row.costPerRecruit.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-foreground font-mono">
                            {row.costPerConversion === 0 ? '\u2014' : `$${row.costPerConversion.toFixed(2)}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </motion.div>
            </>
          ) : !roiLoading ? (
            <motion.div variants={itemVariants}>
              <EmptyState
                icon={IconCash}
                title="No lead ROI data"
                description="ROI data will appear once expenses are categorized against lead sources."
              />
            </motion.div>
          ) : null}
        </>
      )}
    </motion.div>
  )
}
