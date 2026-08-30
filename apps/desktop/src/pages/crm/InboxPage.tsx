import { useParams, useNavigate } from 'react-router-dom'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { ThreadListPanel } from '@/components/crm/inbox/ThreadListPanel'
import { ConversationView } from '@/components/crm/inbox/ConversationView'
import { ContextPanel } from '@/components/crm/inbox/ContextPanel'

/**
 * /crm/inbox — unified Conversations Inbox.
 *
 * Layout: 3 horizontal resizable panels:
 *   1. ThreadListPanel — filters + virtualized thread list
 *   2. ConversationView — toolbar + message scroll + Composer
 *   3. ContextPanel — collapsible contact context Accordion
 *
 * Filter / sort / search state lives inside ThreadListPanel.
 * Selected thread lives in the URL (`/crm/inbox/:threadId`) so deep-links
 * from the ContactDetailDrawer "Conversations" tab can land on a specific
 * thread.
 */
export default function InboxPage() {
  const { threadId } = useParams<{ threadId?: string }>()
  const navigate = useNavigate()

  const handleSelectThread = (id: string) => {
    navigate(`/crm/inbox/${encodeURIComponent(id)}`)
  }

  return (
    <div className="h-full w-full overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        <ResizablePanel defaultSize={22} minSize={18} maxSize={35}>
          <ThreadListPanel selectedId={threadId} onSelect={handleSelectThread} />
        </ResizablePanel>
        <ResizableHandle />

        <ResizablePanel defaultSize={53} minSize={35}>
          <div className="flex h-full flex-col bg-background">
            <ConversationView threadId={threadId} />
          </div>
        </ResizablePanel>
        <ResizableHandle />

        <ResizablePanel
          defaultSize={25}
          minSize={20}
          maxSize={35}
          collapsible
          collapsedSize={0}
        >
          <ContextPanel threadId={threadId} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
