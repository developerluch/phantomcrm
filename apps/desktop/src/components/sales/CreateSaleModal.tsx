import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { IconReceipt } from '@tabler/icons-react'
import CreateSaleWizardForm from './CreateSaleWizardForm'

interface Props {
  open: boolean
  onClose: () => void
}

export default function CreateSaleModal({ open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-green-500/10 border border-green-500/20">
              <IconReceipt size={20} className="text-green-400" />
            </div>
            <div>
              <DialogTitle>New Sale</DialogTitle>
              <DialogDescription>Record a new policy sale</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <CreateSaleWizardForm onSuccess={onClose} onCancel={onClose} />
      </DialogContent>
    </Dialog>
  )
}
