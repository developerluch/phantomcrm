import { useEffect, useState } from 'react'
import { IconAlertTriangle } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useLayoutStore } from '@/store/layout-store'
import { usePolicyLayoutStore } from '@/store/policy-layout-store'

export default function CloseConfirmDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!window.electronAPI?.onConfirmClose) return
    const unsubscribe = window.electronAPI.onConfirmClose(() => {
      const dashboardEditing = useLayoutStore.getState().isEditing
      const policyEditing = usePolicyLayoutStore.getState().isEditing
      if (!dashboardEditing && !policyEditing) {
        window.electronAPI?.respondToCloseConfirm(true)
        return
      }
      setOpen(true)
    })
    return unsubscribe
  }, [])

  const handleDiscardAndClose = () => {
    useLayoutStore.getState().setEditing(false)
    usePolicyLayoutStore.getState().setEditing(false)
    setOpen(false)
    window.electronAPI?.respondToCloseConfirm(true)
  }

  const handleKeepEditing = () => {
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleKeepEditing()
      }}
    >
      <DialogContent className="bg-card/95 backdrop-blur-xl border-border/60 max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg bg-destructive/10 text-destructive p-2">
              <IconAlertTriangle size={20} />
            </div>
            <div>
              <DialogTitle>Discard layout changes?</DialogTitle>
              <DialogDescription>
                You have unsaved layout edits. Closing will discard them.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="pt-2">
          <Button type="button" variant="ghost" onClick={handleKeepEditing}>
            Keep editing
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDiscardAndClose}
          >
            Discard &amp; close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
