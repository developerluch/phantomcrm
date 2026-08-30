interface BarChartProps {
  type: 'bar'
  data: { label: string; value: number }[]
  width?: number
  height?: number
  color?: string
}

interface LineChartProps {
  type: 'line'
  data: { label: string; value: number }[]
  width?: number
  height?: number
  color?: string
}

interface DonutChartProps {
  type: 'donut'
  data: { label: string; value: number; color?: string }[]
  width?: number
  height?: number
}

type MiniChartProps = BarChartProps | LineChartProps | DonutChartProps

const DEFAULT_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#ec4899', '#6366f1']

export default function MiniChart(props: MiniChartProps) {
  const { type, data } = props
  const width = props.width ?? 300
  const height = props.height ?? 160

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-muted-foreground text-xs" style={{ width, height }}>
        No data
      </div>
    )
  }

  if (type === 'bar') return <BarChart {...props} width={width} height={height} />
  if (type === 'line') return <LineChart {...props} width={width} height={height} />
  if (type === 'donut') return <DonutChart {...props} width={width} height={height} />
  return null
}

function BarChart({ data, width, height, color = '#3b82f6' }: BarChartProps & { width: number; height: number }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1)
  const padding = { top: 10, bottom: 24, left: 4, right: 4 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom
  const barWidth = Math.min(chartW / data.length - 4, 32)
  const gap = (chartW - barWidth * data.length) / (data.length + 1)

  return (
    <svg width={width} height={height} className="overflow-visible">
      {data.map((d, i) => {
        const barH = (d.value / maxVal) * chartH
        const x = padding.left + gap + i * (barWidth + gap)
        const y = padding.top + chartH - barH
        return (
          <g key={d.label}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barH}
              rx={3}
              fill={color}
              opacity={0.7}
            >
              <title>{`${d.label}: ${d.value.toLocaleString()}`}</title>
            </rect>
            <text
              x={x + barWidth / 2}
              y={height - 4}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize={9}
            >
              {d.label.length > 6 ? d.label.slice(0, 5) + '…' : d.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function LineChart({ data, width, height, color = '#3b82f6' }: LineChartProps & { width: number; height: number }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1)
  const padding = { top: 10, bottom: 24, left: 4, right: 4 }
  const chartW = width - padding.left - padding.right
  const chartH = height - padding.top - padding.bottom

  const points = data.map((d, i) => {
    const x = padding.left + (i / Math.max(data.length - 1, 1)) * chartW
    const y = padding.top + chartH - (d.value / maxVal) * chartH
    return { x, y, ...d }
  })

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = pathD + ` L ${points[points.length - 1].x} ${padding.top + chartH} L ${points[0].x} ${padding.top + chartH} Z`

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#lineGrad)" />
      <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p) => (
        <circle key={p.label} cx={p.x} cy={p.y} r={3} fill={color}>
          <title>{`${p.label}: ${p.value.toLocaleString()}`}</title>
        </circle>
      ))}
      {points.map((p, i) => (
        <text
          key={`label-${p.label}`}
          x={p.x}
          y={height - 4}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize={9}
        >
          {i % Math.ceil(data.length / 6) === 0 ? (p.label.length > 6 ? p.label.slice(0, 5) + '…' : p.label) : ''}
        </text>
      ))}
    </svg>
  )
}

function DonutChart({ data, width, height }: DonutChartProps & { width: number; height: number }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null

  const size = Math.min(width, height)
  const cx = width / 2
  const cy = (height - 20) / 2
  const r = size / 2 - 20
  const innerR = r * 0.6

  let currentAngle = -Math.PI / 2

  const slices = data.map((d, i) => {
    const angle = (d.value / total) * Math.PI * 2
    const startAngle = currentAngle
    const endAngle = currentAngle + angle
    currentAngle = endAngle

    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const ix1 = cx + innerR * Math.cos(endAngle)
    const iy1 = cy + innerR * Math.sin(endAngle)
    const ix2 = cx + innerR * Math.cos(startAngle)
    const iy2 = cy + innerR * Math.sin(startAngle)

    const largeArc = angle > Math.PI ? 1 : 0

    const pathD = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2}`,
      'Z',
    ].join(' ')

    const color = d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]
    const pct = ((d.value / total) * 100).toFixed(1)

    return (
      <path key={d.label} d={pathD} fill={color} opacity={0.8}>
        <title>{`${d.label}: ${d.value.toLocaleString()} (${pct}%)`}</title>
      </path>
    )
  })

  return (
    <div className="flex items-start gap-4">
      <svg width={size - 20} height={size - 20} className="shrink-0">
        {slices}
      </svg>
      <div className="flex flex-col gap-1 pt-2">
        {data.map((d, i) => (
          <div key={d.label} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length] }} />
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">{d.label}</span>
            <span className="text-[10px] text-foreground tabular-nums">{((d.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
