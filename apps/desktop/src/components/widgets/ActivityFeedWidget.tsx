import { useActivityLog } from '../../hooks/useActivity'
import { useDateStore } from '../../store/date-store'
import { formatDistanceToNow } from 'date-fns'
import { IconActivity } from '@tabler/icons-react'

export default function ActivityFeedWidget() {
  const { current } = useDateStore()
  const { data: entries, isLoading } = useActivityLog({ limit: 20, dateFrom: current.from, dateTo: current.to })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-muted/50 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <IconActivity size={24} />
        <span className="text-sm">No recent activity</span>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {entries.map((entry) => {
        const actorName =
          entry.agent
            ? `${entry.agent.firstName} ${entry.agent.lastName}`
            : entry.user?.name ?? 'System'

        return (
          <div
            key={entry.id}
            className="flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 mt-0.5">
              {actorName[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground leading-snug">
                <span className="font-medium text-foreground">{actorName}</span>{' '}
                <span className="text-muted-foreground">{entry.description}</span>
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
