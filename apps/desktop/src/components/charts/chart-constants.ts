export const CHART_COLORS = {
  blue: '#3b82f6',
  green: '#22c55e',
  lime: '#7DD3FC',
  amber: '#f59e0b',
  red: '#ef4444',
  purple: '#a855f7',
  cyan: '#06b6d4',
  pink: '#ec4899',
} as const

export const CHART_PALETTE = [
  '#3b82f6', '#22c55e', '#f59e0b', '#a855f7',
  '#06b6d4', '#ef4444', '#ec4899', '#6366f1',
] as const

export const AXIS_TICK = { fill: 'hsl(var(--muted-foreground))', fontSize: 10 } as const

export const GRID_PROPS = {
  strokeDasharray: '3 3',
  stroke: 'hsl(var(--border) / 0.3)',
} as const

export function fmt$(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function fmtCompact$(n: number): string {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}k`
  return `$${n.toFixed(0)}`
}

export function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`
}

export function computeTrend(values: number[]): number | undefined {
  if (values.length < 2) return undefined
  const prev = values[values.length - 2]
  const curr = values[values.length - 1]
  if (prev === 0) return undefined
  return ((curr - prev) / Math.abs(prev)) * 100
}
