import { memo } from 'react'
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

const EnergyEdge = memo(function EnergyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
  })

  // Vary animation speed based on direct reports (more reports = faster pulse)
  const reports = (data as Record<string, unknown>)?.directReports as number ?? 1
  const duration = Math.max(0.6, 1.8 - reports * 0.15)

  const gradientId = `energy-grad-${id}`

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.6} />
          <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0.6} />
        </linearGradient>
      </defs>
      {/* Dim base path */}
      <BaseEdge
        id={`${id}-base`}
        path={edgePath}
        style={{
          stroke: '#1e293b',
          strokeWidth: 2,
          fill: 'none',
        }}
      />
      {/* Animated energy path */}
      <path
        d={edgePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={2}
        strokeDasharray="8 8"
        style={{
          animation: `energy-flow ${duration}s linear infinite`,
        }}
      />
    </>
  )
})

export default EnergyEdge
