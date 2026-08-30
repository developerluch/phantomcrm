import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { bugReportSchema, type BugReportFormData } from '../lib/schemas'
import { useSubmitBugReport } from '../hooks/useBugReport'
import { toast } from 'sonner'
import { IconBug, IconLoader2 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface Props {
  open: boolean
  onClose: () => void
}

export default function BugReportModal({ open, onClose }: Props) {
  const submitBug = useSubmitBugReport()

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isValid, touchedFields, isSubmitted },
  } = useForm<BugReportFormData>({
    resolver: zodResolver(bugReportSchema),
    mode: 'onBlur',
    defaultValues: { severity: 'medium' },
  })

  const handleClose = () => {
    reset()
    onClose()
  }

  const onValid = (data: BugReportFormData) => {
    submitBug.mutate(
      {
        description: data.description,
        severity: data.severity,
        pageUrl: window.location.pathname,
        userAgent: navigator.userAgent,
      },
      {
        onSuccess: () => {
          toast.success('Bug report submitted — thank you!')
          handleClose()
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to submit bug report'),
      }
    )
  }

  const showDescriptionError = errors.description && (touchedFields.description || isSubmitted)

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="bg-card/95 backdrop-blur-xl border-border/60 max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg bg-destructive/10 text-destructive p-2">
              <IconBug size={20} />
            </div>
            <div>
              <DialogTitle>Report a Bug</DialogTitle>
              <DialogDescription>Help us improve by reporting issues</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onValid)} className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block font-medium">Description *</label>
            <Textarea
              {...register('description')}
              placeholder="Describe the bug you encountered..."
              className="bg-card/40 border-border/60 min-h-[120px] resize-none"
            />
            {showDescriptionError && (
              <p className="text-xs text-destructive mt-1">{errors.description?.message}</p>
            )}
          </div>

          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block font-medium">Severity *</label>
            <Select
              value={watch('severity')}
              onValueChange={(v) => setValue('severity', v as 'low' | 'medium' | 'high' | 'critical', { shouldValidate: true })}
            >
              <SelectTrigger className="bg-card/40 border-border/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            {errors.severity && <p className="text-xs text-destructive mt-1">{errors.severity.message}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="gradient"
              disabled={!isValid || submitBug.isPending}
            >
              {submitBug.isPending ? (
                <span className="flex items-center gap-2">
                  <IconLoader2 size={14} className="animate-spin" />
                  Submitting...
                </span>
              ) : (
                'Submit Report'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
