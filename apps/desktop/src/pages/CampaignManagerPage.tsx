import { useState, lazy, Suspense } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  IconPlus, IconTrash, IconSend, IconPlayerPause, IconEdit, IconSpeakerphone,
} from '@tabler/icons-react'
import EmptyState from '../components/EmptyState'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { toast } from 'sonner'

const DripSequenceEditor = lazy(() => import('../components/campaigns/DripSequenceEditor'))

type CampaignTab = 'blast' | 'drip'

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  scheduled: 'bg-blue-500/10 text-blue-400',
  active: 'bg-green-500/10 text-green-400',
  sent: 'bg-purple-500/10 text-purple-400',
  paused: 'bg-yellow-500/10 text-yellow-400',
}

const CHANNEL_OPTIONS = ['discord', 'email', 'sms', 'whatsapp']
const TARGET_OPTIONS = ['all', 'stage', 'agency', 'custom']

export default function CampaignManagerPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<CampaignTab>('blast')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    name: '',
    channel: 'discord',
    targetType: 'all',
    messageTemplate: '',
  })

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => api.getCampaigns(),
  })

  async function handleCreate() {
    if (!form.name.trim()) {
      toast.error('Campaign name is required')
      return
    }
    try {
      await api.createCampaign(form)
      toast.success('Campaign created')
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      setShowCreate(false)
      setForm({ name: '', channel: 'discord', targetType: 'all', messageTemplate: '' })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create campaign')
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      await api.updateCampaignStatus(id, status)
      toast.success(`Campaign ${status}`)
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update campaign')
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteCampaign(id)
      toast.success('Campaign deleted')
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete campaign')
    }
  }

  return (
    <div className="space-y-5 animate-fade-in pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Campaign Manager</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create and manage outreach campaigns</p>
        </div>
        {activeTab === 'blast' && (
          <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
            <IconPlus size={14} className="mr-1" />
            New Campaign
          </Button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {([['blast', 'Blast Campaigns'], ['drip', 'Drip Sequences']] as const).map(([key, label]) => (
          <Button
            key={key}
            variant="ghost"
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px rounded-none ${
              activeTab === key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </Button>
        ))}
      </div>

      {activeTab === 'drip' ? (
        <Suspense fallback={<div className="h-32 flex items-center justify-center text-muted-foreground text-sm">Loading...</div>}>
          <DripSequenceEditor />
        </Suspense>
      ) : (
      <>
      {/* Create form */}
      {showCreate && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">New Campaign</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Name</label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Q1 Outreach"
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Channel</label>
                <Select
                  value={form.channel}
                  onValueChange={(v) => setForm((f) => ({ ...f, channel: v }))}
                >
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="Select channel" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Target</label>
                <Select
                  value={form.targetType}
                  onValueChange={(v) => setForm((f) => ({ ...f, targetType: v }))}
                >
                  <SelectTrigger className="w-full h-8 text-xs">
                    <SelectValue placeholder="Select target" />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Message Template</label>
              <Textarea
                value={form.messageTemplate}
                onChange={(e) => setForm((f) => ({ ...f, messageTemplate: e.target.value }))}
                placeholder="Hi {{name}}, ..."
                rows={4}
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-xs text-foreground resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button size="sm" onClick={handleCreate}>Create Campaign</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Campaign list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-card border border-border animate-pulse" />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <EmptyState
              icon={IconSpeakerphone}
              title="No campaigns yet"
              description="Create your first outreach campaign to engage your agents."
              action={{ label: 'New Campaign', onClick: () => setShowCreate(true) }}
            />
          ) : (
            <div className="space-y-2">
              {campaigns.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-4 px-4 py-3 rounded-lg border border-border hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLES[c.status] ?? STATUS_STYLES.draft}`}>
                        {c.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {c.channel} · {c.targetType}
                      {c.sentCount > 0 ? ` · ${c.sentCount} sent` : ''}
                      {c.scheduledAt ? ` · Scheduled: ${new Date(c.scheduledAt).toLocaleString()}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {c.status === 'draft' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusChange(c.id, 'sent')}
                          >
                            <IconSend size={14} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Send now</TooltipContent>
                      </Tooltip>
                    )}
                    {c.status === 'active' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusChange(c.id, 'paused')}
                          >
                            <IconPlayerPause size={14} />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Pause</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(c.id)}
                          className="text-muted-foreground hover:text-red-400"
                        >
                          <IconTrash size={14} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </>
      )}
    </div>
  )
}
