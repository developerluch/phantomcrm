import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useExpenses, useCreateExpense, useDeleteExpense } from '../../hooks/useExpenses'
import { EXPENSE_CATEGORIES } from '../../types/portal'
import { createExpenseSchema, type CreateExpenseFormData } from '../../lib/schemas'
import { IconCash, IconPlus, IconX, IconTrash, IconFilterOff, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import EmptyState from '../EmptyState'

export function ExpensesTab() {
  const [page, setPage] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showForm, setShowForm] = useState(false)

  const { data, isLoading } = useExpenses({
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

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<CreateExpenseFormData>({
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
    })
  }

  const hasActiveFilters = !!(categoryFilter || dateFrom || dateTo)

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 pr-1 pb-6">
      {/* Filters & Actions */}
      <div className="flex flex-shrink-0 items-center gap-3 flex-wrap">
        <Select value={categoryFilter || "_all"} onValueChange={(v) => { setCategoryFilter(v === "_all" ? "" : v); setPage(1) }}>
          <SelectTrigger className="w-40 bg-card/50">
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
          className="w-40 bg-card/50"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
          className="w-40 bg-card/50"
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setCategoryFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }}>
            <IconFilterOff size={14} className="mr-1.5" />
            Reset
          </Button>
        )}
        <div className="ml-auto">
          <Button size="sm" onClick={() => setShowForm(!showForm)} className={showForm ? 'bg-muted/50 hover:bg-muted text-foreground' : 'bg-[#7DD3FC]/10 text-[#7DD3FC] hover:bg-[#7DD3FC]/20'}>
            {showForm ? <><IconX size={16} className="mr-1.5" /> Cancel</> : <><IconPlus size={16} className="mr-1.5" /> Add Expense</>}
          </Button>
        </div>
      </div>

      {/* Inline Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div className="flex-shrink-0" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
            <Card className="bg-card/50 backdrop-blur border-primary/20 p-4 relative overflow-hidden mb-4 shadow-[0_0_20px_rgba(125, 211, 252, 0.05)]">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
              <h3 className="text-sm font-semibold text-foreground mb-3">Record Expense</h3>
              <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Category *</label>
                  <Select value={watch('category') || undefined} onValueChange={(v) => setValue('category', v as any, { shouldValidate: true })}>
                    <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Select category" /></SelectTrigger>
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
                  <Input {...register('description')} placeholder="Facebook Ads, CRM, etc" className="bg-background" />
                  {errors.description && <p className="text-xs text-red-400 mt-1">{errors.description.message}</p>}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Amount ($) *</label>
                  <Input {...register('amount')} type="number" step="0.01" placeholder="0.00" className="bg-background font-mono" />
                  {errors.amount && <p className="text-xs text-red-400 mt-1">{errors.amount.message}</p>}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Date</label>
                  <Input {...register('expenseDate')} type="date" className="bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Agent Discord ID (Optional)</label>
                  <Input {...register('agentDiscordId')} placeholder="ID" className="bg-background" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Receipt Link (Optional)</label>
                  <Input {...register('receiptUrl')} placeholder="https://..." className="bg-background" />
                </div>
                <div className="sm:col-span-2 lg:col-span-3 flex justify-end mt-2">
                  <Button type="submit" size="sm" disabled={isSubmitting || createExpense.isPending}>
                    {createExpense.isPending ? 'Saving...' : 'Save Expense'}
                  </Button>
                </div>
              </form>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      {isLoading ? (
        <div className="h-[400px] flex-shrink-0 bg-muted/30 rounded-xl animate-pulse" />
      ) : total === 0 && !hasActiveFilters && !showForm ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <EmptyState
            icon={IconCash}
            title="No expenses recorded"
            description="Track your business spend by adding the first receipt."
            action={{ label: 'Add Expense', onClick: () => setShowForm(true) }}
          />
        </div>
      ) : (
        <Card className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card/50 backdrop-blur border-border/50">
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
                <TableRow>
                  <TableHead className="text-xs uppercase">Date</TableHead>
                  <TableHead className="text-xs uppercase">Category</TableHead>
                  <TableHead className="text-xs uppercase">Description</TableHead>
                  <TableHead className="text-right text-xs uppercase">Amount</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id} className="border-border/50 hover:bg-muted/30">
                    <TableCell className="text-muted-foreground text-xs">{new Date(expense.expenseDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-muted-foreground capitalize">{expense.category}</TableCell>
                    <TableCell className="text-foreground">{expense.description}</TableCell>
                    <TableCell className="text-right text-foreground font-medium font-mono">${expense.amount.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(expense.id)} className="text-muted-foreground hover:text-red-400 h-auto p-1">
                        <IconTrash size={14} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {pageCount > 1 && (
            <div className="flex flex-shrink-0 items-center justify-center p-3 gap-3 border-t border-border/50 bg-card/30">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><IconChevronLeft size={14} /></Button>
              <span className="text-xs text-muted-foreground">Page {page} of {pageCount}</span>
              <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage(p => p + 1)}><IconChevronRight size={14} /></Button>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
