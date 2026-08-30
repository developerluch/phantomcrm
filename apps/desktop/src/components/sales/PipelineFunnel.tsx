import { useSalesPipeline } from '../../hooks/useSales'
import { Card, CardContent } from '@/components/ui/card'
import { IconChevronRight } from '@tabler/icons-react'

interface Props {
  agentId?: string
  dateFrom?: string
  dateTo?: string
}

const STAGE_COLORS = [
  '#3b82f6', // submitted — blue
  '#f59e0b', // approved — amber
  '#8b5cf6', // issued — purple
  '#22c55e', // on books — green
  '#14b8a6', // paid — teal
]

export default function PipelineFunnel({ agentId, dateFrom, dateTo }: Props) {
  const { data: pipeline, isLoading } = useSalesPipeline({ agentId, dateFrom, dateTo })

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="h-16 bg-muted/30 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (!pipeline) return null

  const stages = [
    { name: 'Submitted', count: pipeline.submitted.count, totalAP: pipeline.submitted.totalAP },
    { name: 'Approved', count: pipeline.approved.count, totalAP: pipeline.approved.totalAP },
    { name: 'Issued', count: pipeline.issued.count, totalAP: pipeline.issued.totalAP },
    { name: 'On Books', count: pipeline.onBooks.count, totalAP: pipeline.onBooks.totalAP },
    { name: 'Paid', count: pipeline.paid.count, totalAP: pipeline.paid.totalAP },
  ]

  // Calculate conversion rates between adjacent stages
  const conversionRates = stages.map((stage, i) => {
    if (i >= stages.length - 1) return null
    const next = stages[i + 1]
    if (stage.count === 0) return 0
    return Math.round((next.count / stage.count) * 100)
  })

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between overflow-x-auto">
          {stages.map((stage, i) => (
            <div key={stage.name} className="flex items-center min-w-0">
              <div className="text-center px-4 sm:px-6">
                <p className="text-2xl font-bold text-foreground tabular-nums">{stage.count}</p>
                <p className="text-xs text-muted-foreground whitespace-nowrap">{stage.name}</p>
                <p
                  className="text-sm font-medium mt-1 tabular-nums"
                  style={{ color: STAGE_COLORS[i] }}
                >
                  ${stage.totalAP.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
              {i < stages.length - 1 && (
                <div className="flex items-center text-muted-foreground/30 mx-1 shrink-0">
                  <IconChevronRight size={20} />
                  <span className="text-[9px] -ml-1 text-muted-foreground tabular-nums">
                    {conversionRates[i]}%
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
