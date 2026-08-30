import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { useSales } from '@/hooks/useSales'
import { getAnnualizedPremium } from '@/lib/premium'
import { fmt$ } from '@/components/charts/chart-constants'
import { getStatusGroup, STATUS_COLORS } from './policy-constants'
import PolicyWidgetEmptyState from './PolicyWidgetEmptyState'

export default function RecentActivityWidget() {
  const navigate = useNavigate()
  const { data: salesData, isLoading } = useSales({ page: 1 })
  const sales = salesData?.sales ?? []

  const recentSales = useMemo(() => {
    return [...sales]
      .sort((a, b) => new Date(b.createdAt || b.submittedAt).getTime() - new Date(a.createdAt || a.submittedAt).getTime())
      .slice(0, 5)
  }, [sales])

  if (isLoading) {
    return <div className="h-[200px] rounded-xl bg-muted/30 animate-pulse" />
  }

  return (
    <div className="space-y-3">
      {recentSales.map(sale => (
        <div
          key={sale.id}
          className="flex items-center gap-3 group cursor-pointer hover:bg-white/[0.02] rounded-md p-1 -m-1 transition-colors"
          onClick={() => navigate(`/policy-hq/book?expand=${sale.id}`)}
        >
          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[getStatusGroup(sale.status)] }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{sale.clientName}</p>
            <p className="text-[10px] text-muted-foreground">
              {sale.carrier} · {sale.productName || (sale.policyType !== 'life' ? sale.policyType : '—')} · {fmt$(getAnnualizedPremium(sale))}
            </p>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] capitalize shrink-0"
            style={{
              borderColor: `${STATUS_COLORS[getStatusGroup(sale.status)]}40`,
              color: STATUS_COLORS[getStatusGroup(sale.status)],
            }}
          >
            {sale.status}
          </Badge>
        </div>
      ))}
      {recentSales.length === 0 && (
        <PolicyWidgetEmptyState
          title="No recent activity yet"
          description="Recent policy submissions and updates will appear here."
          learnTitle="How recent activity works"
          learnBody="This widget shows the latest submitted or updated policies so you can quickly jump back into active business."
        />
      )}
    </div>
  )
}
