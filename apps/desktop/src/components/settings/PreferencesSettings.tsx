import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { IconAdjustments, IconDeviceFloppy, IconShieldCheck } from '@tabler/icons-react'
import { api } from '@/services/api'
import type { AISettings } from '@/types/portal'

interface Preferences {
  language: string
  dateFormat: string
  defaultView: string
  voiceAutoPlay: boolean
  streamingSpeed: string
  responseStyle: string
}

const DEFAULTS: Preferences = {
  language: 'en',
  dateFormat: 'MM/DD/YYYY',
  defaultView: '/dashboard',
  voiceAutoPlay: true,
  streamingSpeed: 'normal',
  responseStyle: 'concise',
}

function loadPrefs(): Preferences {
  try {
    const raw = localStorage.getItem('vipa-preferences')
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS
  } catch { return DEFAULTS }
}

const AI_CATEGORY_LABELS = {
  analytics: { label: 'Analytics & Reports', description: 'Dashboard, sales, finance, WAVV, and activity reports' },
  agents: { label: 'Agents & Team', description: 'Agent lookups, agent actions, team assignments, pending joins' },
  recruits: { label: 'Recruit Management', description: 'Create, update, delete, and schedule recruits' },
  sales: { label: 'Sales', description: 'Create, update, and delete implemented sales records' },
  expenses: { label: 'Expenses', description: 'Create, update, and delete implemented expense records' },
  messaging: { label: 'Messaging & Campaigns', description: 'Send SMS/WhatsApp and manage drip campaigns' },
  appointments: { label: 'Appointments', description: 'Create, update, and delete appointments' },
  licenses: { label: 'Licenses', description: 'Create, update, and delete license records' },
  lockIns: { label: 'Lock-In Planning', description: 'Manage lock-ins, agents, budgets, and itineraries' },
  documents: { label: 'Documents', description: 'List, create, and delete document vault records' },
  notifications: { label: 'Notifications', description: 'Read and mark notifications' },
} as const

function migrateLocalAIPermissions(settings: AISettings): AISettings | null {
  if (localStorage.getItem('phantom-ai-permissions-migrated') === '1') return null
  const raw = localStorage.getItem('phantom-ai-permissions')
  if (!raw) return null
  try {
    const legacy = JSON.parse(raw) as Record<string, boolean>
    const categories = { ...settings.categories }
    if (legacy.analytics !== undefined) categories.analytics = legacy.analytics
    if (legacy.agent_management !== undefined) categories.agents = legacy.agent_management
    if (legacy.recruit_management !== undefined) categories.recruits = legacy.recruit_management
    if (legacy.sales_licensing !== undefined) {
      categories.sales = legacy.sales_licensing
      categories.expenses = legacy.sales_licensing
      categories.licenses = legacy.sales_licensing
    }
    if (legacy.messaging !== undefined) categories.messaging = legacy.messaging
    if (legacy.appointments_campaigns !== undefined) categories.appointments = legacy.appointments_campaigns
    if (legacy.lock_in !== undefined) categories.lockIns = legacy.lock_in
    return { ...settings, categories }
  } catch {
    return null
  }
}

export default function PreferencesSettings() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS)
  const queryClient = useQueryClient()

  useEffect(() => { setPrefs(loadPrefs()) }, [])

  const { data: aiSettings } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: () => api.getAISettings(),
  })

  const updateAISettings = useMutation({
    mutationFn: (settings: Pick<AISettings, 'fullTrustMode' | 'categories'>) => api.updateAISettings(settings),
    onSuccess: (settings) => {
      queryClient.setQueryData(['ai-settings'], settings)
      toast.success('AI settings updated')
    },
    onError: (error) => {
      toast.error(`Failed to update AI settings: ${error instanceof Error ? error.message : 'Unknown error'}`)
    },
  })

  useEffect(() => {
    if (!aiSettings) return
    const migrated = migrateLocalAIPermissions(aiSettings)
    if (!migrated) return
    updateAISettings.mutate({
      fullTrustMode: migrated.fullTrustMode,
      categories: migrated.categories,
    })
    localStorage.setItem('phantom-ai-permissions-migrated', '1')
  }, [aiSettings, updateAISettings])

  function patchAISettings(next: Pick<AISettings, 'fullTrustMode' | 'categories'>) {
    updateAISettings.mutate(next)
  }

  function update<K extends keyof Preferences>(key: K, value: Preferences[K]) {
    setPrefs((p) => ({ ...p, [key]: value }))
  }

  function handleSave() {
    localStorage.setItem('vipa-preferences', JSON.stringify(prefs))
    toast.success('Preferences saved')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Preferences</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Customize your experience</p>
      </div>

      {/* General */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconAdjustments size={15} className="text-blue-400" />
            General
          </CardTitle>
          <CardDescription className="text-xs">Language, date format, and defaults</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Language</label>
            <Select value={prefs.language} onValueChange={(v) => update('language', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date Format</label>
            <Select value={prefs.dateFormat} onValueChange={(v) => update('dateFormat', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Default Dashboard View</label>
            <Select value={prefs.defaultView} onValueChange={(v) => update('defaultView', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="/dashboard">Dashboard</SelectItem>
                <SelectItem value="/ai-chat">AI Chat</SelectItem>
                <SelectItem value="/recruits">Recruits</SelectItem>
                <SelectItem value="/discord-hub">Discord Hub</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* AI Chat */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconAdjustments size={15} className="text-emerald-400" />
            AI Chat
          </CardTitle>
          <CardDescription className="text-xs">Customize the AI assistant behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Voice Auto-Play</p>
              <p className="text-xs text-muted-foreground">Automatically speak AI responses</p>
            </div>
            <Switch checked={prefs.voiceAutoPlay} onCheckedChange={(v) => update('voiceAutoPlay', v)} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Streaming Speed</label>
            <Select value={prefs.streamingSpeed} onValueChange={(v) => update('streamingSpeed', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="slow">Slow</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="fast">Fast</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Response Style</label>
            <Select value={prefs.responseStyle} onValueChange={(v) => update('responseStyle', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="concise">Concise</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* AI Action Permissions */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconShieldCheck size={15} className="text-violet-400" />
            AI Action Permissions
          </CardTitle>
          <CardDescription className="text-xs">Control which actions the AI assistant can perform. Disabled categories will show a warning when attempted.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <div>
              <p className="text-sm font-medium text-foreground">Full Trust Mode</p>
              <p className="text-xs text-muted-foreground">Execute enabled mutation actions immediately after the AI proposes them</p>
            </div>
            <Switch
              checked={aiSettings?.fullTrustMode ?? false}
              disabled={!aiSettings || updateAISettings.isPending}
              onCheckedChange={(checked) => {
                if (!aiSettings) return
                patchAISettings({ fullTrustMode: checked, categories: aiSettings.categories })
              }}
            />
          </div>

          {(Object.keys(AI_CATEGORY_LABELS) as (keyof typeof AI_CATEGORY_LABELS)[]).map((key) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{AI_CATEGORY_LABELS[key].label}</p>
                <p className="text-xs text-muted-foreground">{AI_CATEGORY_LABELS[key].description}</p>
              </div>
              <Switch
                checked={aiSettings?.categories[key] ?? false}
                disabled={!aiSettings || updateAISettings.isPending}
                onCheckedChange={(checked) => {
                  if (!aiSettings) return
                  patchAISettings({
                    fullTrustMode: aiSettings.fullTrustMode,
                    categories: { ...aiSettings.categories, [key]: checked },
                  })
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Button onClick={handleSave} variant="gradient" size="sm" className="flex items-center gap-1.5">
        <IconDeviceFloppy size={14} />
        Save Preferences
      </Button>
    </div>
  )
}
