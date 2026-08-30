import { useEffect, useState } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useCreateSmartList, useUpdateSmartList } from '@/hooks/useSmartLists'
import type { SmartList, SmartListFilter } from '@/types/portal'

interface SaveSmartListDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The filter to persist. Required for create; ignored in edit mode where the
   *  dialog only edits metadata (name/description/pin). */
  filter: SmartListFilter
  /** Edit mode — when provided, the dialog prefills fields and calls
   *  useUpdateSmartList instead of useCreateSmartList. */
  smartList?: SmartList | null
  /** Admin toggle for "share org-wide" — shows only when isAdmin is true. */
  isAdmin?: boolean
  onSaved?: (id: string) => void
}

export function SaveSmartListDialog({
  open,
  onOpenChange,
  filter,
  smartList,
  isAdmin,
  onSaved,
}: SaveSmartListDialogProps) {
  const editing = smartList != null
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [shareOrgWide, setShareOrgWide] = useState(false)

  // Prefill / reset when the dialog opens or when switching between
  // create / edit targets.
  useEffect(() => {
    if (!open) return
    if (smartList) {
      setName(smartList.name)
      setDescription(smartList.description ?? '')
      setIsPinned(smartList.isPinned)
      setShareOrgWide(smartList.sharedWithAgentIds?.length > 0)
    } else {
      setName('')
      setDescription('')
      setIsPinned(false)
      setShareOrgWide(false)
    }
  }, [open, smartList])

  const create = useCreateSmartList()
  const update = useUpdateSmartList()
  const pending = create.isPending || update.isPending

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    try {
      // `sharedWithAgentIds: ['*']` is a server-honored sentinel for
      // "everyone in the org". Admins only; non-admins can't set it.
      const sharedIds = isAdmin && shareOrgWide ? ['*'] : []

      if (editing && smartList) {
        const sl = await update.mutateAsync({
          id: smartList.id,
          patch: {
            name: name.trim(),
            description: description.trim() || null,
            isPinned,
            ...(isAdmin ? { sharedWithAgentIds: sharedIds } : {}),
          },
        })
        toast.success(`Updated "${sl.name}"`)
        onOpenChange(false)
        onSaved?.(sl.id)
      } else {
        const sl = await create.mutateAsync({
          name: name.trim(),
          description: description.trim() || null,
          filter,
          isPinned,
          ...(isAdmin ? { sharedWithAgentIds: sharedIds } : {}),
        })
        toast.success(`Saved smart list "${sl.name}"`)
        onOpenChange(false)
        onSaved?.(sl.id)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save smart list')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit smart list' : 'Save as Smart List'}</DialogTitle>
          </DialogHeader>

          <div>
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
            <div>
              <Label className="text-sm">Pin to sidebar dropdown</Label>
              <p className="text-xs text-muted-foreground">Quick access from Contacts top bar.</p>
            </div>
            <Switch checked={isPinned} onCheckedChange={setIsPinned} />
          </div>

          {isAdmin && (
            <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
              <div>
                <Label className="text-sm">Share org-wide</Label>
                <p className="text-xs text-muted-foreground">
                  Visible to every agent in the org. Only admins can toggle this.
                </p>
              </div>
              <Switch checked={shareOrgWide} onCheckedChange={setShareOrgWide} />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={pending}>
              {pending ? 'Saving…' : editing ? 'Save changes' : 'Save smart list'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
