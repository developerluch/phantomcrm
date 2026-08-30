import {
  IconPlus,
  IconLock,
  IconLockOpen,
  IconFocus2,
  IconUsers,
  IconUsersGroup,
  IconRefresh,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

interface OrgChartToolbarProps {
  agentCount: number
  viewMode: 'my-team' | 'all'
  onViewModeChange: (mode: 'my-team' | 'all') => void
  lockLayout: boolean
  onToggleLock: () => void
  onCenterOnMe: () => void
  onResync: () => void
  onAddAgent: () => void
  showCenterButton: boolean
}

export function OrgChartToolbar({
  agentCount,
  viewMode,
  onViewModeChange,
  lockLayout,
  onToggleLock,
  onCenterOnMe,
  onResync,
  onAddAgent,
  showCenterButton,
}: OrgChartToolbarProps) {
  return (
    <div className="flex items-center justify-between px-6 py-3 border-b border-border/30 z-10">
      <div className="flex items-center gap-4">
        <Tabs value={viewMode} onValueChange={(v) => onViewModeChange(v as 'my-team' | 'all')}>
          <TabsList>
            <TabsTrigger value="my-team" className="gap-1.5">
              <IconUsers size={14} />
              My Team
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-1.5">
              <IconUsersGroup size={14} />
              All
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="flex items-center gap-2">
        {showCenterButton && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onCenterOnMe}
              >
                <IconFocus2 size={16} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Center on Me</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleLock}
            >
              {lockLayout ? <IconLock size={16} /> : <IconLockOpen size={16} />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{lockLayout ? 'Unlock layout' : 'Lock layout'}</TooltipContent>
        </Tooltip>
        <Button variant="outline" size="sm" onClick={onResync}>
          <IconRefresh size={14} className="mr-1" /> Re-Sync Discord
        </Button>
        <Button variant="outline" size="sm" onClick={onAddAgent}>
          <IconPlus size={16} /> Add Agent
        </Button>
      </div>
    </div>
  )
}
