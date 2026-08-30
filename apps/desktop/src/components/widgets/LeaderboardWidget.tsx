import { useLeaderboard } from '../../hooks/useDashboard'
import { useDateStore } from '../../store/date-store'
import { IconTrophy } from '@tabler/icons-react'

export default function LeaderboardWidget() {
  const { current } = useDateStore()
  const { data: leaderboard = [], isLoading } = useLeaderboard({ dateFrom: current.from, dateTo: current.to })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-8 rounded-lg bg-muted/50 animate-pulse" />
        ))}
      </div>
    )
  }

  if (leaderboard.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <IconTrophy size={24} />
        <span className="text-sm">No leaderboard data yet</span>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      {leaderboard.slice(0, 10).map((entry, i) => (
        <div
          key={entry.agentId}
          className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-muted/50 transition-colors text-sm"
        >
          <span
            className={`w-6 text-center font-bold ${
              i < 3 ? 'text-yellow-400' : 'text-muted-foreground'
            }`}
          >
            {i + 1}
          </span>
          <span className="flex-1 text-foreground truncate">{entry.name}</span>
          <span className="text-muted-foreground text-xs">{entry.policyCount} policies</span>
          <span className="text-foreground font-medium w-20 text-right">
            ${entry.totalPremium.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}
