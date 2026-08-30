import MetricCard from '../MetricCard'
import { useRecruitStats } from '../../hooks/useRecruits'
import { useDateStore } from '../../store/date-store'
import { IconUsers, IconUserPlus, IconPercentage, IconClock } from '@tabler/icons-react'

export default function RecruitStatsWidget() {
  const { current } = useDateStore()
  const { data: stats, isLoading } = useRecruitStats({ dateFrom: current.from, dateTo: current.to })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />)}
      </div>
    )
  }

  if (!stats) return <div className="text-sm text-muted-foreground">No recruit data</div>

  return (
    <div className="grid grid-cols-2 gap-2">
      <MetricCard label="Total Recruits" value={stats.total ?? 0} icon={<IconUsers size={20} />} color="#3b82f6" />
      <MetricCard label="This Week" value={stats.thisWeek ?? 0} icon={<IconUserPlus size={20} />} color="#22c55e" />
      <MetricCard label="Conversion Rate" value={`${(stats.conversionRate ?? 0).toFixed(1)}%`} icon={<IconPercentage size={20} />} color="#f59e0b" />
      <MetricCard label="Avg Days" value={stats.avgDaysToActive ?? '--'} icon={<IconClock size={20} />} color="#8b5cf6" />
    </div>
  )
}
