import { useState } from 'react'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { IconCalendar } from '@tabler/icons-react'
import { toast } from 'sonner'
import { useCreateContact } from '@/hooks/useContacts'
import { LIFECYCLE_STAGES, LIFECYCLE_STAGE_LABELS, type LifecycleStage } from '@/types/portal'
import { cn } from '@/lib/utils'

interface NewContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (id: string) => void
}

export function NewContactDialog({ open, onOpenChange, onCreated }: NewContactDialogProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState<Date | undefined>()
  const [lifecycleStage, setLifecycleStage] = useState<LifecycleStage>('lead')

  const create = useCreateContact()

  function reset() {
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setDob(undefined)
    setLifecycleStage('lead')
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!firstName && !lastName && !email && !phone) {
      toast.error('Add at least a name, email, or phone')
      return
    }
    try {
      const contact = await create.mutateAsync({
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        email: email || undefined,
        phone: phone || undefined,
        dob: dob ? format(dob, 'yyyy-MM-dd') : undefined,
        lifecycleStage,
      })
      toast.success('Contact created')
      reset()
      onOpenChange(false)
      onCreated?.(contact.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create contact')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New Contact</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">First name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus />
            </div>
            <div>
              <Label className="text-xs">Last name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
            </div>
            <div>
              <Label className="text-xs">Lifecycle</Label>
              <Select
                value={lifecycleStage}
                onValueChange={(v) => setLifecycleStage(v as LifecycleStage)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIFECYCLE_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {LIFECYCLE_STAGE_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Date of birth</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !dob && 'text-muted-foreground',
                  )}
                >
                  <IconCalendar size={16} className="mr-2" />
                  {dob ? format(dob, 'PP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dob} onSelect={setDob} />
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create contact'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
