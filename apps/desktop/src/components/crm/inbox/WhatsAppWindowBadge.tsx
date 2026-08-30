import { useEffect, useState } from 'react'
import { IconClockHour4 } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface WhatsAppWindowBadgeProps {
  expiresAt: string | undefined
}

/** Countdown chip for the WhatsApp 24h customer-care window. Re-renders
 *  every 30s to update the remaining-time string. Color thresholds:
 *    > 12h  → green
 *    2-12h  → amber
 *    < 2h   → red
 *  Closed window (nil or past) → outlined "Template required". */
export function WhatsAppWindowBadge({ expiresAt }: WhatsAppWindowBadgeProps) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const expiresMs = expiresAt ? new Date(expiresAt).getTime() : null
  if (!expiresMs || expiresMs <= now) {
    return (
      <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
        <IconClockHour4 size={12} />
        WA window closed — template required
      </Badge>
    )
  }

  const remainingMs = expiresMs - now
  const hours = Math.floor(remainingMs / 3_600_000)
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000)
  const tone =
    remainingMs < 2 * 3_600_000
      ? 'bg-destructive/30 text-destructive-foreground border-destructive/40'
      : remainingMs < 12 * 3_600_000
        ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
        : 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'

  return (
    <Badge variant="outline" className={cn('gap-1 text-xs', tone)}>
      <IconClockHour4 size={12} />
      WA {hours}h {minutes.toString().padStart(2, '0')}m
    </Badge>
  )
}
