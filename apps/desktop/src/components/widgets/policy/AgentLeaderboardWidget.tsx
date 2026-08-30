import { useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { useSales } from '@/hooks/useSales'
import { getAnnualizedPremium } from '@/lib/premium'
import { fmt$ } from '@/components/charts/chart-constants'
import PolicyWidgetEmptyState from './PolicyWidgetEmptyState'

export default function AgentLeaderboardWidget() {
  const { data: salesData, isLoading } = useSales({ page: 1 })
  const sales = salesData?.sales ?? []

  const agentLeaderboard = useMemo(() => {
    const grouped: Record<string, { name: string; count: number; premium: number }> = {}
    for (const s of sales) {
      const agentName = (s.agentFirstName && s.agentLastName)
        ? `${s.agentFirstName} ${s.agentLastName}`.trim()
        : s.agentId?.slice(0, 8) || 'Unknown'
      if (!grouped[agentName]) grouped[agentName] = { name: agentName, count: 0, premium: 0 }
      grouped[agentName].count++
      grouped[agentName].premium += getAnnualizedPremium(s)
    }
    return Object.values(grouped).sort((a, b) => b.premium - a.premium).slice(0, 5)
  }, [sales])

  if (isLoading) {
    return <div className="h-[200px] rounded-xl bg-muted/30 animate-pulse" />
  }

  return (
    <div className="space-y-3">
      {agentLeaderboard.map((agent, i) => {
        const maxPremium = agentLeaderboard[0]?.premium || 1
        return (
          <div key={agent.name} className="flex items-center gap-3">
            <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{agent.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#7DD3FC]/60"
                    style={{ width: `${(agent.premium / maxPremium) * 100}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums">{fmt$(agent.premium)}</span>
              </div>
            </div>
            <Badge variant="outline" className="text-[10px]">{agent.count}</Badge>
          </div>
        )
      })}
      {agentLeaderboard.length === 0 && (
        <PolicyWidgetEmptyState
          title="No leaderboard yet"
          description="Agent rankings appear once policies are associated with agents and premium."
          learnTitle="How agent leaderboard works"
          learnBody="This widget ranks agents by annualized premium and shows policy count, helping you understand who is driving production."
        />
      )}
    </div>
  )
}
