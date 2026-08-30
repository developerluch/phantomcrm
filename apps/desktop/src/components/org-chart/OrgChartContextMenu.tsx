import { useRef, useEffect } from 'react'
import {
  IconUser,
  IconUnlink,
  IconArrowsTransferDown,
  IconCoin,
  IconFlag,
  IconShieldCheck,
} from '@tabler/icons-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { STAGE_NAMES, STAGE_COLORS } from '../../types/agent'
import type { OrgChartNode, CompTierWithAgents } from '../../types/portal'

interface OrgChartContextMenuProps {
  agent: OrgChartNode | null
  position: { x: number; y: number } | null
  onClose: () => void
  onViewProfile: (agent: OrgChartNode) => void
  onDetach: (agent: OrgChartNode) => void
  onAssignManager: (agent: OrgChartNode, managerId: string) => void
  onChangeCompTier: (agent: OrgChartNode, tierId: string | null) => void
  onChangeStage: (agent: OrgChartNode, stageNum: number) => void
  onVerify: (agent: OrgChartNode) => void
  allAgents: OrgChartNode[]
  compTiers: CompTierWithAgents[]
}

export function OrgChartContextMenu({
  agent,
  position,
  onClose,
  onViewProfile,
  onDetach,
  onAssignManager,
  onChangeCompTier,
  onChangeStage,
  onVerify,
  allAgents,
  compTiers,
}: OrgChartContextMenuProps) {
  const triggerRef = useRef<HTMLDivElement>(null)

  // Position the invisible trigger at cursor coordinates
  useEffect(() => {
    if (triggerRef.current && position) {
      triggerRef.current.style.top = `${position.y}px`
      triggerRef.current.style.left = `${position.x}px`
    }
  }, [position])

  if (!agent || !position) return null

  const otherAgents = allAgents.filter((a) => a.id !== agent.id)

  return (
    <>
      {/* Invisible anchor positioned at cursor */}
      <div ref={triggerRef} className="fixed w-0 h-0 pointer-events-none" style={{ top: position.y, left: position.x }} />

      <DropdownMenu open={!!agent} onOpenChange={(open) => { if (!open) onClose() }}>
        <DropdownMenuContent
          className="w-56 bg-card/95 backdrop-blur-md"
          style={{ position: 'fixed', top: position.y, left: position.x }}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuLabel className="truncate">
            {agent.firstName} {agent.lastName}
            <span className="block text-xs font-normal text-muted-foreground">{agent.stage?.name ?? 'Unknown stage'}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => onViewProfile(agent)}>
            <IconUser size={14} className="mr-2" />
            View Profile
          </DropdownMenuItem>

          {agent.profile?.managerId && (
            <DropdownMenuItem onClick={() => onDetach(agent)}>
              <IconUnlink size={14} className="mr-2" />
              Detach
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {/* Assign Manager */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <IconArrowsTransferDown size={14} className="mr-2" />
              Assign Manager
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-64 overflow-y-auto bg-card/95 backdrop-blur-md">
              {otherAgents.length === 0 ? (
                <DropdownMenuItem disabled>No other agents available</DropdownMenuItem>
              ) : (
                otherAgents.map((a) => (
                  <DropdownMenuItem key={a.id} onClick={() => onAssignManager(agent, a.id)}>
                    {a.firstName} {a.lastName}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Change Comp Tier */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <IconCoin size={14} className="mr-2" />
              Change Comp Tier
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-card/95 backdrop-blur-md">
              <DropdownMenuItem onClick={() => onChangeCompTier(agent, null)}>
                <span className="text-muted-foreground">None</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {compTiers.map((tier) => (
                <DropdownMenuItem key={tier.id} onClick={() => onChangeCompTier(agent, tier.id)}>
                  {tier.name}
                  <span className="ml-auto text-xs text-blue-400">{tier.percentage}%</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Change Stage */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <IconFlag size={14} className="mr-2" />
              Change Stage
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="bg-card/95 backdrop-blur-md">
              {Object.entries(STAGE_NAMES).map(([stageNum, stageName]) => (
                <DropdownMenuItem key={stageNum} onClick={() => onChangeStage(agent, Number(stageNum))}>
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full mr-2"
                    style={{ backgroundColor: STAGE_COLORS[Number(stageNum)] }}
                  />
                  {stageName}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => onVerify(agent)}>
            <IconShieldCheck size={14} className="mr-2" />
            Verify License
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
