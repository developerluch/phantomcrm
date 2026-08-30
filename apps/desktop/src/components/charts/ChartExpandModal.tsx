import { IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ReactNode } from 'react'

interface ChartExpandModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export default function ChartExpandModal({ open, onClose, title, children }: ChartExpandModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        className="max-w-[95vw] w-[1200px] h-[95vh] flex flex-col p-0 border-white/10 overflow-hidden"
        style={{
          background: 'rgba(15, 15, 20, 0.92)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px hsl(var(--border) / 0.3)',
        }}
      >
        <DialogHeader className="shrink-0 flex flex-row items-center justify-between px-6 py-4 border-b border-white/5 space-y-0 text-left">
          <DialogTitle className="text-sm font-bold text-foreground uppercase tracking-wider">
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Chart area — fills remaining space */}
        <div className="flex-1 p-6 overflow-hidden">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  )
}
