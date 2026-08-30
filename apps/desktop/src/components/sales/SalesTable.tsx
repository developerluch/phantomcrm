import { useState, useMemo, Fragment } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconDots,
  IconEdit,
  IconFileText,
  IconCalendar,
  IconReceipt,
} from '@tabler/icons-react'
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
import PolicyDetailPanel from '@/components/business/PolicyDetailPanel'
import EditSaleModal from './EditSaleModal'
import { SALE_STATUSES, SALE_STATUS_COLORS } from '../../types/portal'
import type { Sale } from '../../types/portal'
import { fmt$ } from '../charts/chart-constants'
import { getAnnualizedPremium, getMonthlyPremium } from '@/lib/premium'
import { cn } from '@/lib/utils'

interface Props {
  sales: Sale[]
  total: number
  page: number
  onPageChange: (page: number) => void
  onStatusChange: (id: string, status: string) => void
}

const COL_SPAN = 10

function statusVariant(status: string): 'success' | 'warning' | 'destructive' | 'outline' {
  const s = status.toLowerCase()
  if (['issued', 'paid', 'placed', 'active'].includes(s)) return 'success'
  if (['submitted', 'approved', 'applied', 'pending'].includes(s)) return 'warning'
  if (['cancelled', 'declined'].includes(s)) return 'destructive'
  return 'outline'
}

const PAGE_SIZE = 25

export default function SalesTable({ sales, total, page, onPageChange, onStatusChange }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    []
  )

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const startIdx = (page - 1) * PAGE_SIZE

  // Group sales by month
  const groupedSales = useMemo(() => {
    const groups = new Map<string, Sale[]>()
    for (const sale of sales) {
      const d = new Date(sale.submittedAt)
      const key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(sale)
    }
    return Array.from(groups.entries()).map(([label, items]) => ({ label, items }))
  }, [sales])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Table */}
      <div className="flex-1 rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto min-h-0 will-change-transform">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Carrier</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Monthly</TableHead>
                <TableHead className="text-right">Annualized Premium</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COL_SPAN} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <IconReceipt size={32} className="text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground">No policies found</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                groupedSales.map((group) => (
                  <Fragment key={group.label}>
                    {/* Month header */}
                    <TableRow className="bg-muted/10 hover:bg-muted/10">
                      <TableCell colSpan={COL_SPAN} className="py-2 px-4">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                          <IconCalendar size={14} />
                          {group.label}
                          <Badge variant="outline" className="ml-1 text-[10px] font-normal">
                            {group.items.length}
                          </Badge>
                        </span>
                      </TableCell>
                    </TableRow>

                    {/* Sale rows */}
                    {group.items.map((sale) => {
                      const isExpanded = expandedId === sale.id
                      return (
                        <Fragment key={sale.id}>
                          <TableRow
                            className={cn(
                              "cursor-pointer transition-colors",
                              isExpanded ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                            )}
                            onClick={() => setExpandedId(isExpanded ? null : sale.id)}
                          >
                            <TableCell className="w-8">
                              <motion.div
                                animate={{ rotate: isExpanded ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <IconChevronDown size={14} className="text-muted-foreground" />
                              </motion.div>
                            </TableCell>
                            <TableCell className="font-medium">{sale.clientName}</TableCell>
                            <TableCell className="text-muted-foreground text-xs tabular-nums whitespace-nowrap">
                              {dateFormatter.format(new Date(sale.createdAt || sale.submittedAt))}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {sale.agentFirstName ? `${sale.agentFirstName} ${sale.agentLastName || ''}`.trim() : '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">{sale.carrier}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {sale.productName || (sale.policyType !== 'life' ? sale.policyType.replace('_', ' ') : '—')}
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {fmt$(getMonthlyPremium(sale))}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground text-xs tabular-nums">
                              {fmt$(getAnnualizedPremium(sale))}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Select value={sale.status} onValueChange={(v) => onStatusChange(sale.id, v)}>
                                <SelectTrigger
                                  className="text-[11px] font-semibold px-2.5 py-0.5 h-auto rounded-full border-none cursor-pointer w-auto gap-1"
                                  style={{
                                    background: `${SALE_STATUS_COLORS[sale.status] ?? '#6b7280'}20`,
                                    color: SALE_STATUS_COLORS[sale.status] ?? '#6b7280',
                                  }}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {SALE_STATUSES.map((s) => (
                                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
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
                                  <DropdownMenuItem onClick={() => setEditingSale(sale)}>
                                    <IconEdit size={14} className="mr-2" />
                                    Edit Policy
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>

                          <AnimatePresence mode="sync">
                            {isExpanded && (
                              <TableRow key={`${sale.id}-detail`}>
                                <TableCell colSpan={COL_SPAN} className="p-0 border-b border-border/30 overflow-hidden">
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                                  >
                                    <PolicyDetailPanel sale={sale} onEdit={(s) => setEditingSale(s)} />
                                  </motion.div>
                                </TableCell>
                              </TableRow>
                            )}
                          </AnimatePresence>
                        </Fragment>
                      )
                    })}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between py-3 flex-shrink-0">
          <span className="text-sm text-muted-foreground">
            Showing {startIdx + 1}-{Math.min(startIdx + PAGE_SIZE, total)} of {total} policies
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <IconChevronLeft size={14} />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              <IconChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}

      <EditSaleModal
        sale={editingSale}
        open={editingSale !== null}
        onClose={() => setEditingSale(null)}
      />
    </div>
  )
}
