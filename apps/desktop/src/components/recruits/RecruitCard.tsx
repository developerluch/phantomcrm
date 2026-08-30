import { useDraggable } from '@dnd-kit/core'
import { IconPhone, IconMail, IconGripVertical, IconMessage, IconCalendar, IconChevronRight } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import type { Recruit } from '../../types/portal'

interface Props {
  recruit: Recruit
  onClick: () => void
  onMessage?: (recruit: Recruit) => void
  onSchedule?: (recruit: Recruit) => void
  onAdvance?: (recruit: Recruit) => void
}

function getUrgencyColor(recruit: Recruit): string {
  // Terminal stages: gray
  if (recruit.stage === 'ACTIVE' || recruit.stage === 'REJECTED') return '#6b7280'
  const daysSinceUpdate = (Date.now() - new Date(recruit.updatedAt).getTime()) / 86400000
  if (daysSinceUpdate < 1) return '#22c55e'  // Green: < 24h
  if (daysSinceUpdate < 3) return '#f59e0b'  // Yellow: 1-3 days
  return '#ef4444'                            // Red: > 3 days
}

export default function RecruitCard({ recruit, onClick, onMessage, onSchedule, onAdvance }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: recruit.id,
    data: { recruit },
  })

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 }
    : undefined

  const urgencyColor = getUrgencyColor(recruit)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-lg border border-border/40 p-2.5 cursor-pointer transition-all hover:border-border hover:bg-white/[0.02] ${
        isDragging ? 'opacity-50 shadow-2xl ring-1 ring-blue-500/30' : ''
      }`}
      onClick={onClick}
      {...attributes}
    >
      {/* Urgency left border */}
      <div
        className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full"
        style={{ backgroundColor: urgencyColor }}
      />

      <div className="flex items-center justify-between gap-1.5 pl-1.5">
        <p className="text-[13px] font-medium text-foreground truncate flex-1 min-w-0">
          {recruit.firstName} {recruit.lastName}
        </p>
        {recruit.leadSource === 'facebook_ads' && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 border-blue-400/30 text-blue-400 h-4">Ad</Badge>
        )}
        {recruit.leadSource === 'in_person' && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-400/30 text-amber-400 h-4">IRL</Badge>
        )}
        {recruit.leadSource === 'referral' && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 border-purple-400/30 text-purple-400 h-4">Ref</Badge>
        )}
        {recruit.leadSource === 'website_form' && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 border-lime-400/30 text-lime-400 h-4">Web</Badge>
        )}
        <div className="flex items-center gap-0.5">
          {/* Quick actions on hover */}
          <div className="hidden group-hover:flex items-center gap-0.5">
            {recruit.phone && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => { e.stopPropagation(); onMessage?.(recruit) }}
                    className="h-6 w-6 text-muted-foreground/60 hover:text-blue-400 hover:bg-blue-400/10"
                  >
                    <IconMessage size={12} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Message</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => { e.stopPropagation(); onSchedule?.(recruit) }}
                  className="h-6 w-6 text-muted-foreground/60 hover:text-purple-400 hover:bg-purple-400/10"
                >
                  <IconCalendar size={12} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Schedule</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => { e.stopPropagation(); onAdvance?.(recruit) }}
                  className="h-6 w-6 text-muted-foreground/60 hover:text-green-400 hover:bg-green-400/10"
                >
                  <IconChevronRight size={12} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Advance stage</TooltipContent>
            </Tooltip>
          </div>
          <Button
            variant="ghost"
            size="icon"
            {...listeners}
            className="h-6 w-6 text-muted-foreground/0 group-hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <IconGripVertical size={13} />
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-1 pl-1.5">
        {recruit.source && (
          <span className="text-[10px] text-muted-foreground truncate">{recruit.source}</span>
        )}
        <span className="flex items-center gap-1 ml-auto shrink-0">
          {recruit.phone && (
            <span className="text-muted-foreground/60">
              <IconPhone size={11} />
            </span>
          )}
          {recruit.email && (
            <span className="text-muted-foreground/60">
              <IconMail size={11} />
            </span>
          )}
        </span>
        {recruit.stage === 'IN_COURSE' && (() => {
          const enrolledDate = recruit.courseEnrolledDate ? new Date(recruit.courseEnrolledDate) : new Date(recruit.updatedAt)
          const daysRemaining = Math.max(0, 30 - Math.floor((Date.now() - enrolledDate.getTime()) / 86400000))
          return (
            <span className={`text-[9px] font-mono ${daysRemaining <= 7 ? 'text-red-400' : 'text-muted-foreground'}`}>
              {daysRemaining}d left
            </span>
          )
        })()}
        <span className="text-[10px] text-muted-foreground/50 shrink-0">
          {new Date(recruit.createdAt).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
        </span>
      </div>
    </div>
  )
}
