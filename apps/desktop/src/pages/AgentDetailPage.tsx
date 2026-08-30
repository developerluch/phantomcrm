import { useParams, useNavigate } from 'react-router-dom'
import { IconArrowLeft, IconAlertTriangle } from '@tabler/icons-react'
import { useAgent } from '../hooks/useAgents'
import {
  useAgentSalesAnalytics,
  useAgentWavvMetrics,
  useAgentRecruitsAnalytics,
  useAgentAppointments,
  useAgentActivityStats,
} from '../hooks/useAgentAnalytics'
import { STAGE_NAMES, STAGE_COLORS } from '../types/agent'
import { ScheduleTab } from '../components/agents/schedule-tab'
import { SalesPerformanceCard } from '../components/agents/SalesPerformanceCard'
import { WavvMetricsCard } from '../components/agents/WavvMetricsCard'
import { RecruitingCard } from '../components/agents/RecruitingCard'
import { AppointmentsCard } from '../components/agents/AppointmentsCard'
import { ActivityCard } from '../components/agents/ActivityCard'
import { AgentScoreCard } from '../components/agents/AgentScoreCard'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

export default function AgentDetailPage() {
  const { discordId } = useParams()
  const navigate = useNavigate()

  const { data: agent, isLoading, isError, refetch } = useAgent(discordId ?? null)

  // Analytics hooks — all fetch in parallel
  const { data: salesData } = useAgentSalesAnalytics(discordId ?? null)
  const { data: wavvData } = useAgentWavvMetrics(discordId ?? null)
  const { data: recruitsData } = useAgentRecruitsAnalytics(discordId ?? null)
  const { data: appointmentData } = useAgentAppointments(discordId ?? null)
  const { data: activityData } = useAgentActivityStats(discordId ?? null)

  if (isLoading) {
    return (
      <div className="text-muted-foreground text-center py-12">
        Loading agent profile...
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <IconAlertTriangle size={40} className="text-destructive" />
        <p className="text-muted-foreground">Failed to load agent profile.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="text-muted-foreground text-center py-12">Agent not found.</div>
    )
  }

  const stageName = STAGE_NAMES[agent.current_stage] || 'Unknown'
  const stageColor = STAGE_COLORS[agent.current_stage] || '#95a5a6'

  return (
    <div className="space-y-6 pt-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5 text-muted-foreground hover:text-foreground">
        <IconArrowLeft size={16} />
        Back
      </Button>

      {/* Header */}
      <div
        style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}
        className="rounded-xl p-6 flex items-center gap-6"
      >
        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-2xl font-bold text-primary-foreground">
          {(agent.full_name || '?')[0].toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            {agent.full_name || `User ${agent.discord_id}`}
          </h1>
          <p className="text-muted-foreground">
            {agent.agency || 'No agency'} &middot; Upline: {agent.upline_manager || 'N/A'}
          </p>
        </div>
        <div className="text-right">
          <Badge
            className="px-4 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: stageColor }}
          >
            Stage {agent.current_stage}: {stageName}
          </Badge>
          <p className="text-xs text-muted-foreground mt-2">
            Joined: {agent.joined_at?.slice(0, 10) || 'Unknown'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="dialing">Dialing</TabsTrigger>
          <TabsTrigger value="recruiting">Recruiting</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AgentScoreCard
              salesStats={salesData?.stats ?? null}
              wavvData={wavvData ?? null}
              appointmentData={appointmentData ?? null}
              activityData={activityData ?? null}
              recruitsData={recruitsData ?? null}
            />
            <SalesPerformanceCard
              sales={salesData?.sales ?? []}
              stats={salesData?.stats ?? null}
              compact
            />
            <WavvMetricsCard data={wavvData ?? null} compact />
            <AppointmentsCard data={appointmentData ?? null} compact />
            <RecruitingCard data={recruitsData ?? null} compact />
            <ActivityCard data={activityData ?? null} compact />
          </div>
        </TabsContent>

        <TabsContent value="sales">
          <SalesPerformanceCard
            sales={salesData?.sales ?? []}
            stats={salesData?.stats ?? null}
          />
        </TabsContent>

        <TabsContent value="dialing">
          <WavvMetricsCard data={wavvData ?? null} />
        </TabsContent>

        <TabsContent value="recruiting">
          <RecruitingCard data={recruitsData ?? null} />
        </TabsContent>

        <TabsContent value="schedule">
          <div
            style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}
            className="rounded-xl p-6"
          >
            <ScheduleTab agentId={String(agent.discord_id)} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
