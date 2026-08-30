import { useGuildStore } from '../../store/guild-store'
import { useServers } from '../../hooks/useServers'
import { IconServer, IconChevronDown, IconCheck } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command'

export default function GuildSelector() {
  const { data: servers = [] } = useServers()
  const { selectedGuildId, selectGuild, setServers } = useGuildStore()
  const [open, setOpen] = useState(false)

  // Sync servers from API into guild store
  useEffect(() => {
    if (servers.length > 0) {
      setServers(servers)
    }
  }, [servers, setServers])

  const selected = servers.find((s) => s.id === selectedGuildId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 px-3 py-1.5 h-auto rounded-lg bg-card/50 hover:bg-card transition-colors text-sm">
          {selected?.iconUrl ? (
            <img src={selected.iconUrl} alt="" className="w-5 h-5 rounded object-cover" />
          ) : (
            <IconServer size={14} className="text-muted-foreground" />
          )}
          <span className="text-foreground font-medium max-w-[140px] truncate">
            {selected?.guildName ?? 'All Guilds'}
          </span>
          <IconChevronDown size={14} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="end">
        <Command>
          <CommandInput placeholder="Search servers..." />
          <CommandList>
            <CommandEmpty>No servers found.</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={() => { selectGuild(null); setOpen(false) }}>
                <IconServer size={14} className="text-muted-foreground" />
                <span>All Guilds</span>
                {!selectedGuildId && <IconCheck size={14} className="ml-auto text-primary" />}
              </CommandItem>
              {servers.map((server) => (
                <CommandItem key={server.id} value={server.guildName} onSelect={() => { selectGuild(server.id); setOpen(false) }}>
                  {server.iconUrl ? (
                    <img src={server.iconUrl} alt="" className="w-5 h-5 rounded object-cover" />
                  ) : (
                    <IconServer size={14} className="text-muted-foreground" />
                  )}
                  <span className="truncate">{server.guildName}</span>
                  {selectedGuildId === server.id && <IconCheck size={14} className="ml-auto text-primary" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
