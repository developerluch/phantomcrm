import { useState } from 'react'
import { toast } from 'sonner'
import { IconAlertTriangle, IconPlus, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import MetricCard from '../MetricCard'
import { useChargebacks, useCreateChargeback, useUpdateChargeback, useDeleteChargeback, useChargebackSummary } from '../../hooks/useChargebacks'
import { CHARGEBACK_REASONS, CHARGEBACK_STATUSES } from '../../types/portal'

interface Props {
  agentId?: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  recovery_in_progress: '#3b82f6',
  recovered: '#22c55e',
  written_off: '#ef4444',
}

export default function ChargebackPanel({ agentId }: Props) {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  // Form state
  const [formSaleId, setFormSaleId] = useState('')
  const [formAmount, setFormAmount] = useState('')
  const [formReason, setFormReason] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const { data, isLoading } = useChargebacks({
    agentId,
    status: statusFilter || undefined,
    page,
  })
  const { data: summary } = useChargebackSummary({ agentId })
  const createChargeback = useCreateChargeback()
  const updateChargeback = useUpdateChargeback()
  const deleteChargeback = useDeleteChargeback()

  const chargebacks = data?.chargebacks ?? []

  const handleCreate = () => {
    if (!formSaleId || !formAmount || !formReason) {
      toast.error('Sale ID, amount, and reason are required')
      return
    }
    createChargeback.mutate(
      {
        saleId: formSaleId,
        chargebackAmount: parseFloat(formAmount),
        reason: formReason,
        chargebackDate: formDate || undefined,
        recoveryNotes: formNotes || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Chargeback logged')
          setShowCreate(false)
          setFormSaleId('')
          setFormAmount('')
          setFormReason('')
          setFormDate('')
          setFormNotes('')
        },
        onError: () => toast.error('Failed to create chargeback'),
      }
    )
  }

  const handleStatusChange = (id: string, status: string) => {
    updateChargeback.mutate(
      { id, data: { status } },
      {
        onSuccess: () => toast.success('Status updated'),
        onError: () => toast.error('Failed to update'),
      }
    )
  }

  const handleDelete = (id: string) => {
    deleteChargeback.mutate(id, {
      onSuccess: () => toast.success('Chargeback deleted'),
      onError: () => toast.error('Failed to delete'),
    })
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Total Chargebacks"
            value={`$${summary.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<IconAlertTriangle size={22} />}
            color="#ef4444"
          />
          <MetricCard
            label="Recovery Rate"
            value={`${(summary.recoveryRate * 100).toFixed(1)}%`}
            icon={<IconAlertTriangle size={22} />}
            color="#22c55e"
          />
          <MetricCard
            label="Outstanding"
            value={`$${summary.outstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<IconAlertTriangle size={22} />}
            color="#f59e0b"
          />
          <MetricCard
            label="Written Off"
            value={`$${summary.writtenOffAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            icon={<IconAlertTriangle size={22} />}
            color="#6b7280"
          />
        </div>
      )}

      {/* Actions bar */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter || '_all'} onValueChange={(v) => { setStatusFilter(v === '_all' ? '' : v); setPage(1) }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All statuses</SelectItem>
            {CHARGEBACK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <IconPlus size={16} className="mr-1.5" />
            Log Chargeback
          </Button>
        </div>
      </div>

      {/* Chargebacks table */}
      {isLoading ? (
        <div className="h-48 bg-muted/30 rounded-xl animate-pulse" />
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-card/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Client</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Agent</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Original AP</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Chargeback</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recovered</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reason</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {chargebacks.map((cb) => (
                <tr key={cb.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(cb.chargebackDate).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-foreground">{cb.clientName}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {cb.agent ? `${cb.agent.firstName} ${cb.agent.lastName}` : cb.agentId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-right text-foreground tabular-nums">${cb.originalAP.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-red-400 font-medium tabular-nums">
                    ${cb.chargebackAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right text-green-400 tabular-nums">
                    ${cb.recoveredAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px] capitalize">{cb.reason.replace(/_/g, ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Select value={cb.status} onValueChange={(v) => handleStatusChange(cb.id, v)}>
                      <SelectTrigger
                        className="text-[11px] font-semibold px-2 py-0.5 h-auto rounded-full border-none cursor-pointer w-auto gap-1"
                        style={{
                          background: `${STATUS_COLORS[cb.status] ?? '#6b7280'}20`,
                          color: STATUS_COLORS[cb.status] ?? '#6b7280',
                        }}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHARGEBACK_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <Button variant="ghost" size="sm" className="h-auto p-1 text-muted-foreground hover:text-red-400" onClick={() => handleDelete(cb.id)}>
                      <IconTrash size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
              {chargebacks.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    <IconAlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
                    No chargebacks found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create chargeback dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Chargeback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Sale ID *</Label>
              <Input value={formSaleId} onChange={(e) => setFormSaleId(e.target.value)} placeholder="Paste the sale ID" />
            </div>
            <div>
              <Label className="text-xs">Chargeback Amount *</Label>
              <Input type="number" step="0.01" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label className="text-xs">Reason *</Label>
              <Select value={formReason} onValueChange={setFormReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {CHARGEBACK_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{r.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Recovery Notes</Label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Optional notes..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createChargeback.isPending}>
              {createChargeback.isPending ? 'Saving...' : 'Log Chargeback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
