import MetricCard from '../MetricCard'
import { useChargebackSummary } from '../../hooks/useChargebacks'
import { useDateStore } from '../../store/date-store'
import { IconReceiptRefund, IconPercentage, IconTrendingDown } from '@tabler/icons-react'

export default function ChargebackWidget() {
  const { current } = useDateStore()
  const { data: summary, isLoading } = useChargebackSummary({ dateFrom: current.from, dateTo: current.to })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />)}
      </div>
    )
  }

  if (!summary) return <div className="text-sm text-muted-foreground">No chargeback data</div>

  const total = summary.totalAmount ?? 0
  const recovered = summary.recoveredAmount ?? 0
  const rate = total > 0 ? ((recovered / total) * 100) : 0

  return (
    <div className="space-y-2">
      <MetricCard label="Total Chargebacks" value={`$${total.toLocaleString()}`} icon={<IconReceiptRefund size={20} />} color="#ef4444" />
      <MetricCard label="Recovery Rate" value={`${rate.toFixed(1)}%`} icon={<IconPercentage size={20} />} color="#22c55e" />
      <MetricCard label="Net Loss" value={`$${(total - recovered).toLocaleString()}`} icon={<IconTrendingDown size={20} />} color="#f59e0b" />
    </div>
  )
}
