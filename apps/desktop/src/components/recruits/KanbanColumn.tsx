import { useDroppable } from '@dnd-kit/core'
import { IconArrowsMaximize } from '@tabler/icons-react'
import type { Recruit, RecruitStage } from '../../types/portal'
import { RECRUIT_STAGE_COLORS, RECRUIT_STAGE_LABELS } from '../../types/portal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import RecruitCard from './RecruitCard'

interface Props {
  stage: RecruitStage
  recruits: Recruit[]
  onCardClick: (recruit: Recruit) => void
  onAdvance?: (recruit: Recruit) => void
  onExpand?: (stage: RecruitStage) => void
}

export default function KanbanColumn({ stage, recruits, onCardClick, onAdvance, onExpand }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const color = RECRUIT_STAGE_COLORS[stage]

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[180px] flex-1 self-stretch rounded-xl border transition-colors overflow-hidden ${
        isOver ? 'border-blue-500/50 bg-blue-500/5' : 'border-border bg-card/50'
      }`}
    >
      {/* Color accent bar */}
      <div className="h-0.5 w-full" style={{ background: color }} />

      {/* Header */}
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-border/30">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-xs font-semibold text-foreground truncate">
            {RECRUIT_STAGE_LABELS[stage]}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge
            className="text-[10px] font-bold px-1.5 py-0.5"
            style={{ background: `${color}20`, color }}
          >
            {recruits.length}
          </Badge>
          {recruits.length > 0 && onExpand && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onExpand(stage)}
                  className="h-5 w-5 text-muted-foreground/50 hover:text-foreground"
                >
                  <IconArrowsMaximize size={11} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Expand column</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 px-2 py-2 space-y-1.5 overflow-y-auto min-h-[80px]">
        {recruits.map((recruit) => (
          <RecruitCard
            key={recruit.id}
            recruit={recruit}
            onClick={() => onCardClick(recruit)}
            onAdvance={onAdvance}
          />
        ))}
        {recruits.length === 0 && (
          <div className="flex items-center justify-center h-full min-h-[80px] text-muted-foreground text-[11px]">
            No recruits
          </div>
        )}
      </div>
    </div>
  )
}
