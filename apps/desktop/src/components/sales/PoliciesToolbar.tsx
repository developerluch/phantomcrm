import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfWeek, endOfWeek, subWeeks } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import {
  IconBriefcase,
  IconCalendar,
  IconSearch,
  IconX,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Separator } from '@/components/ui/separator'
import { SALE_STATUSES } from '../../types/portal'

export type SubmitBusinessMode = 'manual' | 'import'
const RECENT_SEARCHES_KEY = 'phantom.policy.searches.v1'

interface PoliciesToolbarProps {
  searchValue: string
  onSearchChange: (v: string) => void

  statusFilter: string
  onStatusFilterChange: (v: string) => void

  agentFilter: string
  onAgentFilterChange: (v: string) => void

  dateRange: DateRange | undefined
  onDateRangeChange: (r: DateRange | undefined) => void
  datePreset: string
  onDatePresetChange: (v: string) => void

  agents: Array<{ agentId: string; displayName: string; email?: string | null }>
  accountAgentId?: string
  agentsLoading?: boolean

  onSubmitBusiness: () => void
}

export default function PoliciesToolbar({
  searchValue,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  agentFilter,
  onAgentFilterChange,
  dateRange,
  onDateRangeChange,
  datePreset,
  onDatePresetChange,
  agents,
  accountAgentId,
  agentsLoading = false,
  onSubmitBusiness,
}: PoliciesToolbarProps) {
  const searchRef = useRef<HTMLInputElement>(null)
  const [searchFocused, setSearchFocused] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string').slice(0, 5) : []
    } catch {
      return []
    }
  })

  const datePresets = [
    { label: 'All Time', value: 'all', range: undefined as DateRange | undefined },
    {
      label: 'This Week',
      value: 'This Week',
      range: { from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) },
    },
    {
      label: 'Last Week',
      value: 'Last Week',
      range: {
        from: startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }),
        to: endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 }),
      },
    },
    {
      label: 'This Month',
      value: 'This Month',
      range: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
    },
    {
      label: 'This Year',
      value: 'This Year',
      range: { from: startOfYear(new Date()), to: endOfYear(new Date()) },
    },
  ]

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (statusFilter) count++
    if (agentFilter !== 'all') count++
    if (datePreset !== 'all') count++
    return count
  }, [agentFilter, datePreset, statusFilter])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable
      if (event.key === '/' && !isTyping) {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const rememberSearch = (value: string) => {
    const query = value.trim()
    if (!query) return
    const next = [query, ...recentSearches.filter((item) => item.toLowerCase() !== query.toLowerCase())].slice(0, 5)
    setRecentSearches(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next))
    }
  }

  const clearFilters = () => {
    onStatusFilterChange('')
    onAgentFilterChange('all')
    onDatePresetChange('all')
    onDateRangeChange(undefined)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="group relative max-w-sm flex-1 transition-[max-width] duration-300 focus-within:max-w-md">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition-colors duration-200 group-focus-within:text-primary" />
        <Input
          ref={searchRef}
          placeholder="Search client name or policy #"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => {
            rememberSearch(searchValue)
            window.setTimeout(() => setSearchFocused(false), 120)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') rememberSearch(searchValue)
            if (event.key === 'Escape') {
              onSearchChange('')
              searchRef.current?.blur()
            }
          }}
          className="h-10 bg-card/50 border-border/50 pl-9 pr-16"
        />
        {searchValue && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-8 top-1/2 h-6 w-6 -translate-y-1/2"
            onClick={() => {
              onSearchChange('')
              searchRef.current?.focus()
            }}
            aria-label="Clear search"
          >
            <IconX size={13} />
          </Button>
        )}
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border/70 bg-background/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          /
        </kbd>
        <AnimatePresence>
          {searchFocused && recentSearches.length > 0 && !searchValue && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="absolute left-0 top-[calc(100%+0.5rem)] z-40 w-full rounded-xl border border-border/70 bg-popover/95 p-2 shadow-xl backdrop-blur"
            >
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recent searches</p>
              {recentSearches.map((query) => (
                <Button
                  key={query}
                  type="button"
                  variant="ghost"
                  className="block h-auto w-full rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-accent"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onSearchChange(query)
                    rememberSearch(query)
                  }}
                >
                  {query}
                </Button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Select
        value={statusFilter || '_all'}
        onValueChange={(v) => onStatusFilterChange(v === '_all' ? '' : v)}
      >
        <SelectTrigger className="w-36 h-10 text-sm bg-card/50 border-border/50">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="_all">All statuses</SelectItem>
          {SALE_STATUSES.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={agentFilter} onValueChange={onAgentFilterChange}>
        <SelectTrigger className="w-44 h-10 text-sm bg-card/50 border-border/50">
          <SelectValue placeholder="All Agents" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Agents</SelectItem>
          <SelectItem value="mine" disabled={!accountAgentId}>
            {accountAgentId ? 'My Business' : 'My Business unavailable'}
          </SelectItem>
          {agents.map((a) => (
            <SelectItem key={a.agentId} value={a.agentId}>
              {a.displayName || a.email || a.agentId.slice(0, 8)}
            </SelectItem>
          ))}
          {agentsLoading && <SelectItem value="_loading" disabled>Loading agents...</SelectItem>}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-10 text-sm bg-card/50 border-border/50 gap-1.5 transition-transform duration-150 active:scale-[0.98]">
            <IconCalendar size={14} />
            {datePreset === 'all'
              ? 'All Time'
              : datePreset === 'custom' && dateRange?.from
                ? `${format(dateRange.from, 'MMM d')}${dateRange.to ? ` – ${format(dateRange.to, 'MMM d')}` : ''}`
                : datePreset}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            <div className="border-r border-border/50 p-2 space-y-1 min-w-[140px]">
              {datePresets.map((preset) => (
                <Button
                  key={preset.value}
                  variant={datePreset === preset.value ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start text-xs h-8"
                  onClick={() => {
                    onDatePresetChange(preset.value)
                    onDateRangeChange(preset.range)
                  }}
                >
                  {preset.label}
                </Button>
              ))}
              <Separator className="my-1" />
              <Button
                variant={datePreset === 'custom' ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-start text-xs h-8"
                onClick={() => onDatePresetChange('custom')}
              >
                Custom Range
              </Button>
              <Separator className="my-1" />
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs h-8"
                onClick={() => {
                  onDatePresetChange('all')
                  onDateRangeChange(undefined)
                }}
              >
                Clear date
              </Button>
            </div>
            {datePreset === 'custom' && (
              <div className="p-2">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => onDateRangeChange(range)}
                  numberOfMonths={2}
                  autoFocus
                />
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {activeFilterCount > 0 && (
        <Button variant="ghost" size="sm" className="h-10 gap-2 text-xs" onClick={clearFilters}>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{activeFilterCount}</Badge>
          Clear filters
        </Button>
      )}

      <Separator orientation="vertical" className="h-6 mx-1" />

      <Button size="sm" className="h-10 text-sm transition-transform duration-150 active:scale-[0.98]" onClick={onSubmitBusiness}>
        <IconBriefcase size={14} className="mr-1.5" />
        Submit Business
      </Button>
    </div>
  )
}
