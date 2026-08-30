import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  IconSearch,
  IconChevronLeft,
  IconChevronRight,
  IconChevronDown,
  IconChevronUp,
  IconPlus,
  IconDots,
  IconFileText,
  IconTrash,
  IconEdit,
  IconUpload,
} from '@tabler/icons-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import CreateSaleModal from '@/components/sales/CreateSaleModal'
import PolicyDetailPanel from './PolicyDetailPanel'
import type { Sale } from '@/types/portal'
import { fmt$ } from '../charts/chart-constants'
import { containerVariants, itemVariants } from '@/lib/motion'

interface Props {
  sales: Sale[]
  total: number
  page: number
  onPageChange: (n: number) => void
  isLoading: boolean
}

const PAGE_SIZE = 25

const STATUS_OPTIONS = ['submitted', 'approved', 'issued', 'paid', 'cancelled', 'declined'] as const

function statusVariant(status: string): 'success' | 'warning' | 'destructive' | 'outline' {
  const s = status.toLowerCase()
  if (['issued', 'paid', 'placed', 'active'].includes(s)) return 'success'
  if (['submitted', 'approved', 'applied', 'pending'].includes(s)) return 'warning'
  if (['cancelled', 'declined'].includes(s)) return 'destructive'
  return 'outline'
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
}

export default function SubmittedBusinessTab({ sales, total, page, onPageChange, isLoading }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('_all')
  const [carrierFilter, setCarrierFilter] = useState('_all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const carriers = useMemo(() => {
    const set = new Set(sales.map((s) => s.carrier).filter(Boolean))
    return Array.from(set).sort()
  }, [sales])

  const filtered = useMemo(() => {
    let result = sales
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(
        (s) =>
          s.clientName.toLowerCase().includes(q) ||
          (s.policyNumber?.toLowerCase().includes(q)) ||
          (s.carrier?.toLowerCase().includes(q)) ||
          (`${s.agent?.firstName ?? ''} ${s.agent?.lastName ?? ''}`.toLowerCase().includes(q)),
      )
    }
    if (statusFilter !== '_all') {
      result = result.filter((s) => s.status.toLowerCase() === statusFilter)
    }
    if (carrierFilter !== '_all') {
      result = result.filter((s) => s.carrier === carrierFilter)
    }
    return result
  }, [sales, search, statusFilter, carrierFilter])

  const totalFiltered = filtered.length
  const pageCount = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const startIdx = (currentPage - 1) * PAGE_SIZE
  const pageData = filtered.slice(startIdx, startIdx + PAGE_SIZE)

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* Filter Bar */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search client, policy #, agent..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); onPageChange(1) }}
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); onPageChange(1) }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={carrierFilter} onValueChange={(v) => { setCarrierFilter(v); onPageChange(1) }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Carrier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All Carriers</SelectItem>
            {carriers.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="gradient" onClick={() => setShowCreateModal(true)}>
          <IconPlus size={14} className="mr-1.5" />
          Add Policy
        </Button>
      </motion.div>

      {/* Data Table */}
      <motion.div variants={itemVariants}>
        <div className="rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Policy #</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Insured</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">AP</TableHead>
                <TableHead className="text-right">Monthly</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={11}>
                      <div className="h-8 rounded bg-muted/20 animate-pulse" />
                    </TableCell>
                  </TableRow>
                ))
              ) : pageData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <IconFileText size={32} className="text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">No policies found</p>
                      <Button variant="gradient" size="sm" onClick={() => setShowCreateModal(true)}>
                        <IconPlus size={14} className="mr-1.5" />
                        Add your first policy
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pageData.map((sale) => {
                  const isExpanded = expandedId === sale.id
                  return (
                    <AnimatePresence key={sale.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : sale.id)}
                      >
                        <TableCell className="w-8">
                          {isExpanded ? (
                            <IconChevronUp size={14} className="text-muted-foreground" />
                          ) : (
                            <IconChevronDown size={14} className="text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{sale.policyNumber || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{sale.carrier}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{sale.clientName}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {sale.agent ? `${sale.agent.firstName} ${sale.agent.lastName}` : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{sale.productName || sale.policyType.replace('_', ' ')}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(sale.status)} className="text-[10px] capitalize">
                            {sale.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatDate(sale.issuedAt || sale.submittedAt)}
                        </TableCell>
                        <TableCell className="text-right font-medium">{fmt$(sale.premium)}</TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs">
                          {fmt$(sale.premium / 12)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-7 h-7"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <IconDots size={14} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setExpandedId(isExpanded ? null : sale.id)}>
                                <IconFileText size={14} className="mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <IconUpload size={14} className="mr-2" />
                                Upload PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <IconEdit size={14} className="mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-red-400 focus:text-red-400">
                                <IconTrash size={14} className="mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={11} className="p-0 border-b border-border/30">
                            <PolicyDetailPanel sale={sale} />
                          </TableCell>
                        </TableRow>
                      )}
                    </AnimatePresence>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </motion.div>

      {/* Pagination */}
      {totalFiltered > 0 && (
        <motion.div variants={itemVariants} className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Showing {startIdx + 1}-{Math.min(startIdx + PAGE_SIZE, totalFiltered)} of {totalFiltered} policies
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
            >
              <IconChevronLeft size={14} />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= pageCount}
              onClick={() => onPageChange(currentPage + 1)}
            >
              <IconChevronRight size={14} />
            </Button>
          </div>
        </motion.div>
      )}

      <CreateSaleModal open={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </motion.div>
  )
}
