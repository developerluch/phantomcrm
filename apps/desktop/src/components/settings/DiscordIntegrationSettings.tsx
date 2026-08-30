import { useAuthStore } from '@/store'
import { useServers } from '@/hooks/useServers'
import { api } from '@/services/api'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  IconBrandDiscord,
  IconServer,
  IconRobot,
  IconCircleCheck,
  IconCircleX,
  IconLoader2,
} from '@tabler/icons-react'

export default function DiscordIntegrationSettings() {
  const { user } = useAuthStore()
  const { data: servers = [] } = useServers()
  const { data: botHealth, isLoading: healthLoading } = useQuery({
    queryKey: ['bot-health'],
    queryFn: () => api.healthCheck(),
    retry: false,
  })

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Discord Integration</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your Discord connection and bot settings</p>
      </div>

      {/* Connection Status */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#5865F2]/40 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconBrandDiscord size={15} className="text-[#5865F2]" />
            Connection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/20 border border-border/50">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="Discord" className="w-12 h-12 rounded-full" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#5865F2]/15 flex items-center justify-center">
                <IconBrandDiscord size={24} className="text-[#5865F2]" />
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{user?.displayName || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground font-mono">{user?.discordId || '—'}</p>
            </div>
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">
              <IconCircleCheck size={10} className="mr-1" />
              Connected
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Servers */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconServer size={15} className="text-blue-400" />
            Servers
          </CardTitle>
          <CardDescription className="text-xs">Discord servers connected to this dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          {servers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No servers connected</p>
          ) : (
            <div className="space-y-2">
              {servers.map((server) => (
                <div key={server.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/10 border border-border/50">
                  {server.iconUrl ? (
                    <img src={server.iconUrl} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                      {server.guildName?.[0] || '?'}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{server.guildName || 'Unknown Server'}</p>
                    <p className="text-xs text-muted-foreground font-mono">{server.discordGuildId}</p>
                  </div>
                  {server.isActive && (
                    <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px]">Active</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bot Status */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconRobot size={15} className="text-emerald-400" />
            Bot Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {healthLoading ? (
              <><IconLoader2 size={16} className="animate-spin text-muted-foreground" /><span className="text-sm text-muted-foreground">Checking...</span></>
            ) : botHealth ? (
              <><IconCircleCheck size={16} className="text-emerald-400" /><span className="text-sm text-foreground">Bot is online and responding</span></>
            ) : (
              <><IconCircleX size={16} className="text-red-400" /><span className="text-sm text-red-400">Bot is offline or unreachable</span></>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Auto-Import Settings */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Auto-Import Settings</CardTitle>
          <CardDescription className="text-xs">Configure how new Discord members are handled</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Auto-import new members</p>
              <p className="text-xs text-muted-foreground">Automatically create agent records for new server members</p>
            </div>
            <Badge variant="outline" className="text-[10px]">Coming soon</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
