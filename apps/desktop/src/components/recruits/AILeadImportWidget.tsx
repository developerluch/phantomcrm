import { useState } from 'react'
import { useAIImportParse, useAIImportConfirm } from '../../hooks/useAIImport'
import type { ParsedLead } from '../../types/portal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IconSparkles, IconX, IconAlertTriangle, IconCheck, IconLoader2 } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'

type WidgetStep = 'closed' | 'input' | 'preview'

export default function AILeadImportWidget() {
  const [step, setStep] = useState<WidgetStep>('closed')
  const [rawText, setRawText] = useState('')
  const [parsed, setParsed] = useState<ParsedLead | null>(null)
  const [editFields, setEditFields] = useState<ParsedLead | null>(null)

  const parseMutation = useAIImportParse()
  const confirmMutation = useAIImportConfirm()

  const handleClose = () => {
    setStep('closed')
    setRawText('')
    setParsed(null)
    setEditFields(null)
    parseMutation.reset()
    confirmMutation.reset()
  }

  const handleParse = () => {
    if (!rawText.trim()) return
    parseMutation.mutate(rawText.trim(), {
      onSuccess: (data) => {
        setParsed(data)
        setEditFields({ ...data })
        setStep('preview')
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : 'Failed to parse lead'
        const cleanMsg = msg.replace(/^API \d+:\s*/, '')
        toast.error(cleanMsg || 'Failed to parse lead — check your connection and try again', {
          description: msg !== cleanMsg ? `Status: ${msg.match(/API (\d+)/)?.[1] || 'unknown'}` : undefined,
          duration: 6000,
        })
      },
    })
  }

  const handleFieldChange = (field: keyof ParsedLead, value: string) => {
    if (!editFields) return
    setEditFields({ ...editFields, [field]: value })
  }

  const handleConfirm = () => {
    if (!editFields) return
    confirmMutation.mutate(
      {
        firstName: (editFields.firstName ?? '').trim(),
        lastName: (editFields.lastName ?? '').trim(),
        email: (editFields.email ?? '').trim(),
        phone: editFields.phone?.trim() || undefined,
        city: editFields.city?.trim() || undefined,
        source: editFields.source?.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Recruit created from AI import')
          handleClose()
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : 'Failed to create recruit'
          const cleanMsg = msg.replace(/^API \d+:\s*/, '')
          toast.error(cleanMsg || 'Failed to create recruit — check your connection and try again', {
            description: msg !== cleanMsg ? `Status: ${msg.match(/API (\d+)/)?.[1] || 'unknown'}` : undefined,
            duration: 6000,
          })
        },
      }
    )
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setStep(step === 'closed' ? 'input' : 'closed')}
        className="gap-1.5"
      >
        <IconSparkles size={15} />
        AI Import
      </Button>

      <Dialog open={step !== 'closed'} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="w-[420px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <IconSparkles size={16} className="text-purple-400" />
              <DialogTitle>
                {step === 'input' ? 'AI Lead Import' : 'Review Parsed Lead'}
              </DialogTitle>
            </div>
          </DialogHeader>

          {/* Input Step */}
          {step === 'input' && (
            <div className="space-y-3">
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste lead info (email, LinkedIn message, referral note...)"
                rows={5}
                className="resize-none"
              />
              {parseMutation.isError && (
                <Alert variant="destructive" className="py-2.5 bg-red-500/10 border-red-500/30">
                  <IconAlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs translate-y-[1px]">
                    {parseMutation.error instanceof Error
                      ? parseMutation.error.message.replace(/^API \d+:\s*/, '')
                      : 'Failed to parse — please try again'}
                  </AlertDescription>
                </Alert>
              )}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={handleParse}
                  disabled={!rawText.trim() || parseMutation.isPending}
                  className="gap-1.5"
                >
                  {parseMutation.isPending ? (
                    <>
                      <IconLoader2 size={14} className="animate-spin" />
                      Parsing...
                    </>
                  ) : (
                    <>
                      <IconSparkles size={14} />
                      Parse with AI
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && editFields && (
            <div className="space-y-3">
              {/* Duplicate Warning */}
              {editFields.isDuplicate && (
                <Alert className="py-2.5 border-yellow-500/30 text-yellow-500 bg-yellow-500/10">
                  <IconAlertTriangle className="h-4 w-4 !text-yellow-500" />
                  <AlertDescription className="text-xs font-medium translate-y-[1px]">
                    Possible duplicate
                  </AlertDescription>
                </Alert>
              )}

              {/* Editable Fields Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">First Name</label>
                  <Input
                    value={editFields.firstName}
                    onChange={(e) => handleFieldChange('firstName', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Last Name</label>
                  <Input
                    value={editFields.lastName}
                    onChange={(e) => handleFieldChange('lastName', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                  <Input
                    type="email"
                    value={editFields.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Phone</label>
                  <Input
                    value={editFields.phone}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">City</label>
                  <Input
                    value={editFields.city}
                    onChange={(e) => handleFieldChange('city', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">State</label>
                  <Input
                    value={editFields.state}
                    onChange={(e) => handleFieldChange('state', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Source</label>
                  <Input
                    value={editFields.source}
                    onChange={(e) => handleFieldChange('source', e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                  <Textarea
                    value={editFields.notes}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                    rows={2}
                    className="resize-none min-h-0"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-1 border-t border-border/60">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStep('input')
                    setParsed(null)
                    setEditFields(null)
                  }}
                  className="text-xs"
                >
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirm}
                  disabled={
                    !editFields.firstName?.trim() ||
                    !editFields.lastName?.trim() ||
                    !editFields.email?.trim() ||
                    confirmMutation.isPending
                  }
                  className="gap-1.5"
                >
                  {confirmMutation.isPending ? (
                    <>
                      <IconLoader2 size={14} className="animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <IconCheck size={14} />
                      Create Recruit
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
