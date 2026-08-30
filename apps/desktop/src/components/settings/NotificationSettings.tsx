import { useState, useEffect } from 'react'
import { api } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { IconBell, IconDeviceFloppy } from '@tabler/icons-react'

interface PrefGroup {
  label: string
  description: string
  prefs: { key: string; label: string }[]
}

const PREF_GROUPS: PrefGroup[] = [
  {
    label: 'Agent Activity',
    description: 'Notifications about agent actions and status changes',
    prefs: [
      { key: 'agent.joined', label: 'New agent joins' },
      { key: 'agent.stage_change', label: 'Stage changes' },
      { key: 'agent.license_verified', label: 'License verified' },
      { key: 'agent.at_risk', label: 'Agent at risk' },
      { key: 'agent.kicked', label: 'Agent removed' },
    ],
  },
  {
    label: 'Production',
    description: 'WAVV and sales production alerts',
    prefs: [
      { key: 'production.daily_summary', label: 'Daily production summary' },
      { key: 'production.goal_achieved', label: 'Goal achieved' },
      { key: 'production.inactivity', label: 'Inactivity warnings' },
    ],
  },
  {
    label: 'Campaigns',
    description: 'Campaign status and delivery updates',
    prefs: [
      { key: 'campaign.sent', label: 'Campaign sent' },
      { key: 'campaign.scheduled', label: 'Scheduled campaigns' },
    ],
  },
  {
    label: 'System',
    description: 'System-level notifications',
    prefs: [
      { key: 'system.errors', label: 'System errors' },
      { key: 'system.audit', label: 'Security events' },
      { key: 'system.updates', label: 'Feature updates' },
    ],
  },
]

const CHANNELS = ['discord', 'email', 'in_app'] as const

function defaultPrefs(): Record<string, Record<string, boolean>> {
  const defaults: Record<string, Record<string, boolean>> = {}
  for (const group of PREF_GROUPS) {
    for (const pref of group.prefs) {
      defaults[pref.key] = { discord: false, email: false, in_app: true }
    }
  }
  return defaults
}

export default function NotificationSettings() {
  const [prefs, setPrefs] = useState(defaultPrefs)
  const [sound, setSound] = useState(true)
  const [digest, setDigest] = useState(false)

  useEffect(() => {
    api.fetch<Record<string, Record<string, boolean>>>('/api/v1/notifications/preferences')
      .then((data) => { if (data && Object.keys(data).length) setPrefs(data) })
      .catch(() => {})
  }, [])

  function toggle(key: string, channel: string) {
    setPrefs((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? { discord: false, email: false, in_app: true }),
        [channel]: !(prev[key]?.[channel] ?? false),
      },
    }))
  }

  async function handleSave() {
    try {
      await api.fetchMutate('/api/v1/notifications/preferences', 'PUT', prefs)
      toast.success('Notification preferences saved')
    } catch {
      toast.error('Failed to save preferences')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Notification Preferences</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Choose how and when you get notified</p>
      </div>

      {/* Quick toggles */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconBell size={15} className="text-purple-400" />
            General
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Notification Sounds</p>
              <p className="text-xs text-muted-foreground">Play sounds for in-app notifications</p>
            </div>
            <Switch checked={sound} onCheckedChange={setSound} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Daily Digest Email</p>
              <p className="text-xs text-muted-foreground">Receive a daily summary of activity</p>
            </div>
            <Switch checked={digest} onCheckedChange={setDigest} />
          </div>
        </CardContent>
      </Card>

      {/* Channel matrix */}
      {PREF_GROUPS.map((group) => (
        <Card key={group.label} style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{group.label}</CardTitle>
            <CardDescription className="text-xs">{group.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border">
                  <th className="text-left py-2 w-1/2">Event</th>
                  {CHANNELS.map((ch) => (
                    <th key={ch} className="text-center py-2 capitalize w-24">{ch.replace('_', '-')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.prefs.map(({ key, label }) => (
                  <tr key={key} className="border-b border-border/50">
                    <td className="py-2.5 text-foreground">{label}</td>
                    {CHANNELS.map((ch) => (
                      <td key={ch} className="py-2.5 text-center">
                        <Switch checked={prefs[key]?.[ch] ?? false} onCheckedChange={() => toggle(key, ch)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}

      <Button onClick={handleSave} variant="gradient" size="sm" className="flex items-center gap-1.5">
        <IconDeviceFloppy size={14} /> Save Preferences
      </Button>
    </div>
  )
}
