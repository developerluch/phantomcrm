import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useUpdateSale } from '../../hooks/useSales'
import { toast } from 'sonner'
import { IconEdit, IconLoader2 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SALE_STATUSES } from '../../types/portal'
import type { Sale, UpdateSaleRequest } from '../../types/portal'
import { getSaleNotesWithoutMeta, parseSaleMeta, serializeSaleMeta } from '../../types/portal'

const editSaleSchema = z.object({
  clientName: z.string().min(1, 'Client name is required'),
  clientDOB: z.string().optional(),
  clientAddress: z.string().optional(),
  clientPhone: z.string().optional(),
  clientEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  policyType: z.string().min(1, 'Policy type is required'),
  carrier: z.string().min(1, 'Carrier is required'),
  productName: z.string().optional(),
  policyNumber: z.string().optional(),
  premium: z.coerce.number().positive('Premium must be positive'),
  commission: z.coerce.number().min(0).optional(),
  faceAmount: z.coerce.number().min(0).optional(),
  paymentMode: z.string().optional(),
  status: z.string().min(1),
  notes: z.string().optional(),
})

type EditSaleFormData = z.infer<typeof editSaleSchema>

interface Props {
  sale: Sale | null
  open: boolean
  onClose: () => void
}

export default function EditSaleModal({ sale, open, onClose }: Props) {
  const updateSale = useUpdateSale()

  const form = useForm<EditSaleFormData>({
    resolver: zodResolver(editSaleSchema),
    mode: 'onChange',
  })

  useEffect(() => {
    if (sale && open) {
      const cleanNotes = getSaleNotesWithoutMeta(sale)
      form.reset({
        clientName: sale.clientName,
        clientDOB: sale.clientDOB || '',
        clientAddress: sale.clientAddress || '',
        clientPhone: sale.clientPhone || '',
        clientEmail: sale.clientEmail || '',
        policyType: sale.policyType,
        carrier: sale.carrier,
        productName: sale.productName || '',
        policyNumber: sale.policyNumber || '',
        premium: sale.premium,
        commission: sale.commission ?? 0,
        faceAmount: sale.faceAmount ?? 0,
        paymentMode: sale.paymentMode || '',
        status: sale.status,
        notes: cleanNotes,
      })
    }
  }, [sale, open, form])

  const onValid = (data: EditSaleFormData) => {
    if (!sale) return

    // Preserve existing metadata from notes
    const existingMeta = parseSaleMeta(sale)
    const rawNotes = data.notes?.trim() || undefined
    const notes =
      Object.keys(existingMeta).length > 0
        ? serializeSaleMeta(existingMeta, rawNotes)
        : rawNotes

    const payload: UpdateSaleRequest = {
      clientName: data.clientName.trim(),
      policyType: data.policyType,
      carrier: data.carrier.trim(),
      premium: data.premium,
      commission: data.commission || undefined,
      status: data.status,
      policyNumber: data.policyNumber?.trim() || undefined,
      notes,
      clientDOB: data.clientDOB || undefined,
      clientAddress: data.clientAddress?.trim() || undefined,
      clientPhone: data.clientPhone?.trim() || undefined,
      clientEmail: data.clientEmail?.trim() || undefined,
      faceAmount: data.faceAmount || undefined,
      paymentMode: data.paymentMode || undefined,
      productName: data.productName?.trim() || undefined,
    }

    updateSale.mutate(
      { id: sale.id, data: payload },
      {
        onSuccess: () => {
          toast.success('Policy updated')
          onClose()
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to update policy'),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <IconEdit size={20} className="text-blue-400" />
            </div>
            <div>
              <DialogTitle>Edit Policy</DialogTitle>
              <DialogDescription>
                Update policy details for {sale?.clientName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onValid)} className="space-y-6 pt-2">
          {/* Client Information */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Client Information
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Client Name *</Label>
                <Input {...form.register('clientName')} />
                {form.formState.errors.clientName && (
                  <p className="text-xs text-red-400">{form.formState.errors.clientName.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date of Birth</Label>
                <Input {...form.register('clientDOB')} type="date" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Address</Label>
                <Input {...form.register('clientAddress')} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Phone</Label>
                <Input {...form.register('clientPhone')} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input {...form.register('clientEmail')} />
                {form.formState.errors.clientEmail && (
                  <p className="text-xs text-red-400">{form.formState.errors.clientEmail.message}</p>
                )}
              </div>
            </div>
          </div>

          {/* Policy Details */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Policy Details
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Carrier *</Label>
                <Input {...form.register('carrier')} />
                {form.formState.errors.carrier && (
                  <p className="text-xs text-red-400">{form.formState.errors.carrier.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Product Name</Label>
                <Input {...form.register('productName')} placeholder="e.g., Children's Whole Life" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Policy Number</Label>
                <Input {...form.register('policyNumber')} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Policy Type *</Label>
                <Input {...form.register('policyType')} />
                {form.formState.errors.policyType && (
                  <p className="text-xs text-red-400">{form.formState.errors.policyType.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select
                  value={form.watch('status')}
                  onValueChange={(v) => form.setValue('status', v)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SALE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Financial */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Financial
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Premium *</Label>
                <Input {...form.register('premium')} type="number" step="0.01" />
                {form.formState.errors.premium && (
                  <p className="text-xs text-red-400">{form.formState.errors.premium.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Commission</Label>
                <Input {...form.register('commission')} type="number" step="0.01" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Face Amount</Label>
                <Input {...form.register('faceAmount')} type="number" step="0.01" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Mode</Label>
                <Select
                  value={form.watch('paymentMode') || ''}
                  onValueChange={(v) => form.setValue('paymentMode', v)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="semi-annual">Semi-Annual</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Notes
            </h3>
            <Textarea {...form.register('notes')} rows={3} />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-4 border-t border-border/60">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={updateSale.isPending}>
              {updateSale.isPending ? (
                <span className="flex items-center gap-2">
                  <IconLoader2 size={14} className="animate-spin" />
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
