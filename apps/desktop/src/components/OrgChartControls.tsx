import { useReactFlow } from '@xyflow/react'
import { IconPlus, IconMinus, IconMaximize, IconRefresh } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

interface Props {
  onResetLayout: () => void
  resetting?: boolean
}

export default function OrgChartControls({ onResetLayout, resetting }: Props) {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  return (
    <div className="absolute bottom-4 right-4 z-10 flex flex-col gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-muted/90 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50"
            onClick={() => zoomIn({ duration: 200 })}
          >
            <IconPlus size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Zoom in</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-muted/90 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50"
            onClick={() => zoomOut({ duration: 200 })}
          >
            <IconMinus size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Zoom out</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-muted/90 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50"
            onClick={() => fitView({ padding: 0.2, duration: 300 })}
          >
            <IconMaximize size={16} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Fit view</TooltipContent>
      </Tooltip>
      <Separator className="mx-1" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 bg-muted/90 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50"
            onClick={onResetLayout}
            disabled={resetting}
          >
            <IconRefresh size={16} className={resetting ? 'animate-spin' : ''} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left">Reset layout</TooltipContent>
      </Tooltip>
    </div>
  )
}
