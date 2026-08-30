import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useSalesAnalytics } from '../../hooks/useSales'

interface Props {
  agentId?: string
  dateFrom?: string
  dateTo?: string
}

export default function SalesAnalytics({ agentId, dateFrom, dateTo }: Props) {
  const { data: analytics, isLoading } = useSalesAnalytics({ agentId, dateFrom, dateTo })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-64 bg-muted/30 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="text-center text-muted-foreground py-12">
        No analytics data available
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Policy Type Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Policy Type Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.byPolicyType.length > 0 ? (
            <div className="space-y-2">
              {analytics.byPolicyType.map((item) => {
                const totalCount = analytics.byPolicyType.reduce((s, r) => s + r.count, 0)
                const pct = totalCount > 0 ? (item.count / totalCount) * 100 : 0
                return (
                  <div key={item.type} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24 capitalize">{item.type.replace('_', ' ')}</span>
                    <Progress value={pct} className="flex-1 h-2 bg-muted/30" indicatorClassName="bg-primary/60" />
                    <span className="text-xs text-foreground tabular-nums w-10 text-right">{item.count}</span>
                    <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">{pct.toFixed(1)}%</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No data</p>
          )}
        </CardContent>
      </Card>

      {/* Monthly Production */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Monthly Production</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.byMonth.length > 0 ? (
            <div className="space-y-2">
              {analytics.byMonth.slice(-6).map((item) => {
                const maxAP = Math.max(...analytics.byMonth.map((m) => m.premiumAP), 1)
                const pct = (item.premiumAP / maxAP) * 100
                return (
                  <div key={item.month} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20">{item.month}</span>
                    <Progress value={pct} className="flex-1 h-2 bg-muted/30" indicatorClassName="bg-blue-500/60" />
                    <span className="text-xs text-foreground tabular-nums w-20 text-right">
                      ${item.premiumAP.toLocaleString()}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No data</p>
          )}
        </CardContent>
      </Card>

      {/* Agent Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Agent Leaderboard (Issued AP)</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.topAgents.length > 0 ? (
            <div className="space-y-2">
              {analytics.topAgents.map((agent, i) => (
                <div key={agent.agentId} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}</span>
                  <span className="text-sm text-foreground flex-1">{agent.agentName}</span>
                  <span className="text-xs text-foreground tabular-nums">${agent.issuedAP.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No data</p>
          )}
        </CardContent>
      </Card>

      {/* Close Rate by Lead Source */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Close Rate by Lead Source</CardTitle>
        </CardHeader>
        <CardContent>
          {analytics.byLeadSource.length > 0 ? (
            <div className="space-y-2">
              {analytics.byLeadSource.map((item) => (
                <div key={item.source} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24">{item.source}</span>
                  <Progress value={item.closeRate * 100} className="flex-1 h-2 bg-muted/30" indicatorClassName="bg-green-500/60" />
                  <span className="text-xs text-foreground tabular-nums w-12 text-right">{(item.closeRate * 100).toFixed(1)}%</span>
                  <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{item.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No data</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
