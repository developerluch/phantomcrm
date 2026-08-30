import { useState, useMemo, useEffect } from 'react'
import { useFieldArray, type UseFormReturn } from 'react-hook-form'
import type { CreateSaleFormData } from '../../lib/schemas'
import type { AuthUser } from '../../store'
import { POLICY_TYPES, FFL_CARRIERS, SALE_STATUSES, type SalesAgentDirectoryEntry } from '../../types/portal'
import { cn } from '@/lib/utils'
import { getAccountAgentId } from '@/lib/agent-id'
import { motion, AnimatePresence } from 'framer-motion'
import { IconSparkles, IconChevronDown, IconChevronRight, IconLoader2, IconPlus, IconTrash, IconCheck, IconPencil } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { AddressAutocomplete } from '@/components/ui/address-autocomplete'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Badge } from '@/components/ui/badge'
import { useLeadPrograms } from '../../hooks/useLeadPrograms'
import { useCompTiers } from '../../hooks/useCompTiers'
import LifeProductSelector from './LifeProductSelector'

// ── Shared types ────────────────────────────────────────

interface WizardStepProps {
  form: UseFormReturn<CreateSaleFormData>
  highlightedFields: Set<string>
}

function FieldWrap({ name, highlighted, children }: { name: string; highlighted: Set<string>; children: React.ReactNode }) {
  return (
    <div className={cn(
      'transition-all duration-700 rounded-lg',
      highlighted.has(name) && 'bg-primary/10 ring-1 ring-primary/30'
    )}>
      {children}
    </div>
  )
}

function RequiredMark() {
  return <span className="ml-1 text-primary" aria-label="required">*</span>
}

// ── Status pill styles ──────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  submitted: 'bg-muted/50 border-border text-muted-foreground',
  approved: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  issued: 'bg-green-500/10 border-green-500/30 text-green-400',
  paid: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  cancelled: 'bg-red-500/10 border-red-500/30 text-red-400',
}

const STATUS_ACTIVE_STYLES: Record<string, string> = {
  submitted: 'bg-muted border-foreground/40 text-foreground',
  approved: 'bg-blue-500/20 border-blue-400 text-blue-300',
  issued: 'bg-green-500/20 border-green-400 text-green-300',
  paid: 'bg-emerald-500/20 border-emerald-400 text-emerald-300',
  cancelled: 'bg-red-500/20 border-red-400 text-red-300',
}

const PAYMENT_MODE_LABELS: Record<string, string> = {
  monthly: '/mo',
  quarterly: '/qtr',
  'semi-annual': '/semi',
  annual: '/yr',
}

// ── Step Indicator ──────────────────────────────────────

const STEP_LABELS = ['Client', 'Address', 'Policy', 'Commission']

export function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-between px-2 py-3">
      {STEP_LABELS.map((label, i) => {
        const num = i + 1
        const completed = num < current
        const active = num === current
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex items-center justify-center w-7 h-7 rounded-full border-2 text-xs font-bold transition-colors',
                  completed && 'bg-[#7dd3fc] border-[#7dd3fc] text-black',
                  active && 'border-[#7dd3fc] text-[#7dd3fc] bg-[#7dd3fc]/10',
                  !completed && !active && 'border-border text-muted-foreground',
                )}
              >
                {completed ? <IconCheck size={14} /> : num}
              </div>
              <span className={cn(
                'text-[10px] font-medium',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={cn(
                'flex-1 h-px mx-2 mb-4',
                completed ? 'bg-[#7dd3fc]/50' : 'bg-border',
              )} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Step 1: Client Info ─────────────────────────────────

interface Step1Props extends WizardStepProps {
  showAI: boolean
  setShowAI: (v: boolean) => void
  transcript: string
  setTranscript: (v: string) => void
  parsing: boolean
  handleAIParse: () => void
  dragOver: boolean
  setDragOver: (v: boolean) => void
  handleDrop: (e: React.DragEvent) => void
  user: AuthUser | null
  accountAgentId: string
  onRepairAgentId: () => void
  repairingAgentId: boolean
}

export function WizardStep1({
  form, highlightedFields, showAI, setShowAI, transcript, setTranscript,
  parsing, handleAIParse, dragOver, setDragOver, handleDrop, user,
  accountAgentId, onRepairAgentId, repairingAgentId,
}: Step1Props) {
  const { register, formState: { errors } } = form

  return (
    <div className="space-y-4">
      {/* Agent */}
      <div>
        <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Agent<RequiredMark /></Label>
        {user ? (
          <div className="flex items-center gap-3 mb-2 p-2.5 rounded-lg bg-muted/30 border border-border/50">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} className="w-8 h-8 rounded-full" alt="" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                {user.displayName?.charAt(0) ?? '?'}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-foreground">{user.displayName}</p>
              <p className={cn('text-[11px]', accountAgentId ? 'font-mono text-muted-foreground' : 'text-amber-300')}>
                {accountAgentId || 'Account Agent ID missing'}
              </p>
            </div>
            {!accountAgentId && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRepairAgentId}
                disabled={repairingAgentId}
                className="ml-auto h-8"
              >
                {repairingAgentId ? 'Repairing...' : 'Repair ID'}
              </Button>
            )}
          </div>
        ) : (
          <div className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-300">
            Sign in again to provision your account Agent ID.
          </div>
        )}
        <input type="hidden" {...register('agentId')} />
        {errors.agentId && <p className="text-xs text-red-400 mt-1">{errors.agentId.message}</p>}
      </div>

      {/* AI Auto-Fill */}
      <div className="border-b border-border/40 pb-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowAI(!showAI)}
          className="w-full flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <IconSparkles size={16} className="text-primary" />
          <span className="flex-1 text-left text-sm">Auto-fill with AI from call transcript</span>
          <IconChevronDown size={14} className={cn('transition-transform', showAI && 'rotate-180')} />
        </Button>
        <AnimatePresence>
          {showAI && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-3">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={cn(
                    'rounded-xl border-2 border-dashed transition-colors p-1',
                    dragOver ? 'border-primary bg-primary/5' : 'border-border/50'
                  )}
                >
                  <Textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    placeholder="Paste your call transcript here, or drop a .txt file..."
                    className="h-28 bg-transparent resize-none border-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">
                    AI will extract client info, policy type, carrier, premium, and more
                  </p>
                  <Button
                    type="button"
                    variant="gradient"
                    size="sm"
                    onClick={handleAIParse}
                    disabled={!transcript.trim() || parsing}
                    className={cn(
                      'flex items-center gap-1.5',
                      parsing && 'animate-pulse shadow-[0_0_15px_rgba(125, 211, 252, 0.25)]'
                    )}
                  >
                    {parsing ? (
                      <><IconLoader2 size={14} className="animate-spin" /> Extracting...</>
                    ) : (
                      <><IconSparkles size={14} /> Auto-Fill</>
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Client fields */}
      <FieldWrap name="clientName" highlighted={highlightedFields}>
        <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Client Name<RequiredMark /></Label>
        <Input {...register('clientName')} placeholder="Client full name" />
        {errors.clientName && <p className="text-xs text-red-400 mt-1">{errors.clientName.message}</p>}
      </FieldWrap>

      <div className="grid grid-cols-2 gap-3">
        <FieldWrap name="clientDOB" highlighted={highlightedFields}>
          <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Date of Birth</Label>
          <Input type="date" {...register('clientDOB')} />
        </FieldWrap>
        <FieldWrap name="clientPhone" highlighted={highlightedFields}>
          <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Phone</Label>
          <Input {...register('clientPhone')} placeholder="(555) 123-4567" />
        </FieldWrap>
      </div>
    </div>
  )
}

// ── Step 2: Address & Payee ─────────────────────────────

export function WizardStep2({ form, highlightedFields }: WizardStepProps) {
  const { register, setValue, watch, getValues, formState: { errors } } = form

  const [showPayor, setShowPayor] = useState(!!getValues('payorName'))
  const [showOwner, setShowOwner] = useState(!!getValues('ownerName'))

  function togglePayor(checked: boolean) {
    setShowPayor(checked)
    if (!checked) {
      setValue('payorName', undefined)
      setValue('payorRelationship', undefined)
      setValue('payorPhone', undefined)
      setValue('payorAddress', undefined)
    }
  }

  function toggleOwner(checked: boolean) {
    setShowOwner(checked)
    if (!checked) {
      setValue('ownerName', undefined)
      setValue('ownerRelationship', undefined)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">Contact Details</p>

      <FieldWrap name="clientAddress" highlighted={highlightedFields}>
        <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Address</Label>
        <AddressAutocomplete
          value={watch('clientAddress')}
          onChange={(v) => setValue('clientAddress', v, { shouldValidate: true })}
          placeholder="123 Main St, City, ST 12345"
        />
      </FieldWrap>

      <FieldWrap name="clientEmail" highlighted={highlightedFields}>
        <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Email</Label>
        <Input type="email" {...register('clientEmail')} placeholder="client@email.com" />
        {errors.clientEmail && <p className="text-xs text-red-400 mt-1">{errors.clientEmail.message}</p>}
      </FieldWrap>

      <Separator className="my-2" />

      {/* Different Payor */}
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground font-medium">Different Payor</Label>
          <Switch checked={showPayor} onCheckedChange={togglePayor} />
        </div>
        <AnimatePresence>
          {showPayor && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-3 p-3 rounded-lg bg-muted/20 border border-border/30">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Payor Name</Label>
                    <Input {...register('payorName')} placeholder="Full name" />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Relationship</Label>
                    <Select
                      value={form.watch('payorRelationship') || undefined}
                      onValueChange={(v) => setValue('payorRelationship', v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Spouse">Spouse</SelectItem>
                        <SelectItem value="Parent">Parent</SelectItem>
                        <SelectItem value="Child">Child</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Payor Phone</Label>
                    <Input {...register('payorPhone')} placeholder="(555) 123-4567" />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Payor Address</Label>
                    <AddressAutocomplete
                      value={watch('payorAddress')}
                      onChange={(v) => setValue('payorAddress', v, { shouldValidate: true })}
                      placeholder="Address"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Different Owner */}
      <div>
        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground font-medium">Different Owner</Label>
          <Switch checked={showOwner} onCheckedChange={toggleOwner} />
        </div>
        <AnimatePresence>
          {showOwner && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-3 p-3 rounded-lg bg-muted/20 border border-border/30">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Owner Name</Label>
                    <Input {...register('ownerName')} placeholder="Full name" />
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Relationship</Label>
                    <Select
                      value={form.watch('ownerRelationship') || undefined}
                      onValueChange={(v) => setValue('ownerRelationship', v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Spouse">Spouse</SelectItem>
                        <SelectItem value="Parent">Parent</SelectItem>
                        <SelectItem value="Child">Child</SelectItem>
                        <SelectItem value="Trust">Trust</SelectItem>
                        <SelectItem value="Business">Business</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Step 3: Policy Details ──────────────────────────────

export function WizardStep3({ form, highlightedFields }: WizardStepProps) {
  const { register, setValue, watch, formState: { errors } } = form

  const policyType = watch('policyType') || ''
  const carrierValue = watch('carrier') || ''
  const leadSourceValue = watch('leadSource') || ''
  const productNameValue = watch('productName') || ''
  const isOtherCarrier = carrierValue === 'Other' || (carrierValue !== '' && !FFL_CARRIERS.includes(carrierValue as typeof FFL_CARRIERS[number]))
  const [showCustomCarrier, setShowCustomCarrier] = useState(isOtherCarrier && carrierValue !== 'Other')
  const [showLifeSelector, setShowLifeSelector] = useState(false)

  const premium = watch('premium') || 0
  const paymentMode = watch('paymentMode')
  const commissionPct = watch('commissionRate') || 0
  const currentStatus = watch('status') || 'submitted'

  const { annualPremium, commissionDollars, modeLabel } = useMemo(() => {
    const multiplier = { monthly: 12, quarterly: 4, 'semi-annual': 2, annual: 1 }[paymentMode ?? ''] ?? 12
    const ap = premium * multiplier
    const comm = ap * (commissionPct / 100)
    const label = PAYMENT_MODE_LABELS[paymentMode ?? ''] ?? '/mo'
    return { annualPremium: ap, commissionDollars: comm, modeLabel: label }
  }, [premium, paymentMode, commissionPct])

  // When policyType changes to life, open the cascading selector
  useEffect(() => {
    if (policyType === 'life' && !carrierValue) {
      setShowLifeSelector(true)
    }
  }, [policyType, carrierValue])

  // When switching away from life, clear life-specific values
  useEffect(() => {
    if (policyType !== 'life') {
      setValue('productName', '')
      setShowLifeSelector(false)
    }
  }, [policyType, setValue])

  function handleCarrierChange(v: string) {
    if (v === 'Other') {
      setShowCustomCarrier(true)
      setValue('carrier', '', { shouldValidate: true })
    } else {
      setShowCustomCarrier(false)
      setValue('carrier', v, { shouldValidate: true })
    }
  }

  // Determine what to show in the Select: the carrier if it's in the list, or "Other"
  const selectDisplayValue = showCustomCarrier ? 'Other' : (FFL_CARRIERS.includes(carrierValue as typeof FFL_CARRIERS[number]) ? carrierValue : undefined)

  // Life policy: whether the cascading selector has been completed
  const lifeFlowComplete = policyType === 'life' && carrierValue !== '' && !showLifeSelector

  return (
    <div className="space-y-4">
      {/* Policy Type — always visible */}
      <FieldWrap name="policyType" highlighted={highlightedFields}>
        <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Policy Type<RequiredMark /></Label>
        <Select value={policyType || undefined} onValueChange={(v) => setValue('policyType', v, { shouldValidate: true })}>
          <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {POLICY_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace('_', ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        {errors.policyType && <p className="text-xs text-red-400 mt-1">{errors.policyType.message}</p>}
      </FieldWrap>

      {/* Life policy: cascading sub-selector */}
      {policyType === 'life' && showLifeSelector && (
        <Card className="bg-muted/20 border border-border/50 rounded-xl p-4">
          <LifeProductSelector
            form={form}
            onComplete={() => setShowLifeSelector(false)}
            onCancel={() => {
              setValue('policyType', '', { shouldValidate: true })
              setShowLifeSelector(false)
            }}
          />
        </Card>
      )}

      {/* Life policy: summary breadcrumb (after cascading flow completes) */}
      {lifeFlowComplete && (
        <Card className="bg-muted/20 border border-border/50 rounded-xl p-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {leadSourceValue && (
              <>
                <Badge variant="outline" className="text-[10px]">{leadSourceValue}</Badge>
                <IconChevronRight size={12} className="text-muted-foreground" />
              </>
            )}
            <Badge variant="outline" className="text-[10px]">{carrierValue}</Badge>
            {productNameValue && (
              <>
                <IconChevronRight size={12} className="text-muted-foreground" />
                <Badge variant="outline" className="text-[10px]">{productNameValue}</Badge>
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowLifeSelector(true)}
              className="h-6 px-2 text-[10px] ml-auto gap-1 text-muted-foreground"
            >
              <IconPencil size={12} /> Change
            </Button>
          </div>
        </Card>
      )}

      {/* Non-life: standard carrier select */}
      {policyType !== 'life' && (
        <FieldWrap name="carrier" highlighted={highlightedFields}>
          <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Carrier<RequiredMark /></Label>
          <Select value={selectDisplayValue} onValueChange={handleCarrierChange}>
            <SelectTrigger><SelectValue placeholder="Select carrier..." /></SelectTrigger>
            <SelectContent className="max-h-60">
              {FFL_CARRIERS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {showCustomCarrier && (
            <Input
              className="mt-2"
              {...register('carrier')}
              placeholder="Enter carrier name..."
            />
          )}
          {errors.carrier && <p className="text-xs text-red-400 mt-1">{errors.carrier.message}</p>}
        </FieldWrap>
      )}

      <div className="grid grid-cols-2 gap-3">
        <FieldWrap name="paymentMode" highlighted={highlightedFields}>
          <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Payment Mode</Label>
          <Select value={watch('paymentMode') || undefined} onValueChange={(v) => setValue('paymentMode', v, { shouldValidate: true })}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="semi-annual">Semi-Annual</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
        </FieldWrap>
        <FieldWrap name="policyNumber" highlighted={highlightedFields}>
          <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Policy Number</Label>
          <Input {...register('policyNumber')} placeholder="Optional" />
        </FieldWrap>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldWrap name="premium" highlighted={highlightedFields}>
          <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Premium<RequiredMark /></Label>
          <CurrencyInput
            value={watch('premium')}
            onChange={(val) => setValue('premium', val, { shouldValidate: true })}
            placeholder="$0.00"
          />
          {errors.premium && <p className="text-xs text-red-400 mt-1">{errors.premium.message}</p>}
        </FieldWrap>
        <FieldWrap name="faceAmount" highlighted={highlightedFields}>
          <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Face Amount</Label>
          <CurrencyInput
            value={watch('faceAmount')}
            onChange={(val) => setValue('faceAmount', val)}
            placeholder="$0.00"
          />
        </FieldWrap>
      </div>

      {/* Status pills */}
      <FieldWrap name="status" highlighted={highlightedFields}>
        <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Status</Label>
        <div className="flex flex-wrap gap-2">
          {SALE_STATUSES.map((s) => (
            <Button
              key={s}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setValue('status', s, { shouldValidate: true })}
              className={cn(
                'h-7 px-3 text-xs capitalize border transition-colors',
                currentStatus === s ? STATUS_ACTIVE_STYLES[s] : STATUS_STYLES[s]
              )}
            >
              {s}
            </Button>
          ))}
        </div>
      </FieldWrap>

      {/* Live Policy Summary */}
      {premium > 0 && (
        <Card className="bg-muted/30 border border-border/50 rounded-xl p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {paymentMode ? paymentMode.charAt(0).toUpperCase() + paymentMode.slice(1) : 'Monthly'} Premium
              </span>
              <span className="text-foreground font-mono tabular-nums">
                ${premium.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{modeLabel}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Annual Premium (AP)</span>
              <span className="text-base font-bold text-foreground font-mono tabular-nums">
                ${annualPremium.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {commissionPct > 0 && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Commission Rate</span>
                  <span className="text-foreground font-mono tabular-nums">{commissionPct}%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Est. Commission</span>
                  <span className="text-green-400 font-mono tabular-nums font-medium">
                    ${commissionDollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Step 4: Commission Split ────────────────────────────

interface Step4Props extends WizardStepProps {
  user: AuthUser | null
  agents: SalesAgentDirectoryEntry[]
  defaultAgentId: string
}

export function WizardStep4({ form, highlightedFields, user, agents, defaultAgentId }: Step4Props) {
  const { register, setValue, watch, formState: { errors }, control } = form
  const accountAgentId = defaultAgentId || getAccountAgentId(user)

  const { fields, append, remove } = useFieldArray({ control, name: 'commissionSplits' })

  const premium = watch('premium') || 0
  const paymentMode = watch('paymentMode')
  const commissionPct = watch('commissionRate') || 0
  const splits = watch('commissionSplits') || []

  const { data: compTiers } = useCompTiers()

  const { annualPremium, commissionDollars, upfrontAdvance } = useMemo(() => {
    const multiplier = { monthly: 12, quarterly: 4, 'semi-annual': 2, annual: 1 }[paymentMode ?? ''] ?? 12
    const ap = premium * multiplier
    const comm = ap * (commissionPct / 100)
    const advance = comm * 0.75
    return { annualPremium: ap, commissionDollars: comm, upfrontAdvance: advance }
  }, [premium, paymentMode, commissionPct])

  const splitTotal = useMemo(() => splits.reduce((sum, s) => sum + (s.percentage || 0), 0), [splits])
  const splitErrorMessage = typeof errors.commissionSplits?.message === 'string' ? errors.commissionSplits.message : ''

  return (
    <div className="space-y-4">
      {/* Commission & Comp Tier */}
      <FieldWrap name="commissionRate" highlighted={highlightedFields}>
        <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Contract Level (Commission %)</Label>
        <div className="grid sm:grid-cols-[200px_1fr] items-center gap-3">
          <div className="flex items-center gap-2">
            <Select
              value={commissionPct > 0 ? commissionPct.toString() : undefined}
              onValueChange={(v) => setValue('commissionRate', parseFloat(v), { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Level..." />
              </SelectTrigger>
              <SelectContent>
                {(compTiers ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.percentage.toString()}>
                    {t.name} ({t.percentage}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="200"
              {...register('commissionRate', { valueAsNumber: true })}
              className="w-16 text-center grid-none h-9 p-1"
              aria-label="Custom commission percentage"
            />
          </div>

          {commissionPct > 0 && premium > 0 && (
            <div className="flex flex-col gap-0.5 text-sm">
               <span className="text-green-400 font-mono font-medium">
                = ${commissionDollars.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-muted-foreground font-sans text-xs ml-0.5">Total Comp</span>
               </span>
               <span className="text-blue-400 font-mono font-medium">
                + ${upfrontAdvance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-muted-foreground font-sans text-xs ml-0.5">Upfront Advance (75%)</span>
               </span>
            </div>
          )}
        </div>
        {errors.commissionRate && <p className="text-xs text-red-400 mt-1">{errors.commissionRate.message}</p>}
      </FieldWrap>

      <Separator />

      {/* Commission Splits */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm text-muted-foreground font-medium">Commission Splits</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => append({ agentId: '', percentage: 0 })}
            className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            <IconPlus size={14} /> Add Agent Split
          </Button>
        </div>

        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 border border-border/30">
              <div className="flex-1">
                <AgentSplitSelect
                  value={watch(`commissionSplits.${index}.agentId`) || ''}
                  onChange={(agentId) =>
                    setValue(`commissionSplits.${index}.agentId`, agentId, { shouldValidate: true })
                  }
                  agents={agents}
                  placeholder={index === 0 ? (accountAgentId || user?.displayName || 'Primary agent') : 'Select split agent'}
                />
                <input type="hidden" {...register(`commissionSplits.${index}.agentId`)} />
                {errors.commissionSplits?.[index]?.agentId && (
                  <p className="mt-1 text-[11px] text-red-400">
                    {errors.commissionSplits[index]?.agentId?.message}
                  </p>
                )}
              </div>
              <div className="w-20">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  {...register(`commissionSplits.${index}.percentage`)}
                  placeholder="%"
                  className="h-8 text-sm text-center"
                />
                {errors.commissionSplits?.[index]?.percentage && (
                  <p className="mt-1 text-[11px] text-red-400">
                    {errors.commissionSplits[index]?.percentage?.message}
                  </p>
                )}
              </div>
              <span className="text-xs text-muted-foreground w-4">%</span>
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  className="h-7 w-7 text-muted-foreground hover:text-red-400"
                >
                  <IconTrash size={14} />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Total */}
        <div className={cn(
          'flex items-center justify-between mt-2 px-2 py-1.5 rounded-lg text-sm font-medium',
          splitTotal === 100 ? 'text-green-400' : 'text-red-400',
        )}>
          <span>Total</span>
          <span className="font-mono tabular-nums">{splitTotal}%</span>
        </div>
        {(splitTotal !== 100 || splitErrorMessage) && splits.length > 0 && (
          <p className="text-xs text-red-400 mt-1">{splitErrorMessage || 'Splits must total 100%'}</p>
        )}
      </div>

      <Separator />

      {/* Lead Source */}
      <FieldWrap name="leadSource" highlighted={highlightedFields}>
        <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Lead Source</Label>
        {watch('policyType') === 'life' && watch('leadSource') ? (
          <div className="flex items-center gap-2">
            <Badge variant="outline">{watch('leadSource')}</Badge>
            <Button type="button" variant="ghost" size="sm" onClick={() => setValue('leadSource', '')} className="h-7 text-xs text-muted-foreground">
              Change
            </Button>
          </div>
        ) : (
          <LeadSourceSelect value={watch('leadSource') as string | undefined} onChange={(v) => setValue('leadSource', v)} />
        )}
      </FieldWrap>

      {/* Notes */}
      <FieldWrap name="notes" highlighted={highlightedFields}>
        <Label className="text-sm text-muted-foreground mb-1.5 block font-medium">Notes</Label>
        <Textarea
          {...register('notes')}
          placeholder="Optional notes..."
          className="h-20 resize-none"
        />
      </FieldWrap>
    </div>
  )
}

function AgentSplitSelect({
  value,
  onChange,
  agents,
  placeholder,
}: {
  value: string
  onChange: (agentId: string) => void
  agents: SalesAgentDirectoryEntry[]
  placeholder: string
}) {
  const known = agents.some((agent) => agent.agentId === value)

  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-sm">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {agents.map((agent) => (
          <SelectItem key={agent.agentId} value={agent.agentId}>
            {agent.displayName || agent.email || agent.agentId.slice(0, 8)}
          </SelectItem>
        ))}
        {value && !known ? (
          <SelectItem value={value}>Unknown agent: {value.slice(0, 12)}</SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  )
}

// ── Lead Source Select ───────────────────────────────────

function LeadSourceSelect({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const { data: programs } = useLeadPrograms()

  return (
    <Select value={value || '_none'} onValueChange={(v) => onChange(v === '_none' ? '' : v)}>
      <SelectTrigger>
        <SelectValue placeholder="Select lead source" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="_none">None</SelectItem>
        {(programs ?? []).map((p) => (
          <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
