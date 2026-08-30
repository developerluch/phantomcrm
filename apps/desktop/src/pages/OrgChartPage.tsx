import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
  type NodeMouseHandler,
  type OnConnectStartParams,
} from '@xyflow/react'
import dagre from '@dagrejs/dagre'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOrgChart, useMyTeam, useAssignManager, useSavePositions } from '../hooks/useOrgChart'
import { useWebSocketContext } from '../contexts/WebSocketContext'
import { toast } from 'sonner'
import { IconHierarchy, IconPlus } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import AddAgentModal from '../components/AddAgentModal'
import AgentProfilePanel from '../components/AgentProfilePanel'
import EnergyEdge from '../components/EnergyEdge'
import { AgentNode } from '../components/org-chart/AgentNode'
import { OrgChartToolbar } from '../components/org-chart/OrgChartToolbar'
import { OrgChartContextMenu } from '../components/org-chart/OrgChartContextMenu'
import {
  NODE_WIDTH, NODE_HEIGHT, MANAGER_NODE_WIDTH, MANAGER_NODE_HEIGHT,
  ORPHAN_GAP_X, ORPHAN_GAP_Y, SAVE_DEBOUNCE_MS,
} from '../components/org-chart/constants'
import type { ContextMenuState } from '../components/org-chart/types'
import type { OrgChartNode, CompTierWithAgents } from '../types/portal'
import { api } from '../services/api'
import { useAuthStore } from '../store/index'

// ── Layout helper ──────────────────────────────────────────────────────────

function getLayoutedElements(
  agents: OrgChartNode[],
  managerIds: Set<string>,
  reportCounts: Map<string, number>,
) {
  const nodes: Node[] = []
  const edges: Edge[] = []

  const hierarchyAgents: OrgChartNode[] = []
  const orphanAgents: OrgChartNode[] = []

  for (const agent of agents) {
    const hasManager = !!agent.profile?.managerId
    const isManager = managerIds.has(agent.id)
    if (hasManager || isManager) {
      hierarchyAgents.push(agent)
    } else {
      orphanAgents.push(agent)
    }
  }

  // Part 1: dagre layout for hierarchy nodes
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 160 })

  for (const agent of hierarchyAgents) {
    const isManager = managerIds.has(agent.id)
    const w = isManager ? MANAGER_NODE_WIDTH : NODE_WIDTH
    const h = isManager ? MANAGER_NODE_HEIGHT : NODE_HEIGHT

    g.setNode(agent.id, { width: w, height: h })

    if (agent.profile?.managerId) {
      g.setEdge(agent.profile.managerId, agent.id)
      edges.push({
        id: `${agent.profile.managerId}-${agent.id}`,
        source: agent.profile.managerId,
        target: agent.id,
        type: 'energy',
        data: { directReports: reportCounts.get(agent.profile.managerId) ?? 1 },
      })
    }
  }

  dagre.layout(g)

  let hierarchyMaxY = 0

  for (const agent of hierarchyAgents) {
    const hasSavedPos =
      agent.profile?.positionX != null && agent.profile?.positionY != null
    const isManager = managerIds.has(agent.id)
    const w = isManager ? MANAGER_NODE_WIDTH : NODE_WIDTH
    const h = isManager ? MANAGER_NODE_HEIGHT : NODE_HEIGHT

    let position: { x: number; y: number }
    if (hasSavedPos) {
      position = { x: agent.profile!.positionX!, y: agent.profile!.positionY! }
    } else {
      const pos = g.node(agent.id)
      position = pos
        ? { x: pos.x - w / 2, y: pos.y - h / 2 }
        : { x: 0, y: 0 }
    }

    hierarchyMaxY = Math.max(hierarchyMaxY, position.y + h)
    nodes.push({
      id: agent.id,
      type: 'agent',
      position,
      data: { agent, isManager, isValidTarget: false },
    })
  }

  // Part 2: grid layout for orphan nodes
  const ORPHAN_COLS = Math.min(Math.max(Math.ceil(Math.sqrt(orphanAgents.length)), 3), 8)

  const orphanStartY = hierarchyAgents.length > 0
    ? hierarchyMaxY + 120
    : 0

  const totalGridWidth =
    ORPHAN_COLS * NODE_WIDTH + (ORPHAN_COLS - 1) * ORPHAN_GAP_X
  const gridOffsetX = hierarchyAgents.length > 0
    ? (() => {
      const xs = nodes.map((n) => n.position.x + NODE_WIDTH / 2)
      const centerX = xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
      return centerX - totalGridWidth / 2
    })()
    : 0

  if (orphanAgents.length > 0 && hierarchyAgents.length > 0) {
    nodes.push({
      id: '__orphan-label__',
      type: 'default',
      position: { x: gridOffsetX, y: orphanStartY - 50 },
      data: { label: 'Unassigned Agents' },
      selectable: false,
      draggable: false,
      style: {
        background: 'transparent',
        border: 'none',
        color: '#64748b',
        fontSize: '14px',
        fontWeight: '600',
        width: 'auto',
      },
    })
  }

  for (let i = 0; i < orphanAgents.length; i++) {
    const agent = orphanAgents[i]
    const hasSavedPos =
      agent.profile?.positionX != null && agent.profile?.positionY != null

    const col = i % ORPHAN_COLS
    const row = Math.floor(i / ORPHAN_COLS)
    const gridX = gridOffsetX + col * (NODE_WIDTH + ORPHAN_GAP_X)
    const gridY = orphanStartY + row * (NODE_HEIGHT + ORPHAN_GAP_Y)

    nodes.push({
      id: agent.id,
      type: 'agent',
      position: hasSavedPos
        ? { x: agent.profile!.positionX!, y: agent.profile!.positionY! }
        : { x: gridX, y: gridY },
      data: { agent, isManager: false, isValidTarget: false },
    })
  }

  return { nodes, edges }
}

// ── Downline filter ────────────────────────────────────────────────────────

/** Given all agents, return only the root agent + all recursive downlines */
function getDownlineTree(allAgents: OrgChartNode[], rootId: string): OrgChartNode[] {
  const result: OrgChartNode[] = []
  const visited = new Set<string>()

  const rootAgent = allAgents.find((a) => a.id === rootId)
  if (rootAgent) {
    result.push(rootAgent)
    visited.add(rootId)
  }

  const queue = [rootId]
  while (queue.length > 0) {
    const currentId = queue.shift()!
    for (const agent of allAgents) {
      if (agent.profile?.managerId === currentId && !visited.has(agent.id)) {
        result.push(agent)
        visited.add(agent.id)
        queue.push(agent.id)
      }
    }
  }

  return result
}

// ── Custom types registration ──────────────────────────────────────────────

const nodeTypes = { agent: AgentNode }
const edgeTypes = { energy: EnergyEdge }

// ── Main component ──────────────────────────────────────────────────────────

export default function OrgChartPage() {
  return (
    <ReactFlowProvider>
      <OrgChartPageInner />
    </ReactFlowProvider>
  )
}

function OrgChartPageInner() {
  const queryClient = useQueryClient()
  const { data: allAgents, isLoading: allLoading, isError: allError } = useOrgChart()
  const { data: myTeamAgents, isLoading: myTeamLoading } = useMyTeam()
  const { data: compTiers = [] } = useQuery<CompTierWithAgents[]>({
    queryKey: ['comp-tiers'],
    queryFn: () => api.getCompTiers(),
  })
  const assignManager = useAssignManager()
  const savePositions = useSavePositions()
  const { subscribe } = useWebSocketContext()
  const authUser = useAuthStore((s) => s.user)

  const { getIntersectingNodes, setCenter } = useReactFlow()

  const [viewMode, setViewMode] = useState<'my-team' | 'all'>('my-team')
  const [showAddAgent, setShowAddAgent] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<OrgChartNode | null>(null)
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [dragOverNodeId, setDragOverNodeId] = useState<string | null>(null)
  const [lockLayout, setLockLayout] = useState(false)
  const [showResyncDialog, setShowResyncDialog] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isResyncing, setIsResyncing] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>()

  // Select data source based on view mode
  const agents = useMemo(() => {
    if (!allAgents) return undefined

    // "My Team" — direct reports only (backend already filters this)
    if (viewMode === 'my-team' && myTeamAgents) {
      return myTeamAgents
    }

    // "All" — show only the user + their entire recursive downline tree
    if (authUser?.discordId) {
      return getDownlineTree(allAgents, authUser.discordId)
    }

    // Fallback if no auth user
    return allAgents
  }, [viewMode, allAgents, myTeamAgents, authUser?.discordId])
  const isLoading = viewMode === 'my-team' ? (myTeamLoading && allLoading) : allLoading
  const isError = allError

  // Close context menu on any click
  useEffect(() => {
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  // WebSocket: invalidate on real-time events with toast notifications
  useEffect(() => {
    const unsubs = [
      subscribe('agent_created', (data) => {
        queryClient.invalidateQueries({ queryKey: ['org-chart'] })
        const d = data as { firstName?: string; lastName?: string }
        if (d?.firstName) toast.success(`New agent joined: ${d.firstName} ${d.lastName ?? ''}`)
      }),
      subscribe('stage_changed', (data) => {
        queryClient.invalidateQueries({ queryKey: ['org-chart'] })
        const d = data as { firstName?: string; lastName?: string; stage?: string }
        if (d?.firstName) toast.info(`${d.firstName} ${d.lastName ?? ''} → ${d.stage ?? 'new stage'}`)
      }),
      subscribe('license_verified', (data) => {
        queryClient.invalidateQueries({ queryKey: ['org-chart'] })
        const d = data as { firstName?: string; lastName?: string; npn?: string }
        if (d?.firstName) toast.success(`License verified: ${d.firstName} ${d.lastName ?? ''} (NPN: ${d.npn ?? '—'})`)
      }),
      subscribe('sale_submitted', (data) => {
        queryClient.invalidateQueries({ queryKey: ['org-chart'] })
        const d = data as { firstName?: string; lastName?: string; amount?: number; product?: string }
        if (d?.firstName) {
          const amt = d.amount ? ` — $${d.amount.toLocaleString()}` : ''
          const prod = d.product ? ` (${d.product})` : ''
          toast.success(`New sale! ${d.firstName} ${d.lastName ?? ''} just submitted a sale${prod}${amt}`, { duration: 6000 })
        }
      }),
      subscribe('manager_assigned', (data) => {
        queryClient.invalidateQueries({ queryKey: ['org-chart'] })
        const d = data as { agentName?: string; managerName?: string }
        if (d?.agentName) toast.info(`${d.agentName} assigned to ${d.managerName ?? 'a manager'}`)
      }),
      subscribe('bulk_import', (data) => {
        queryClient.invalidateQueries({ queryKey: ['org-chart'] })
        const d = data as { imported?: number }
        if (d?.imported) toast.success(`Bulk import: ${d.imported} new agents imported`)
      }),
    ]
    return () => unsubs.forEach((u) => u())
  }, [subscribe, queryClient])

  // Derived data: manager IDs and report counts
  const { managerIds, reportCounts } = useMemo(() => {
    const ids = new Set<string>()
    const counts = new Map<string, number>()
    for (const agent of agents ?? []) {
      if (agent.profile?.managerId) {
        ids.add(agent.profile.managerId)
        counts.set(
          agent.profile.managerId,
          (counts.get(agent.profile.managerId) ?? 0) + 1,
        )
      }
    }
    return { managerIds: ids, reportCounts: counts }
  }, [agents])

  // Compute layout
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!agents) return { initialNodes: [], initialEdges: [] }
    const { nodes, edges } = getLayoutedElements(agents, managerIds, reportCounts)
    return { initialNodes: nodes, initialEdges: edges }
  }, [agents, managerIds, reportCounts])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Sync when data changes
  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  // Update valid targets when connecting
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isValidTarget: connectingFrom !== null && n.id !== connectingFrom,
        },
      })),
    )
  }, [connectingFrom, setNodes])

  // Update drag-over highlight on nodes
  useEffect(() => {
    if (dragOverNodeId !== null) {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: { ...n.data, isDragTarget: n.id === dragOverNodeId },
        })),
      )
    } else {
      setNodes((nds) =>
        nds.map((n) =>
          n.data.isDragTarget ? { ...n, data: { ...n.data, isDragTarget: false } } : n,
        ),
      )
    }
  }, [dragOverNodeId, setNodes])

  // Connection handlers
  const onConnectStart = useCallback(
    (_event: MouseEvent | TouchEvent, params: OnConnectStartParams) => {
      setConnectingFrom(params.nodeId ?? null)
    },
    [],
  )

  const onConnectEnd = useCallback(() => {
    setConnectingFrom(null)
  }, [])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return
      if (connection.source === connection.target) {
        toast.error('An agent cannot be their own manager')
        return
      }
      const sourceAgent = agents?.find((a) => a.id === connection.source)
      const targetAgent = agents?.find((a) => a.id === connection.target)
      const sourceName = sourceAgent ? `${sourceAgent.firstName} ${sourceAgent.lastName}`.trim() : 'Manager'
      const targetName = targetAgent ? `${targetAgent.firstName} ${targetAgent.lastName}`.trim() : 'Agent'

      assignManager.mutate(
        { agentId: connection.target, managerId: connection.source },
        {
          onSuccess: () => toast.success(`${sourceName} is now managing ${targetName}`),
          onError: (err) => {
            const msg = err instanceof Error ? err.message : ''
            if (msg.includes('409') || msg.includes('circular')) {
              toast.error('This would create a circular relationship')
            } else {
              toast.error(`Failed to assign manager: ${msg || 'unknown error'}`)
            }
          },
        },
      )
    },
    [assignManager, agents],
  )

  // Node click → profile panel
  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      const agent = agents?.find((a) => a.id === node.id)
      if (agent) setSelectedAgent(agent)
    },
    [agents],
  )

  // Right-click → context menu
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      const agent = agents?.find((a) => a.id === node.id)
      if (agent) {
        setContextMenu({ x: event.clientX, y: event.clientY, agent })
      }
    },
    [agents],
  )

  // Context menu action handlers
  const handleDetach = useCallback(
    async (agent: OrgChartNode) => {
      setContextMenu(null)
      try {
        await api.setManager(agent.id, null)
        toast.success('Manager removed')
        queryClient.invalidateQueries({ queryKey: ['org-chart'] })
      } catch {
        toast.error('Failed to remove manager')
      }
    },
    [queryClient],
  )

  const handleVerify = useCallback(
    async (agent: OrgChartNode) => {
      setContextMenu(null)
      try {
        const result = await api.verifyAgent(agent.id)
        if (result.verified) {
          toast.success(`License verified! NPN: ${result.npn}`)
          queryClient.invalidateQueries({ queryKey: ['org-chart'] })
          queryClient.invalidateQueries({ queryKey: ['sidebar-agent', agent.id] })
          queryClient.invalidateQueries({ queryKey: ['sidebar-licenses', agent.id] })
          queryClient.invalidateQueries({ queryKey: ['agents'] })
        } else {
          toast.error(result.error || 'License not found')
        }
      } catch {
        toast.error('Verification failed')
      }
    },
    [queryClient],
  )

  const handleAssignManager = useCallback(
    async (agent: OrgChartNode, managerId: string) => {
      setContextMenu(null)
      try {
        await api.assignManager(agent.id, managerId)
        toast.success('Manager assigned')
        queryClient.invalidateQueries({ queryKey: ['org-chart'] })
      } catch {
        toast.error('Failed to assign manager')
      }
    },
    [queryClient],
  )

  const handleChangeCompTier = useCallback(
    async (agent: OrgChartNode, tierId: string | null) => {
      setContextMenu(null)
      try {
        await api.setCompTierWithEmail(agent.id, tierId)
        toast.success('Comp tier updated')
        queryClient.invalidateQueries({ queryKey: ['org-chart'] })
      } catch {
        toast.error('Failed to change comp tier')
      }
    },
    [queryClient],
  )

  const handleChangeStage = useCallback(
    async (agent: OrgChartNode, stageNum: number) => {
      setContextMenu(null)
      try {
        await api.changeAgentStage(agent.id, String(stageNum))
        toast.success('Stage updated')
        queryClient.invalidateQueries({ queryKey: ['org-chart'] })
      } catch {
        toast.error('Failed to change stage')
      }
    },
    [queryClient],
  )

  const handleResync = async () => {
    setIsResyncing(true)
    try {
      const result = await api.bulkImportAgents()
      toast.success(`Synced! ${result.imported} new agents, ${result.skipped} already existed, ${result.bots} bots excluded`)
      queryClient.invalidateQueries({ queryKey: ['org-chart'] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      queryClient.invalidateQueries({ queryKey: ['sidebar-agent'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      setShowResyncDialog(false)
      setConfirmText('')
    } catch {
      toast.error('Re-sync failed. Please try again.')
    } finally {
      setIsResyncing(false)
    }
  }

  // Drag-to-drop: detect overlap with another node during drag
  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const intersecting = getIntersectingNodes(node)
      const target = intersecting.find(
        (n) => n.id !== node.id && n.id !== '__orphan-label__',
      )
      setDragOverNodeId(target?.id ?? null)
    },
    [getIntersectingNodes],
  )

  // Position persistence + drag-to-drop assignment
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, _node: Node, allNodes: Node[]) => {
      if (dragOverNodeId && dragOverNodeId !== _node.id) {
        const draggedAgent = agents?.find((a) => a.id === _node.id)
        const targetAgent = agents?.find((a) => a.id === dragOverNodeId)
        const draggedName = draggedAgent ? `${draggedAgent.firstName} ${draggedAgent.lastName}`.trim() : 'Agent'
        const targetName = targetAgent ? `${targetAgent.firstName} ${targetAgent.lastName}`.trim() : 'Manager'

        assignManager.mutate(
          { agentId: _node.id, managerId: dragOverNodeId },
          {
            onSuccess: () => toast.success(`${targetName} is now managing ${draggedName}`),
            onError: () => toast.error('Failed to assign manager'),
          },
        )
        setDragOverNodeId(null)
      } else {
        setDragOverNodeId(null)
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => {
          const positions = allNodes.map((n) => ({
            agentId: n.id,
            x: n.position.x,
            y: n.position.y,
          }))
          savePositions.mutate(positions)
        }, SAVE_DEBOUNCE_MS)
      }
    },
    [dragOverNodeId, agents, assignManager, savePositions],
  )

  const handleCenterOnMe = useCallback(() => {
    const myNode = nodes.find((n) => n.id === authUser?.discordId)
    if (myNode) {
      setCenter(myNode.position.x + NODE_WIDTH / 2, myNode.position.y + NODE_HEIGHT / 2, { zoom: 1, duration: 800 })
    } else {
      toast.info('Your node was not found in the current view')
    }
  }, [nodes, authUser?.discordId, setCenter])

  // Cleanup save timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center pt-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    )
  }

  if (isError || !agents || agents.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-end">
          <Button variant="outline" size="sm" onClick={() => setShowAddAgent(true)}>
            <IconPlus size={16} /> Add Agent
          </Button>
        </div>
        <div
          className="rounded-xl border border-border/50 p-12 text-center"
          style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}
        >
          <IconHierarchy size={48} className="mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-2">No agents found in the org chart.</p>
          <p className="text-sm text-muted-foreground">
            Make sure your server is running and your agents have profiles set up.
          </p>
        </div>
        <AddAgentModal open={showAddAgent} onClose={() => setShowAddAgent(false)} />
      </div>
    )
  }

  return (
    <div className="-mx-6 -mb-6 relative flex h-full min-h-0 flex-col pt-6">
      <OrgChartToolbar
        agentCount={agents.length}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        lockLayout={lockLayout}
        onToggleLock={() => setLockLayout((v) => !v)}
        onCenterOnMe={handleCenterOnMe}
        onResync={() => setShowResyncDialog(true)}
        onAddAgent={() => setShowAddAgent(true)}
        showCenterButton={!!authUser?.discordId}
      />

      {/* ReactFlow */}
      <div className="relative min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectStart={onConnectStart}
          onConnectEnd={onConnectEnd}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          nodesDraggable={!lockLayout}
          proOptions={{ hideAttribution: true }}
          fitView
          fitViewOptions={{
            padding: 0.3,
            maxZoom: 0.8,
            minZoom: 0.1,
          }}
          minZoom={0.1}
          maxZoom={2}
          style={{ background: 'hsl(var(--background))' }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1e293b" />
        </ReactFlow>

        <OrgChartContextMenu
          agent={contextMenu?.agent ?? null}
          position={contextMenu ? { x: contextMenu.x, y: contextMenu.y } : null}
          onClose={() => setContextMenu(null)}
          onViewProfile={(a) => { setContextMenu(null); setSelectedAgent(a) }}
          onDetach={handleDetach}
          onAssignManager={handleAssignManager}
          onChangeCompTier={handleChangeCompTier}
          onChangeStage={handleChangeStage}
          onVerify={handleVerify}
          allAgents={agents}
          compTiers={compTiers}
        />

        {selectedAgent && (
          <AgentProfilePanel
            agent={selectedAgent}
            onClose={() => setSelectedAgent(null)}
          />
        )}
      </div>

      <AddAgentModal open={showAddAgent} onClose={() => setShowAddAgent(false)} />

      {/* Re-Sync from Discord Confirmation Dialog */}
      <Dialog open={showResyncDialog} onOpenChange={(open) => { setShowResyncDialog(open); if (!open) setConfirmText('') }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Re-Sync Agents from Discord</DialogTitle>
            <DialogDescription>
              This will re-import all members from your Discord server with their current roles and data.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive font-medium">Warning: This will overwrite agent data including:</p>
              <ul className="text-sm text-destructive/80 mt-1 space-y-0.5 ml-4 list-disc">
                <li>Manager/hierarchy relationships</li>
                <li>Compensation tier assignments</li>
                <li>Agent stage assignments</li>
              </ul>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Type <span className="font-mono font-bold text-foreground">RESYNC</span> to confirm</label>
              <Input
                placeholder="RESYNC"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowResyncDialog(false); setConfirmText('') }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== 'RESYNC' || isResyncing}
              onClick={handleResync}
            >
              {isResyncing ? 'Re-Syncing...' : 'Re-Sync All Agents'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
