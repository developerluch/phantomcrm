import { useNavigate } from 'react-router-dom'
import AtRiskBanner from '../AtRiskBanner'
import { useAtRisk } from '../../hooks/useDashboard'
import { useDateStore } from '../../store/date-store'

export default function AtRiskWidget() {
  const navigate = useNavigate()
  const { current } = useDateStore()
  const { data: atRisk, isLoading } = useAtRisk({ dateFrom: current.from, dateTo: current.to })

  if (isLoading) {
    return <div className="h-full rounded-xl bg-muted/50 animate-pulse" />
  }

  if (!atRisk) {
    return <div className="text-muted-foreground text-sm">No data available</div>
  }

  return (
    <AtRiskBanner
      agents={atRisk}
      onAgentClick={(id) => navigate(`/agents/${id}`)}
    />
  )
}
