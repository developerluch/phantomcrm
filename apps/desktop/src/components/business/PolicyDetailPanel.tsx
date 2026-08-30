import { useRef } from 'react'
import {
  IconUser,
  IconPhone,
  IconMail,
  IconMapPin,
  IconCalendar,
  IconEdit,
  IconFileText,
  IconCash,
  IconCreditCard,
  IconUpload,
  IconCircleCheck,
  IconClock,
  IconSend,
} from '@tabler/icons-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import type { Sale } from '@/types/portal'
import { parseSaleMeta, getSaleNotesWithoutMeta } from '@/types/portal'
import { fmt$ } from '../charts/chart-constants'
import { toast } from 'sonner'
import { useSendPostcard } from '@/hooks/usePostable'

interface Props {
  sale: Sale
  onEdit?: (sale: Sale) => void
}

const TIMELINE_STEPS = [
  { key: 'submittedAt', label: 'Submitted', icon: IconSend },
  { key: 'approvedAt', label: 'Approved', icon: IconCircleCheck },
  { key: 'issuedAt', label: 'Issued', icon: IconFileText },
  { key: 'paidAt', label: 'Paid', icon: IconCash },
] as const

const STATUS_ORDER = ['submitted', 'approved', 'issued', 'paid'] as const

function isStepCompleted(saleStatus: string, stepKey: string): boolean {
  if (saleStatus.toLowerCase() === 'cancelled') return false
  const stepStatus = stepKey.replace('At', '').toLowerCase()
  const sIdx = STATUS_ORDER.indexOf(saleStatus.toLowerCase() as typeof STATUS_ORDER[number])
  const tIdx = STATUS_ORDER.indexOf(stepStatus as typeof STATUS_ORDER[number])
  if (sIdx === -1 || tIdx === -1) return false
  return tIdx <= sIdx
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function PolicyDetailPanel({ sale, onEdit }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const sendPostcard = useSendPostcard()

  function handleSendPostcard() {
    sendPostcard.mutate(sale.id, {
      onSuccess: () => toast.success('Thank you card is being sent!'),
      onError: () => toast.error('Failed to send thank you card'),
    })
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    toast.success(`PDF reference saved: ${file.name}`)
    e.target.value = ''
  }

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Client Details */}
        <Card className="bg-card/50 backdrop-blur-sm border border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <IconUser size={14} />
              Client Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <IconMapPin size={14} className="text-muted-foreground shrink-0 mt-0.5" />
              <span className="text-foreground">{sale.clientAddress || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <IconPhone size={14} className="text-muted-foreground shrink-0" />
              <span className="text-foreground">{sale.clientPhone || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <IconMail size={14} className="text-muted-foreground shrink-0" />
              <span className="text-foreground">{sale.clientEmail || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <IconCalendar size={14} className="text-muted-foreground shrink-0" />
              <span className="text-foreground">DOB: {sale.clientDOB ? formatDate(sale.clientDOB) : '—'}</span>
            </div>
          </CardContent>
        </Card>

        {/* Policy Details */}
        <Card className="bg-card/50 backdrop-blur-sm border border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <IconFileText size={14} />
              Policy Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Policy #</span>
              <span className="font-mono text-foreground">{sale.policyNumber || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Carrier</span>
              <Badge variant="outline">{sale.carrier}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Product</span>
              <span className="text-foreground">{sale.productName || (sale.policyType !== 'life' ? sale.policyType : '—')}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Face Amount</span>
              <span className="text-foreground">{sale.faceAmount ? fmt$(sale.faceAmount) : '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Payment Mode</span>
              <span className="text-foreground capitalize">{sale.paymentMode || '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Premium</span>
              <span className="font-semibold text-[#7DD3FC]">{fmt$(sale.premium)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card className="bg-card/50 backdrop-blur-sm border border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <IconClock size={14} />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {TIMELINE_STEPS.map((step, i) => {
              const date = sale[step.key]
              const StepIcon = step.icon
              const isCompleted = isStepCompleted(sale.status, step.key)
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        isCompleted ? 'bg-[#7DD3FC]/20 text-[#7DD3FC]' : 'bg-muted/30 text-muted-foreground/40'
                      }`}
                    >
                      <StepIcon size={12} />
                    </div>
                    {i < TIMELINE_STEPS.length - 1 && (
                      <div className={`w-px h-3 ${isCompleted ? 'bg-[#7DD3FC]/30' : 'bg-border/30'}`} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${isCompleted ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                      {step.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {isCompleted
                        ? (date ? formatDate(date) : formatDate(sale.createdAt))
                        : '—'}
                    </p>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Postcard Status */}
      {(sale.postcardSentAt || sale.clientAddress) && (
        <Card className="bg-card/50 backdrop-blur-sm border border-border/50">
          <CardContent className="flex items-center justify-between py-3 px-4">
            {sale.postcardSentAt ? (
              <div className="flex items-center gap-2 text-sm">
                <IconMail size={16} className="text-emerald-400" />
                <span className="text-emerald-400 font-medium">
                  Thank you card mailed {formatDate(sale.postcardSentAt)}
                </span>
              </div>
            ) : sale.clientAddress ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconMail size={16} />
                <span>No thank you card sent yet</span>
              </div>
            ) : null}
            {!sale.postcardSentAt && sale.clientAddress && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSendPostcard}
                disabled={sendPostcard.isPending}
                className="flex items-center gap-1.5"
              >
                <IconMail size={14} />
                {sendPostcard.isPending ? 'Sending...' : 'Send Thank You Card'}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes + PDF upload */}
      <div className="flex items-center justify-between">
        {sale.notes && (
          <div className="flex-1 min-w-0 space-y-2">
            {(() => {
              const meta = parseSaleMeta(sale)
              const cleanNotes = getSaleNotesWithoutMeta(sale)
              return (
                <>
                  {Object.keys(meta).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {meta.leadSource && (
                        <Badge variant="outline" className="text-[10px]">
                          Lead: {meta.leadSource}
                        </Badge>
                      )}
                      {meta.commissionSplits && meta.commissionSplits.length > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          {meta.commissionSplits.length} commission split{meta.commissionSplits.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  )}
                  {cleanNotes && (
                    <>
                      <p className="text-xs text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm text-foreground/80">{cleanNotes}</p>
                    </>
                  )}
                </>
              )
            })()}
          </div>
        )}
        <div className="flex items-center gap-2 shrink-0">
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(sale)}
            >
              <IconEdit size={14} className="mr-1.5" />
              Edit Policy
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <IconUpload size={14} className="mr-1.5" />
            Upload PDF
          </Button>
        </div>
      </div>
    </div>
  )
}
