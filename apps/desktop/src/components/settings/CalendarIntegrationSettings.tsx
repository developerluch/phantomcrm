import { useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { api } from '@/services/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { useGoogleCalendarAccounts, useAddGoogleAccount, useRemoveGoogleAccount } from '@/hooks/useGoogleCalendar'
import type { GCalPreferences } from '@/types/portal'
import {
  IconBrandGoogle,
  IconBrandWindows,
  IconCalendar,
  IconCircleCheck,
  IconLoader2,
  IconRefresh,
  IconLink,
  IconLinkOff,
  IconExternalLink,
  IconBolt,
} from '@tabler/icons-react'

const CALCOM_INTEGRATION_ENABLED = import.meta.env.VITE_CALCOM_INTEGRATION === 'true'

// ── Reusable Integration Card (Google / Microsoft) ─────────────────────────

interface IntegrationCardProps {
  name: string
  description: string
  icon: React.ElementType
  color: string
  bg: string
  border: string
  statusQueryKey: string
  getStatus: () => Promise<{ connected: boolean; provider: string }>
  getAuthUrl: () => Promise<{ url: string }>
  disconnect: () => Promise<{ disconnected: boolean }>
  sync: () => Promise<{ synced: number }>
  extraContent?: React.ReactNode
}

function IntegrationCard({ name, description, icon: Icon, color, bg, border, statusQueryKey, getStatus, getAuthUrl, disconnect, sync, extraContent }: IntegrationCardProps) {
  const qc = useQueryClient()
  const { data: status, isLoading } = useQuery({ queryKey: [statusQueryKey], queryFn: getStatus, retry: false })

  const connectMutation = useMutation({
    mutationFn: async () => {
      const { url } = await getAuthUrl()
      if (window.electronAPI?.openExternal) { window.electronAPI.openExternal(url) } else { window.open(url, '_blank') }
    },
    onError: () => toast.error(`Failed to connect ${name}`),
  })

  const disconnectMutation = useMutation({
    mutationFn: disconnect,
    onSuccess: () => { toast.success(`${name} disconnected`); qc.invalidateQueries({ queryKey: [statusQueryKey] }) },
    onError: () => toast.error(`Failed to disconnect ${name}`),
  })

  const syncMutation = useMutation({
    mutationFn: sync,
    onSuccess: (data) => toast.success(`Synced ${data.synced} events from ${name}`),
    onError: () => toast.error(`Failed to sync ${name}`),
  })

  const isConnected = status?.connected ?? false
  const isBusy = connectMutation.isPending || disconnectMutation.isPending || syncMutation.isPending

  return (
    <Card className={`border ${border}`} style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
          <Icon size={24} className={color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{name}</h3>
            {isLoading ? (
              <Badge variant="outline" className="text-[10px]"><IconLoader2 size={10} className="animate-spin mr-1" />Checking</Badge>
            ) : isConnected ? (
              <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30"><IconCircleCheck size={10} className="mr-1" />Connected</Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-muted-foreground">Not connected</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isConnected ? (
            <>
              <Button size="sm" variant="outline" onClick={() => syncMutation.mutate()} disabled={isBusy} className="flex items-center gap-1.5">
                {syncMutation.isPending ? <IconLoader2 size={14} className="animate-spin" /> : <IconRefresh size={14} />} Sync
              </Button>
              <Button size="sm" variant="outline" onClick={() => disconnectMutation.mutate()} disabled={isBusy} className="flex items-center gap-1.5 text-destructive hover:text-destructive">
                {disconnectMutation.isPending ? <IconLoader2 size={14} className="animate-spin" /> : <IconLinkOff size={14} />} Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => connectMutation.mutate()} disabled={isBusy || isLoading} className="flex items-center gap-1.5">
              {connectMutation.isPending ? <IconLoader2 size={14} className="animate-spin" /> : <IconLink size={14} />} Connect
            </Button>
          )}
        </div>
        {isConnected && extraContent && (
          <div className="mt-4 pt-4 border-t border-border/50">
            {extraContent}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Google Calendar Preferences ────────────────────────────────────────────

const GCAL_PREFS_KEY = 'phantom-gcal-preferences'
const GCAL_LAST_SYNC_KEY = 'phantom-gcal-last-sync'

function getGCalPrefs(): GCalPreferences {
  try {
    return { autoSyncToGoogle: true, showGoogleEvents: true, ...JSON.parse(localStorage.getItem(GCAL_PREFS_KEY) ?? '{}') }
  } catch { return { autoSyncToGoogle: true, showGoogleEvents: true } }
}

function GoogleCalendarPreferences() {
  const [prefs, setPrefs] = useState<GCalPreferences>(getGCalPrefs)
  const [lastSync] = useState(() => localStorage.getItem(GCAL_LAST_SYNC_KEY))

  const syncMutation = useMutation({
    mutationFn: () => api.syncGoogleCalendar(),
    onSuccess: (data) => {
      const now = new Date().toISOString()
      localStorage.setItem(GCAL_LAST_SYNC_KEY, now)
      toast.success(`Synced ${data.synced} events`)
    },
    onError: () => toast.error('Sync failed'),
  })

  const updatePref = useCallback((key: keyof GCalPreferences, value: boolean) => {
    const updated = { ...prefs, [key]: value }
    setPrefs(updated)
    localStorage.setItem(GCAL_PREFS_KEY, JSON.stringify(updated))
  }, [prefs])

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-semibold">Sync Preferences</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Auto-sync to Google</span>
        <Switch checked={prefs.autoSyncToGoogle} onCheckedChange={(v) => updatePref('autoSyncToGoogle', v)} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Show Google events in calendar</span>
        <Switch checked={prefs.showGoogleEvents} onCheckedChange={(v) => updatePref('showGoogleEvents', v)} />
      </div>
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending} className="flex items-center gap-1.5">
          {syncMutation.isPending ? <IconLoader2 size={14} className="animate-spin" /> : <IconRefresh size={14} />}
          Sync Now
        </Button>
        <span className="text-[10px] text-muted-foreground">
          Last synced: {lastSync ? formatDistanceToNow(new Date(lastSync)) + ' ago' : 'Never'}
        </span>
      </div>
    </div>
  )
}

// ── Cal.com Featured Card ──────────────────────────────────────────────────

function CalComCard() {
  const [apiKey, setApiKey] = useState('')
  const [showSetup, setShowSetup] = useState(false)
  const qc = useQueryClient()

  const { data: status } = useQuery({
    queryKey: ['integration-calcom-status'],
    queryFn: () => api.getCalcomStatus(),
    retry: false,
  })

  const isConnected = status?.connected ?? false

  const connectMutation = useMutation({
    mutationFn: () => api.connectCalcom(apiKey),
    onSuccess: () => {
      toast.success('Cal.com connected!')
      setShowSetup(false)
      setApiKey('')
      qc.invalidateQueries({ queryKey: ['integration-calcom-status'] })
    },
    onError: () => toast.error('Failed to connect Cal.com'),
  })

  const disconnectMutation = useMutation({
    mutationFn: () => api.disconnectCalcom(),
    onSuccess: () => {
      toast.success('Cal.com disconnected')
      qc.invalidateQueries({ queryKey: ['integration-calcom-status'] })
    },
    onError: () => toast.error('Failed to disconnect Cal.com'),
  })

  return (
    <Card className="border border-primary/20" style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent rounded-t-xl" />
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <IconCalendar size={24} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-foreground">Cal.com</h3>
              <Badge className="text-[10px] bg-primary/15 text-primary border-primary/30">
                <IconBolt size={10} className="mr-1" />Recommended
              </Badge>
              {isConnected && (
                <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                  <IconCircleCheck size={10} className="mr-1" />Connected
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automate scheduling, booking links, and availability across all your calendars
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isConnected ? (
              <>
                <Button size="sm" variant="outline" onClick={() => window.open('https://app.cal.com', '_blank')} className="flex items-center gap-1.5">
                  <IconExternalLink size={14} /> Open Cal.com
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  className="flex items-center gap-1.5 text-destructive hover:text-destructive"
                >
                  {disconnectMutation.isPending ? <IconLoader2 size={14} className="animate-spin" /> : <IconLinkOff size={14} />} Disconnect
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setShowSetup(!showSetup)} className="flex items-center gap-1.5">
                <IconLink size={14} /> Connect
              </Button>
            )}
          </div>
        </div>

        {/* Setup form */}
        {showSetup && !isConnected && (
          <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
            <p className="text-xs text-muted-foreground">
              Enter your Cal.com API key. You can find it at{' '}
              <a href="https://app.cal.com/settings/developer/api-keys" target="_blank" rel="noreferrer" className="text-primary hover:underline">
                Cal.com &rarr; Settings &rarr; API Keys
              </a>
            </p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="cal_live_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && apiKey.trim() && connectMutation.mutate()}
                className="flex-1"
              />
              <Button
                variant="gradient"
                size="sm"
                onClick={() => connectMutation.mutate()}
                disabled={!apiKey.trim() || connectMutation.isPending}
              >
                {connectMutation.isPending && <IconLoader2 size={14} className="animate-spin mr-1.5" />}
                Save
              </Button>
            </div>
          </div>
        )}

        {/* Connected details */}
        {isConnected && status && (
          <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Booking URL</p>
              <p className="text-xs text-foreground mt-0.5 truncate">{status.bookingUrl || 'cal.com/...'}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Default Duration</p>
              <p className="text-xs text-foreground mt-0.5">{status.defaultDuration || 30}m</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Auto-Sync</p>
              <p className="text-xs text-foreground mt-0.5">{status.autoSync ? 'Enabled' : 'Disabled'}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main Export ─────────────────────────────────────────────────────────────

export default function CalendarIntegrationSettings() {
  const queryClient = useQueryClient()
  const { data: googleAccounts = [] } = useGoogleCalendarAccounts()
  const addAccount = useAddGoogleAccount()
  const removeAccount = useRemoveGoogleAccount()

  const handleGoogleConnect = useCallback(async () => {
    try {
      const { url } = await api.getGoogleAuthUrl()
      if (window.electronAPI?.openExternal) {
        window.electronAPI.openExternal(url)
      } else {
        window.open(url, '_blank')
      }
    } catch {
      toast.error('Failed to start Google Calendar connection')
    }
  }, [])

  // Listen for OAuth popup completion
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data === 'google-connected' || event.data === 'google-account-connected') {
        queryClient.invalidateQueries({ queryKey: ['google-calendar', 'accounts'] })
        queryClient.invalidateQueries({ queryKey: ['google-calendar', 'status'] })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [queryClient])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Calendars</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Connect and manage your calendar integrations.
        </p>
      </div>

      {CALCOM_INTEGRATION_ENABLED && (
        <>
          <CalComCard />
          <Separator />
        </>
      )}

      {/* Direct Calendar Syncs */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-3">
          Direct Calendar Sync
        </p>
        <div className="space-y-4">
          {/* Google Calendar Multi-Account */}
          <Card className="bg-card/50 backdrop-blur border-border/30">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                    <IconBrandGoogle size={20} className="text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-foreground">Google Calendar</h3>
                    <p className="text-xs text-muted-foreground">
                      {googleAccounts.length === 0 ? 'Not connected' : `${googleAccounts.length} account${googleAccounts.length > 1 ? 's' : ''} connected`}
                    </p>
                  </div>
                </div>
              </div>

              {googleAccounts.length === 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleGoogleConnect()}
                >
                  Connect Google Calendar
                </Button>
              ) : (
                <div className="space-y-2">
                  {googleAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border/30 bg-background/50"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ background: acc.color }}
                        />
                        <span className="text-sm text-foreground">{acc.googleEmail}</span>
                        {acc.isPrimary && (
                          <Badge variant="outline" className="text-[9px]">Primary</Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-destructive hover:text-destructive"
                        onClick={() => removeAccount.mutate(acc.id)}
                        disabled={removeAccount.isPending}
                      >
                        Disconnect
                      </Button>
                    </div>
                  ))}

                  {googleAccounts.length < 5 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => addAccount.mutate()}
                      disabled={addAccount.isPending}
                    >
                      {addAccount.isPending ? 'Opening...' : '+ Add Google Account'}
                    </Button>
                  )}
                </div>
              )}

              {/* Google Calendar Preferences */}
              {googleAccounts.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <GoogleCalendarPreferences />
                </div>
              )}
            </CardContent>
          </Card>

          <IntegrationCard
            name="Microsoft Calendar"
            description="Sync events and appointments with Outlook Calendar"
            icon={IconBrandWindows}
            color="text-blue-400"
            bg="bg-blue-500/10"
            border="border-blue-500/20"
            statusQueryKey="integration-microsoft-status"
            getStatus={() => api.getMicrosoftStatus()}
            getAuthUrl={() => api.getMicrosoftAuthUrl()}
            disconnect={() => api.disconnectMicrosoft()}
            sync={() => api.syncMicrosoftCalendar()}
          />
        </div>
      </div>
    </div>
  )
}
