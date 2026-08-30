import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SnoozeDurationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (snoozeUntilIso: string) => void
}

function plusHoursIso(h: number): string {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString()
}

function nextMorningIso(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(9, 0, 0, 0)
  return d.toISOString()
}

/** SnoozeDurationDialog — preset duration picker. 1h / 4h / Tomorrow are real
 *  and fire `onPick` with the computed ISO timestamp. Custom is a toast.info
 *  stub until M2B lands a date/time picker. */
export function SnoozeDurationDialog({
  open,
  onOpenChange,
  onPick,
}: SnoozeDurationDialogProps) {
  const pick = (iso: string) => {
    onPick(iso)
    onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Snooze conversation</DialogTitle>
          <DialogDescription>
            The thread will hide from your inbox and reappear at the chosen
            time.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2 py-2">
          <Button variant="ghost" onClick={() => pick(plusHoursIso(1))}>
            1 hour
          </Button>
          <Button variant="ghost" onClick={() => pick(plusHoursIso(4))}>
            4 hours
          </Button>
          <Button variant="ghost" onClick={() => pick(nextMorningIso())}>
            Tomorrow
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              toast.info('Custom snooze — coming in M2B', {
                description: 'For now, pick one of the preset durations.',
              })
            }
          >
            Custom…
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
