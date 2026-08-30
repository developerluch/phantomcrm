import { Card } from '@/components/ui/card'
import { ContactContextPanel } from './ContactContextPanel'

interface ContextPanelProps {
  threadId: string | undefined
}

// Placeholder: rebuilt in commit F with shadcn Accordion sections.
// Chrome matches the prior 4-panel layout's last column.
export function ContextPanel({ threadId }: ContextPanelProps) {
  return (
    <Card className="h-full rounded-none border-0 border-l border-border/50 bg-card/30 p-3 backdrop-blur">
      <ContactContextPanel threadId={threadId} />
    </Card>
  )
}
