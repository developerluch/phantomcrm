import {
  IconAlertCircle,
  IconCheck,
  IconChecks,
  IconClock,
  IconX,
} from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { MessageStatus } from '@/types/portal'

interface MessageStatusBadgeProps {
  status: MessageStatus
  errorCode?: string
  errorMessage?: string
}

type Spec = {
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  Icon: typeof IconCheck
  label: string
  iconClassName?: string
  isError?: boolean
}

const STATUS_SPEC: Partial<Record<MessageStatus, Spec>> = {
  queued: {
    variant: 'outline',
    Icon: IconClock,
    label: 'Queued',
    iconClassName: 'animate-pulse text-muted-foreground',
  },
  sent: {
    variant: 'outline',
    Icon: IconCheck,
    label: 'Sent',
  },
  delivered: {
    variant: 'default',
    Icon: IconCheck,
    label: 'Delivered',
  },
  read: {
    variant: 'default',
    Icon: IconChecks,
    label: 'Read',
  },
  delivery_failed: {
    variant: 'destructive',
    Icon: IconAlertCircle,
    label: 'Failed to deliver',
    isError: true,
  },
  failed: {
    variant: 'destructive',
    Icon: IconX,
    label: 'Failed',
    isError: true,
  },
}

function tooltipText(errorCode?: string, errorMessage?: string): string | null {
  if (errorCode && errorMessage) return `${errorCode}: ${errorMessage}`
  if (errorCode) return errorCode
  if (errorMessage) return errorMessage
  return null
}

export function MessageStatusBadge({
  status,
  errorCode,
  errorMessage,
}: MessageStatusBadgeProps) {
  const spec = STATUS_SPEC[status]
  if (!spec) return null

  const { variant, Icon, label, iconClassName, isError } = spec
  const tooltip = isError ? tooltipText(errorCode, errorMessage) : null

  const badge = (
    <Badge
      variant={variant}
      className="h-5 gap-1 px-1.5 py-0 text-[10px] font-medium"
    >
      <Icon size={12} className={cn(iconClassName)} />
      {label}
    </Badge>
  )

  if (!tooltip) return badge

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
