import { useNavigate } from 'react-router-dom'
import {
  IconExternalLink,
  IconPhone,
  IconMail,
} from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useContact } from '@/hooks/useContacts'
import { useConversation } from '@/hooks/useConversation'

interface ContactContextPanelProps {
  threadId: string | undefined
}

/** Right-side mini contact card for the current thread. Renders contact
 *  basics + tags + lifecycle, with an "Open full profile" deep-link to the
 *  contact detail page and a disabled click-to-call placeholder (Voice
 *  channel ships in M2C). */
export function ContactContextPanel({ threadId }: ContactContextPanelProps) {
  const navigate = useNavigate()
  const { data: detail } = useConversation(threadId)
  const contactId = detail?.conversation.contactId
  const { data: contact, isLoading } = useContact(contactId)

  if (!threadId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No thread selected
      </div>
    )
  }

  if (isLoading || !contact) {
    return (
      <div className="flex h-full flex-col gap-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    )
  }

  const initials = contact.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <div className="flex h-full flex-col gap-3 text-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card/60 text-base font-semibold">
          {initials || '?'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">
            {contact.fullName || 'Unknown'}
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-xs capitalize">
              {contact.lifecycleStage}
            </Badge>
            {contact.status !== 'active' && (
              <Badge variant="outline" className="text-xs capitalize">
                {contact.status}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        {contact.phone && (
          <ContactRow icon={<IconPhone size={14} />} label="Phone" value={contact.phone}>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" disabled className="h-7 w-7">
                    <IconPhone size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Click-to-call ships in M2C</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </ContactRow>
        )}
        {contact.email && (
          <ContactRow icon={<IconMail size={14} />} label="Email" value={contact.email} />
        )}
      </div>

      {contact.tags.length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tags
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {contact.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="mt-auto pt-3">
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => navigate(`/crm/contacts/${encodeURIComponent(contact.id)}`)}
        >
          <IconExternalLink size={14} />
          Open full profile
        </Button>
      </div>
    </div>
  )
}

function ContactRow({
  icon,
  label,
  value,
  children,
}: {
  icon: React.ReactNode
  label: string
  value: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-card/60 text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-sm">{value}</div>
      </div>
      {children}
    </div>
  )
}
