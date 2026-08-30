import type { OrgChartNode } from '../../types/portal'

export interface AgentNodeData {
  agent: OrgChartNode
  isManager?: boolean
  isValidTarget?: boolean
  isDragTarget?: boolean
  [key: string]: unknown
}

export interface ContextMenuState {
  x: number
  y: number
  agent: OrgChartNode
  openSubmenu?: string | null
}
