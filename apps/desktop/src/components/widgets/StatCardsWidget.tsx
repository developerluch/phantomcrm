import MetricCard from '../MetricCard'
import { useSummary } from '../../hooks/useDashboard'
import { useDateStore } from '../../store/date-store'
import {
  IconUsers,
  IconCircleCheck,
  IconAlertTriangle,
  IconClockHour4,
} from '@tabler/icons-react'

export default function StatCardsWidget() {
  const { current } = useDateStore()
  const { data: summary, isLoading } = useSummary({ dateFrom: current.from, dateTo: current.to })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!summary) {
    return <div className="text-muted-foreground text-sm">No data available</div>
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <MetricCard
        label="Total Recruits"
        value={summary.total_agents}
        icon={<IconUsers size={20} />}
        color="#3b82f6"
      />
      <MetricCard
        label="Active Agents"
        value={summary.active_agents}
        icon={<IconCircleCheck size={20} />}
        color="#22c55e"
      />
      <MetricCard
        label="At Risk"
        value={summary.at_risk_count}
        icon={<IconAlertTriangle size={20} />}
        color="#f97316"
      />
      <MetricCard
        label="Avg Days to Active"
        value={summary.avg_days_to_activation ?? '--'}
        icon={<IconClockHour4 size={20} />}
        color="#a855f7"
        subtitle={summary.avg_days_to_activation ? 'days' : 'No data yet'}
      />
    </div>
  )
}
