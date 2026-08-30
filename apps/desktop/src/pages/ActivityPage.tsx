import { useState } from 'react'
import { useActivityLog, useSendAnnouncement } from '../hooks/useActivity'
import { toast } from 'sonner'
import {
  IconActivity,
  IconUserPlus,
  IconArrowRight,
  IconMessage,
  IconSend,
  IconLoader2,
  IconSpeakerphone,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const ACTION_ICONS: Record<string, typeof IconActivity> = {
  agent_created: IconUserPlus,
  stage_change: IconArrowRight,
  message_sent: IconMessage,
}

export default function ActivityPage() {
  const [guildFilter, setGuildFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [showAnnounce, setShowAnnounce] = useState(false)
  const [announceGuildId, setAnnounceGuildId] = useState('')
  const [announceChannelId, setAnnounceChannelId] = useState('')
  const [announceMessage, setAnnounceMessage] = useState('')

  const { data: activities = [], isLoading, isError } = useActivityLog({
    guild_id: guildFilter || undefined,
    action_type: actionFilter || undefined,
  })

  const sendAnnouncement = useSendAnnouncement()

  const handleSendAnnouncement = () => {
    if (!announceGuildId.trim() || !announceChannelId.trim() || !announceMessage.trim()) return
    sendAnnouncement.mutate(
      { guildId: announceGuildId.trim(), channelId: announceChannelId.trim(), message: announceMessage.trim() },
      {
        onSuccess: () => {
          toast.success('Announcement sent')
          setAnnounceMessage('')
          setShowAnnounce(false)
        },
        onError: () => toast.error('Failed to send announcement'),
      }
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-40 bg-muted rounded animate-pulse" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Failed to load activity log.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Activity Log</h1>
          <p className="text-sm text-muted-foreground mt-1">Recent activity across your organization</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAnnounce(!showAnnounce)}>
          <IconSpeakerphone size={16} className="mr-1.5" />
          Announce
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Input
          value={guildFilter}
          onChange={(e) => setGuildFilter(e.target.value)}
          placeholder="Filter by server ID..."
          className="w-48"
        />
        <Select value={actionFilter || "_all"} onValueChange={(v) => setActionFilter(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All actions</SelectItem>
            <SelectItem value="agent_created">Agent Created</SelectItem>
            <SelectItem value="stage_change">Stage Change</SelectItem>
            <SelectItem value="message_sent">Message Sent</SelectItem>
            <SelectItem value="sale_created">Sale Created</SelectItem>
            <SelectItem value="recruit_created">Recruit Created</SelectItem>
            <SelectItem value="license_added">License Added</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Announcement Form */}
      {showAnnounce && (
        <div className="rounded-xl border border-border p-4 space-y-3" style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
          <p className="text-sm font-semibold text-foreground">Send Announcement</p>
          <div className="grid grid-cols-2 gap-3">
            <Input value={announceGuildId} onChange={(e) => setAnnounceGuildId(e.target.value)} placeholder="Guild ID *" />
            <Input value={announceChannelId} onChange={(e) => setAnnounceChannelId(e.target.value)} placeholder="Channel ID *" />
          </div>
          <Textarea
            value={announceMessage}
            onChange={(e) => setAnnounceMessage(e.target.value)}
            placeholder="Announcement message..."
            className="w-full h-20 rounded-lg border border-border bg-muted text-sm text-foreground px-3 py-2 resize-none focus:outline-none focus:border-border"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSendAnnouncement} disabled={sendAnnouncement.isPending || !announceGuildId.trim() || !announceChannelId.trim() || !announceMessage.trim()}>
              {sendAnnouncement.isPending ? <IconLoader2 size={14} className="animate-spin mr-1" /> : <IconSend size={14} className="mr-1" />}
              Send
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAnnounce(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-1">
        {activities.map((entry) => {
          const Icon = ACTION_ICONS[entry.action] || IconActivity
          return (
            <div key={entry.id} className="flex items-start gap-3 py-3 border-b border-border/50">
              <div className="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center bg-muted shrink-0">
                <Icon size={14} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">{entry.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                  {entry.agent && (
                    <span className="text-[10px] text-muted-foreground">
                      by {entry.agent.firstName} {entry.agent.lastName}
                    </span>
                  )}
                  {entry.user && (
                    <span className="text-[10px] text-muted-foreground">
                      by {entry.user.name}
                    </span>
                  )}
                  {entry.guildId && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {entry.guildId.slice(0, 8)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {activities.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <IconActivity size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No activity recorded</p>
          </div>
        )}
      </div>
    </div>
  )
}
