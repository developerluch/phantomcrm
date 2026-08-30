import { useState } from 'react'
import { useServers, useCreateServer, useDeleteServer, useServerInviteLink } from '../hooks/useServers'
import { toast } from 'sonner'
import {
  IconServer,
  IconPlus,
  IconTrash,
  IconLink,
  IconLoader2,
  IconCopy,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

export default function ServersPage() {
  const { data: servers = [], isLoading, isError } = useServers()
  const createServer = useCreateServer()
  const deleteServer = useDeleteServer()
  const getInviteLink = useServerInviteLink()

  const [showAdd, setShowAdd] = useState(false)
  const [guildId, setGuildId] = useState('')
  const [guildName, setGuildName] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!guildId.trim() || !guildName.trim() || !ownerId.trim()) return
    createServer.mutate(
      { discordGuildId: guildId.trim(), guildName: guildName.trim(), ownerDiscordId: ownerId.trim() },
      {
        onSuccess: () => {
          toast.success('Server registered')
          setShowAdd(false)
          setGuildId('')
          setGuildName('')
          setOwnerId('')
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to register'),
      }
    )
  }

  const handleGetInvite = (servGuildId?: string) => {
    getInviteLink.mutate(servGuildId, {
      onSuccess: (data) => {
        setInviteUrl(data.url)
        navigator.clipboard.writeText(data.url).then(() => toast.success('Invite link copied'))
      },
      onError: () => toast.error('Failed to get invite link'),
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-8 w-36 bg-muted rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted/30 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Failed to load servers.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Servers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage connected Discord servers</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => handleGetInvite()} disabled={getInviteLink.isPending}>
            {getInviteLink.isPending ? <IconLoader2 size={14} className="animate-spin mr-1" /> : <IconLink size={14} className="mr-1" />}
            Bot Invite Link
          </Button>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
            <IconPlus size={16} className="mr-1.5" />
            Register Server
          </Button>
        </div>
      </div>

      {/* Invite URL display */}
      {inviteUrl && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card/50">
          <p className="text-xs text-muted-foreground flex-1 truncate font-mono">{inviteUrl}</p>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => { navigator.clipboard.writeText(inviteUrl); toast.success('Copied') }}
            className="text-muted-foreground hover:text-foreground transition-colors h-6 w-6"
          >
            <IconCopy size={14} />
          </Button>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <form onSubmit={handleCreate} className="rounded-xl border border-border p-4 space-y-3" style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
          <p className="text-sm font-semibold text-foreground">Register Discord Server</p>
          <div className="grid grid-cols-3 gap-3">
            <Input value={guildId} onChange={(e) => setGuildId(e.target.value)} placeholder="Discord Guild ID *" />
            <Input value={guildName} onChange={(e) => setGuildName(e.target.value)} placeholder="Server Name *" />
            <Input value={ownerId} onChange={(e) => setOwnerId(e.target.value)} placeholder="Owner Discord ID *" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={createServer.isPending || !guildId.trim() || !guildName.trim() || !ownerId.trim()}>
              {createServer.isPending ? <IconLoader2 size={14} className="animate-spin mr-1" /> : null}
              Register
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </form>
      )}

      {/* Server list */}
      <div className="space-y-3">
        {servers.map((server) => (
          <div
            key={server.id}
            className="rounded-xl border border-border p-4 flex items-center gap-4"
            style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}
          >
            {server.iconUrl ? (
              <img src={server.iconUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <IconServer size={18} className="text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{server.guildName}</p>
              <p className="text-xs text-muted-foreground font-mono">{server.discordGuildId}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={server.isActive ? 'success' : 'secondary'} className="text-[10px]">
                {server.isActive ? 'Active' : 'Inactive'}
              </Badge>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleGetInvite(server.discordGuildId)}
                    className="text-muted-foreground hover:text-blue-400 transition-colors h-6 w-6"
                  >
                    <IconLink size={14} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Get invite link</TooltipContent>
              </Tooltip>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteServer.mutate(server.id, {
                  onSuccess: () => toast.success('Server removed'),
                  onError: () => toast.error('Failed to remove'),
                })}
                className="text-muted-foreground hover:text-red-400 transition-colors h-6 w-6"
              >
                <IconTrash size={14} />
              </Button>
            </div>
          </div>
        ))}
        {servers.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <IconServer size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No servers registered</p>
          </div>
        )}
      </div>
    </div>
  )
}
