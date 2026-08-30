import MasterChartWidget from '../charts/MasterChartWidget'
import { useFunnel, useRevenueChart, usePipelineValue } from '../../hooks/useDashboard'
import { useDateStore } from '../../store/date-store'

export default function MasterChartWidgetWrapper() {
  const { current } = useDateStore()
  const dateParams = { dateFrom: current.from, dateTo: current.to }
  const { data: funnelData } = useFunnel(dateParams)
  const stages = funnelData?.stages ?? []
  const { data: revenue = [] } = useRevenueChart(dateParams)
  const { data: pipeline = [] } = usePipelineValue(dateParams)

  return (
    <MasterChartWidget
      stages={stages}
      revenue={revenue}
      pipeline={pipeline}
    />
  )
}
