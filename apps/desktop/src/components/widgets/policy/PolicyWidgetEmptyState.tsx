import { useState } from 'react'
import { IconInfoCircle } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface PolicyWidgetEmptyStateProps {
  title: string
  description: string
  learnTitle: string
  learnBody: string
}

export default function PolicyWidgetEmptyState({
  title,
  description,
  learnTitle,
  learnBody,
}: PolicyWidgetEmptyStateProps) {
  const [learnOpen, setLearnOpen] = useState(false)

  return (
    <>
      <div className="flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-muted/10 px-4 py-6 text-center">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background/70 text-muted-foreground">
          <IconInfoCircle size={18} />
        </div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>
        <Button variant="ghost" size="sm" className="mt-3 h-8 text-xs" onClick={() => setLearnOpen(true)}>
          Learn More
        </Button>
      </div>

      <Dialog open={learnOpen} onOpenChange={setLearnOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{learnTitle}</DialogTitle>
            <DialogDescription>{learnBody}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  )
}
