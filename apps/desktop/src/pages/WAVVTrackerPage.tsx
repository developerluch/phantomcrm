import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  IconPhone, IconPlugConnected, IconClock, IconCalendarEvent,
  IconFileCheck, IconSearch, IconTrophy, IconUsers,
} from '@tabler/icons-react'

function MetricBox({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg p-2" style={{ backgroundColor: `${color}15` }}>
          <div style={{ color }}>{icon}</div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold text-foreground">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function getDateRange(period: string) {
  const to = new Date().toISOString().split('T')[0]
  const d = new Date()
  if (period === 'week') d.setDate(d.getDate() - 7)
  else if (period === 'month') d.setMonth(d.getMonth() - 1)
  else d.setMonth(d.getMonth() - 3)
  return { from: d.toISOString().split('T')[0], to }
}

export default function WAVVTrackerPage() {
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter'>('month')
  const [search, setSearch] = useState('')
  const range = useMemo(() => getDateRange(period), [period])

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['wavv-overview', range],
    queryFn: () => api.getWavvOverview(range),
  })

  const { data: teams = [] } = useQuery({
    queryKey: ['wavv-teams', range],
    queryFn: () => api.getWavvTeams(range),
  })

  const { data: leaderboard = [] } = useQuery({
    queryKey: ['wavv-leaderboard', range],
    queryFn: () => api.getWavvLeaderboard(range),
  })

  const filteredLeaderboard = search
    ? leaderboard.filter((a) =>
        `${a.firstName} ${a.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        a.agency.toLowerCase().includes(search.toLowerCase())
      )
    : leaderboard

  return (
    <div className="space-y-5 animate-fade-in pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">WAVV Production Tracker</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Dialing metrics and production analytics</p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as 'week' | 'month' | 'quarter')}>
          <TabsList>
            <TabsTrigger value="week">Week</TabsTrigger>
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="quarter">Quarter</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Overview metrics */}
      {overviewLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : overview && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <MetricBox label="Total Dials" value={overview.totalDials} icon={<IconPhone size={18} />} color="#3b82f6" />
          <MetricBox label="Connections" value={overview.totalConnections} icon={<IconPlugConnected size={18} />} color="#22c55e" />
          <MetricBox label="Talk Time" value={`${Math.round(overview.totalTalkMins / 60)}h`} icon={<IconClock size={18} />} color="#f59e0b" />
          <MetricBox label="Appointments" value={overview.totalAppointments} icon={<IconCalendarEvent size={18} />} color="#a855f7" />
          <MetricBox label="Policies" value={overview.totalPolicies} icon={<IconFileCheck size={18} />} color="#06b6d4" />
          <MetricBox label="Active Agents" value={overview.agentCount} icon={<IconUsers size={18} />} color="#ec4899" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Team breakdown */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Team Breakdown</CardTitle>
            <CardDescription>Production by agency</CardDescription>
          </CardHeader>
          <CardContent>
            {teams.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No team data.</p>
            ) : (
              <div className="space-y-3">
                {teams.map((t) => (
                  <div key={t.agency} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground font-medium">{t.agency || 'Unassigned'}</span>
                      <span className="text-xs text-muted-foreground">{t.agentCount} agents</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <span>{t.dials.toLocaleString()} dials</span>
                      <span>{t.connections.toLocaleString()} conn.</span>
                      <span>{t.policies} policies</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <IconTrophy size={16} className="text-yellow-400" />
                Agent Leaderboard
              </CardTitle>
            </div>
            <div className="relative w-48">
              <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search agents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-8 text-xs"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border">
                    <th className="text-left py-2 pr-2">#</th>
                    <th className="text-left py-2">Agent</th>
                    <th className="text-left py-2">Agency</th>
                    <th className="text-right py-2">Dials</th>
                    <th className="text-right py-2">Conn.</th>
                    <th className="text-right py-2">Talk</th>
                    <th className="text-right py-2">Appts</th>
                    <th className="text-right py-2">Policies</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted-foreground">
                        No production data found.
                      </td>
                    </tr>
                  ) : (
                    filteredLeaderboard.map((a, i) => (
                      <tr key={a.discordId} className="border-b border-border/50 hover:bg-white/[0.02]">
                        <td className={`py-2 pr-2 font-bold ${i < 3 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                          {i + 1}
                        </td>
                        <td className="py-2 text-foreground">
                          {a.firstName} {a.lastName}
                        </td>
                        <td className="py-2 text-muted-foreground">{a.agency || '—'}</td>
                        <td className="py-2 text-right">{a.dials.toLocaleString()}</td>
                        <td className="py-2 text-right">{a.connections.toLocaleString()}</td>
                        <td className="py-2 text-right">{Math.round(a.talkTimeMins / 60)}h</td>
                        <td className="py-2 text-right">{a.appointments}</td>
                        <td className="py-2 text-right font-medium text-green-400">{a.policies}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
