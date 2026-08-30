import { useNavigate } from 'react-router-dom'
import FunnelChart from '../FunnelChart'
import { useFunnel } from '../../hooks/useDashboard'
import { useDateStore } from '../../store/date-store'

export default function FunnelChartWidget() {
  const navigate = useNavigate()
  const { current } = useDateStore()
  const { data: funnel, isLoading } = useFunnel({ dateFrom: current.from, dateTo: current.to })

  if (isLoading) {
    return <div className="h-full rounded-xl bg-muted/50 animate-pulse" />
  }

  if (!funnel) {
    return <div className="text-muted-foreground text-sm">No funnel data available</div>
  }

  return (
    <FunnelChart
      stages={funnel.stages}
      onStageClick={(stage) => navigate(`/agents?stage=${stage}`)}
    />
  )
}
