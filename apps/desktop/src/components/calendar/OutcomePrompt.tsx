import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { IconCircleCheck, IconUserOff, IconCalendarEvent } from '@tabler/icons-react'
import { OUTCOME_OPTIONS } from './constants'
import type { CalendarEvent } from './constants'

interface OutcomePromptProps {
  event: CalendarEvent
  onOutcome: (eventId: string, outcome: string) => void
}

const ICONS: Record<string, typeof IconCircleCheck> = {
  completed: IconCircleCheck,
  no_show: IconUserOff,
  rescheduled: IconCalendarEvent,
}

export default function OutcomePrompt({ event, onOutcome }: OutcomePromptProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-1.5 mt-1.5"
    >
      <span className="text-[9px] text-muted-foreground/50 mr-1">Outcome:</span>
      {OUTCOME_OPTIONS.map((opt) => {
        const Icon = ICONS[opt.value] ?? IconCircleCheck
        return (
          <Button
            key={opt.value}
            variant="ghost"
            size="sm"
            className="h-5 text-[9px] px-1.5 gap-1"
            style={{ color: opt.color }}
            onClick={(e) => {
              e.stopPropagation()
              onOutcome(event.id, opt.value)
            }}
          >
            <Icon size={10} />
            {opt.label}
          </Button>
        )
      })}
    </motion.div>
  )
}
