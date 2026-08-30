import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createSaleSchema, SALE_WIZARD_FIELDS, type CreateSaleFormData } from '../../lib/schemas'
import { useCreateSale, useSalesAgentDirectory } from '../../hooks/useSales'
import { useRepairAuthIdentity } from '../../hooks/useAuthRepair'
import { toast } from 'sonner'
import { IconLoader2 } from '@tabler/icons-react'
import { useAuthStore } from '../../store'
import { api } from '../../services/api'
import { motion, AnimatePresence } from 'framer-motion'
import { tabContentVariants } from '../../lib/motion'
import { getAccountAgentId } from '../../lib/agent-id'
import { Button } from '@/components/ui/button'
import { FFL_CARRIERS, serializeSaleMeta, type SaleMeta } from '../../types/portal'
import { StepIndicator, WizardStep1, WizardStep2, WizardStep3, WizardStep4 } from './wizard-steps'

interface CreateSaleWizardFormProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export default function CreateSaleWizardForm({ onSuccess, onCancel }: CreateSaleWizardFormProps) {
  const { user } = useAuthStore()
  const createSale = useCreateSale()
  const repairAuth = useRepairAuthIdentity()
  const { data: salesAgents = [] } = useSalesAgentDirectory()
  const accountAgentId = getAccountAgentId(user)
  const defaultAgentId =
    accountAgentId || salesAgents.find((agent) => agent.isCurrentUser)?.agentId || ''
  const defaultFormValues = useMemo(
    () => ({
      status: 'submitted',
      agentId: defaultAgentId,
      commissionSplits: defaultAgentId ? [{ agentId: defaultAgentId, percentage: 100 }] : [],
    }),
    [defaultAgentId],
  )

  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(0)

  const [showAI, setShowAI] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [parsing, setParsing] = useState(false)
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set())
  const [dragOver, setDragOver] = useState(false)

  const form = useForm<CreateSaleFormData>({
    resolver: zodResolver(createSaleSchema),
    mode: 'onChange',
    defaultValues: defaultFormValues,
  })

  useEffect(() => {
    form.setValue('agentId', defaultAgentId, { shouldValidate: true })
    const splits = form.getValues('commissionSplits')
    if (!defaultAgentId) {
      form.setValue('commissionSplits', [], { shouldValidate: true })
      return
    }
    if (!splits?.length) {
      form.setValue('commissionSplits', [{ agentId: defaultAgentId, percentage: 100 }], { shouldValidate: true })
      return
    }
    form.setValue('commissionSplits.0.agentId', defaultAgentId, { shouldValidate: true })
  }, [defaultAgentId, form])

  // Reset wizard-local state without firing onCancel — used after a successful submit
  // where the parent decides what to do next (typically close the dialog via onSuccess).
  const resetLocalState = () => {
    form.reset(defaultFormValues)
    setStep(1)
    setDirection(0)
    setTranscript('')
    setShowAI(false)
    setHighlightedFields(new Set())
  }

  const handleCancel = () => {
    resetLocalState()
    onCancel?.()
  }

  async function handleNext() {
    if (step === 1 && !form.getValues('agentId')?.trim()) {
      toast.error('Repair your Account Agent ID before submitting business.')
      return
    }
    const fields = SALE_WIZARD_FIELDS[step]
    if (fields) {
      const valid = await form.trigger(fields, { shouldFocus: true })
      if (!valid) return
    }
    setDirection(1)
    setStep((s) => s + 1)
  }

  function handleBack() {
    setDirection(-1)
    setStep((s) => s - 1)
  }

  async function handleAIParse() {
    if (!transcript.trim()) return
    setParsing(true)

    try {
      const parsed = await api.parseTranscript(transcript)

      const fieldMap: Record<string, keyof CreateSaleFormData> = {
        clientName: 'clientName',
        clientDOB: 'clientDOB',
        clientAddress: 'clientAddress',
        clientPhone: 'clientPhone',
        clientEmail: 'clientEmail',
        policyType: 'policyType',
        carrier: 'carrier',
        premium: 'premium',
        commission: 'commissionRate',
        commissionRate: 'commissionRate',
        faceAmount: 'faceAmount',
        paymentMode: 'paymentMode',
        policyNumber: 'policyNumber',
        notes: 'notes',
      }

      const filled = new Set<string>()
      for (const [aiField, formField] of Object.entries(fieldMap)) {
        let value = parsed[aiField]
        if (value !== null && value !== undefined && value !== '') {
          // Fuzzy-match carrier against the canonical FFL list so downstream code
          // can rely on the exact casing/punctuation.
          if (formField === 'carrier' && typeof value === 'string') {
            const raw = value
            const match = FFL_CARRIERS.find(
              (c) => c.toLowerCase() === raw.toLowerCase()
            )
            if (match) value = match
          }
          form.setValue(formField, value as string | number, { shouldValidate: true })
          filled.add(formField)
        }
      }

      form.setValue('transcript', transcript)

      setHighlightedFields(filled)
      setTimeout(() => setHighlightedFields(new Set()), 2500)

      toast.success(`AI extracted ${filled.size} fields from transcript`)
    } catch {
      toast.error('Failed to parse transcript. Try again or fill manually.')
    } finally {
      setParsing(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      file.text().then((text) => setTranscript(text))
    } else {
      toast.error('Only .txt files supported for now')
    }
  }

  function handleRepairAgentId() {
    repairAuth.mutate(undefined, {
      onSuccess: (repaired) => {
        const repairedAgentId = getAccountAgentId(repaired)
        if (!repairedAgentId) {
          toast.error('Repair completed, but no Account Agent ID was returned')
          return
        }
        form.setValue('agentId', repairedAgentId, { shouldValidate: true })
        form.setValue('commissionSplits', [{ agentId: repairedAgentId, percentage: 100 }], { shouldValidate: true })
        toast.success('Account Agent ID repaired')
      },
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : 'Failed to repair Account Agent ID'),
    })
  }

  const onValid = (data: CreateSaleFormData) => {
    const rawNotes = data.notes?.trim() || undefined
    const meta: SaleMeta = {}

    if (data.leadSource) meta.leadSource = data.leadSource
    if (data.payorName) meta.payorName = data.payorName
    if (data.payorRelationship) meta.payorRelationship = data.payorRelationship
    if (data.payorPhone) meta.payorPhone = data.payorPhone
    if (data.payorAddress) meta.payorAddress = data.payorAddress
    if (data.ownerName) meta.ownerName = data.ownerName
    if (data.ownerRelationship) meta.ownerRelationship = data.ownerRelationship
    if (data.commissionRate && data.commissionRate > 0) meta.commissionRate = data.commissionRate
    const commissionSplits = data.commissionSplits
      ?.map((split) => ({
        agentId: split.agentId?.trim() ?? '',
        percentage: Number(split.percentage || 0),
      }))
      .filter((split) => split.agentId && split.percentage > 0)
    if (commissionSplits?.length) meta.commissionSplits = commissionSplits

    const premiumMultiplier = { monthly: 12, quarterly: 4, 'semi-annual': 2, annual: 1 }[data.paymentMode ?? ''] ?? 12
    const annualizedPremium = data.premium * premiumMultiplier
    const commissionDollars =
      data.commissionRate && data.commissionRate > 0
        ? annualizedPremium * (data.commissionRate / 100)
        : undefined

    const notes =
      Object.keys(meta).length > 0
        ? serializeSaleMeta(meta, rawNotes)
        : rawNotes

    const agentId = data.agentId?.trim()
    createSale.mutate(
      {
        ...(agentId ? { agentId } : {}),
        clientName: data.clientName.trim(),
        policyType: data.policyType,
        carrier: data.carrier.trim(),
        premium: data.premium,
        commission: commissionDollars,
        status: data.status || undefined,
        policyNumber: data.policyNumber?.trim() || undefined,
        notes,
        clientDOB: data.clientDOB || undefined,
        clientAddress: data.clientAddress?.trim() || undefined,
        clientPhone: data.clientPhone?.trim() || undefined,
        clientEmail: data.clientEmail?.trim() || undefined,
        faceAmount: data.faceAmount || undefined,
        paymentMode: data.paymentMode || undefined,
        transcript: data.transcript || undefined,
        productName: data.productName?.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Sale created')
          resetLocalState()
          onSuccess?.()
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to create sale'),
      },
    )
  }

  return (
    <>
      <StepIndicator current={step} />

      <form onSubmit={form.handleSubmit(onValid)} className="flex min-h-0 w-full flex-col overflow-x-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={tabContentVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2 }}
            className="w-full overflow-x-hidden"
          >
            {step === 1 && (
              <WizardStep1
                form={form}
                highlightedFields={highlightedFields}
                showAI={showAI}
                setShowAI={setShowAI}
                transcript={transcript}
                setTranscript={setTranscript}
                parsing={parsing}
                handleAIParse={handleAIParse}
                dragOver={dragOver}
                setDragOver={setDragOver}
                handleDrop={handleDrop}
                user={user}
                accountAgentId={defaultAgentId}
                onRepairAgentId={handleRepairAgentId}
                repairingAgentId={repairAuth.isPending}
              />
            )}
            {step === 2 && (
              <WizardStep2
                form={form}
                highlightedFields={highlightedFields}
              />
            )}
            {step === 3 && (
              <WizardStep3
                form={form}
                highlightedFields={highlightedFields}
              />
            )}
            {step === 4 && (
              <WizardStep4
                form={form}
                highlightedFields={highlightedFields}
                user={user}
                agents={salesAgents}
                defaultAgentId={defaultAgentId}
              />
            )}
          </motion.div>
        </AnimatePresence>

        <div className="sticky bottom-0 z-10 -mx-1 mt-4 flex justify-between border-t border-border/60 bg-background/95 px-1 pt-4 pb-1 backdrop-blur">
          {step > 1 ? (
            <Button type="button" variant="ghost" size="sm" onClick={handleBack}>
              Back
            </Button>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
          )}
          {step < 4 ? (
            <Button type="button" size="sm" onClick={handleNext}>
              Next
            </Button>
          ) : (
            <Button
              type="submit"
              size="sm"
              disabled={createSale.isPending}
              className="min-w-[100px]"
            >
              {createSale.isPending ? (
                <span className="flex items-center gap-2">
                  <IconLoader2 size={14} className="animate-spin" />
                  Creating...
                </span>
              ) : (
                'Create Sale'
              )}
            </Button>
          )}
        </div>

        <input type="hidden" {...form.register('transcript')} />
      </form>
    </>
  )
}
