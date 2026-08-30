import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { IconFilter, IconLoader2, IconPlus, IconSearch } from '@tabler/icons-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useConversations } from '@/hooks/useConversations'
import { useDebounce } from '@/hooks/useDebounce'
import type { Channel, ConversationStatus } from '@/types/portal'
import {
  CHANNEL_ICON,
  CHANNEL_LABEL,
  CHANNEL_ORDER,
  CHANNEL_TINT,
} from './channel-tint'
import { ThreadList } from './ThreadList'
import { isMockMode, disableMockMode } from './inbox-mock-mode'

type StatusChip = 'unread' | 'open' | 'snoozed' | 'closed'
type SortKey = 'latest' | 'oldest' | 'unread-first'

interface ThreadListPanelProps {
  selectedId: string | undefined
  onSelect: (id: string) => void
}

const chipClass =
  'cursor-pointer transition-[colors,transform] duration-150 ease-out motion-reduce:transition-none motion-reduce:transform-none active:scale-[0.97] data-[state=on]:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
const MVP_CHANNELS: Channel[] = CHANNEL_ORDER.filter((channel) => channel === 'sms' || channel === 'email')

export function ThreadListPanel({ selectedId, onSelect }: ThreadListPanelProps) {
  const [chip, setChip] = useState<StatusChip>('open')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('latest')
  const [channels, setChannels] = useState<Channel[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)

  // 'Unread' is a virtual filter: status=open + client-side unreadCount>0.
  const statuses: ConversationStatus[] = useMemo(
    () => (chip === 'unread' ? ['open'] : [chip]),
    [chip],
  )
  const unreadOnly = chip === 'unread'

  const debouncedSearch = useDebounce(search, 200)
  const queryClient = useQueryClient()
  const { isFetching } = useConversations({
    channel: channels[0],
    status: statuses[0],
    limit: 100,
  })
  const mockActive = isMockMode()

  const resetFilters = () => {
    setChip('open')
    setChannels([])
    setSearch('')
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setLastSelectedId(null)
  }

  // Bulk selection is scoped to a filter/sort context — when any dimension
  // changes, prior IDs may no longer be in the visible result set, so clear.
  useEffect(() => {
    clearSelection()
  }, [chip, debouncedSearch, channels, sort])

  return (
    <Card className="flex h-full flex-col gap-3 rounded-none border-0 border-r border-border/50 bg-card/30 p-3 backdrop-blur">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Filter
        </p>
        <ToggleGroup
          type="single"
          value={chip}
          onValueChange={(v) => v && setChip(v as StatusChip)}
          className="justify-start"
        >
          <ToggleGroupItem value="unread" size="sm" className={chipClass}>
            Unread
          </ToggleGroupItem>
          <ToggleGroupItem value="open" size="sm" className={chipClass}>
            Open
          </ToggleGroupItem>
          <ToggleGroupItem value="snoozed" size="sm" className={chipClass}>
            Snoozed
          </ToggleGroupItem>
          <ToggleGroupItem value="closed" size="sm" className={chipClass}>
            Closed
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <IconSearch className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="h-9 pl-8 pr-7"
          />
          {(search !== debouncedSearch || (search && isFetching)) && (
            <IconLoader2
              className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-hidden
            />
          )}
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Filter channels">
              <IconFilter className="size-[1.125rem]" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-56 space-y-2 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
          >
            {MVP_CHANNELS.map((ch) => {
              const Icon = CHANNEL_ICON[ch]
              return (
                <label
                  key={ch}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-1 py-0.5 text-sm focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-popover hover:bg-accent/40"
                >
                  <Checkbox
                    checked={channels.includes(ch)}
                    onCheckedChange={(v) =>
                      setChannels((prev) =>
                        v ? [...prev, ch] : prev.filter((c) => c !== ch),
                      )
                    }
                  />
                  <Icon className="size-3.5" style={{ color: CHANNEL_TINT[ch] }} />
                  {CHANNEL_LABEL[ch]}
                </label>
              )
            })}
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-center"
              onClick={() => setChannels([])}
            >
              Clear
            </Button>
          </PopoverContent>
        </Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="New conversation"
              onClick={() => toast.info('New conversation — coming in M2B', {
                description: 'For now, conversations are created by inbound messages.',
              })}
            >
              <IconPlus className="size-[1.125rem]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New conversation</TooltipContent>
        </Tooltip>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          Sort by
        </p>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="latest" className="hover:bg-accent hover:text-accent-foreground cursor-pointer">Latest activity</SelectItem>
            <SelectItem value="oldest" className="hover:bg-accent hover:text-accent-foreground cursor-pointer">Oldest</SelectItem>
            <SelectItem value="unread-first" className="hover:bg-accent hover:text-accent-foreground cursor-pointer">Unread first</SelectItem>
          </SelectContent>
        </Select>
        {mockActive && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              disableMockMode()
              queryClient.invalidateQueries({ queryKey: ['crm', 'conversations', 'list'] })
            }}
            className="mt-2 h-auto self-start p-0"
            aria-label="Disable mock data"
          >
            <Badge variant="secondary" className="cursor-pointer">
              Mock data — click to disable
            </Badge>
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <ThreadList
          channels={channels}
          statuses={statuses}
          search={debouncedSearch}
          sort={sort}
          unreadOnly={unreadOnly}
          selectedId={selectedId}
          onSelect={onSelect}
          onClearFilters={resetFilters}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          lastSelectedId={lastSelectedId}
          setLastSelectedId={setLastSelectedId}
          onClearSelection={clearSelection}
        />
      </div>
    </Card>
  )
}
