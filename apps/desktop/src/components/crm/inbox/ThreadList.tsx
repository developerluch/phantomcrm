import { useRef, useMemo, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useQueryClient } from '@tanstack/react-query'
import { IconInbox } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useConversations } from '@/hooks/useConversations'
import type { Channel, Conversation, ConversationStatus } from '@/types/portal'
import { loadInboxScroll, saveInboxScroll } from './inbox-scroll-store'
import { enableMockMode } from './inbox-mock-mode'
import { ThreadRow } from './ThreadRow'
import { BulkActionBar } from './BulkActionBar'
import type { TriState } from './IndeterminateCheckbox'

interface ThreadListProps {
  channels: Channel[]
  statuses: ConversationStatus[]
  search: string
  sort: 'latest' | 'oldest' | 'unread-first'
  unreadOnly: boolean
  selectedId: string | undefined
  onSelect: (id: string) => void
  onClearFilters: () => void
  selectedIds: Set<string>
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>
  lastSelectedId: string | null
  setLastSelectedId: React.Dispatch<React.SetStateAction<string | null>>
  onClearSelection: () => void
}

/** Virtualized list of conversations sorted by last_inbound_at DESC.
 *  Filter dimensions are passed in from the parent so the page owns
 *  filter state; the hook below caches per-filter combination.
 *  Search, sort, and unread-only refinement happen client-side on the
 *  server-returned page — the backend list endpoint doesn't take them. */
export function ThreadList({
  channels,
  statuses,
  search,
  sort,
  unreadOnly,
  selectedId,
  onSelect,
  onClearFilters,
  selectedIds,
  setSelectedIds,
  lastSelectedId,
  setLastSelectedId,
  onClearSelection,
}: ThreadListProps) {
  // The list endpoint takes a single channel + status filter (cursor
  // pagination on the union is not in scope for M2A). When the user
  // selects multiple channels, we union client-side by re-issuing the
  // query per channel. For M2A scope we just send the first selected
  // value if any — multi-select hits the same backend filter as
  // single-select with one channel; the wider use-case (truly OR'd
  // multi-select across channels) is M2B.
  const channel = channels[0]
  const status = statuses[0]
  const queryClient = useQueryClient()
  const { data, isLoading } = useConversations({
    channel,
    status,
    limit: 100,
  })

  const items = useMemo<Conversation[]>(() => {
    let rows = data?.conversations ?? []
    if (unreadOnly) rows = rows.filter((c) => c.unreadCount > 0)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter((c) => c.contactId.toLowerCase().includes(q))
    }
    if (sort === 'oldest') {
      rows = [...rows].sort(
        (a, b) =>
          new Date(a.lastInboundAt ?? 0).getTime() -
          new Date(b.lastInboundAt ?? 0).getTime(),
      )
    } else if (sort === 'unread-first') {
      rows = [...rows].sort((a, b) => b.unreadCount - a.unreadCount)
    }
    // 'latest' = backend order, no client-side reorder.
    return rows
  }, [data, unreadOnly, search, sort])

  const totalVisible = items.length
  const selectAllState: TriState =
    selectedIds.size === 0
      ? false
      : selectedIds.size >= totalVisible && totalVisible > 0
        ? true
        : 'indeterminate'

  const toggleSelectAll = () => {
    if (selectedIds.size >= totalVisible && totalVisible > 0) {
      setSelectedIds(new Set())
      setLastSelectedId(null)
    } else {
      setSelectedIds(new Set(items.map((c) => c.id)))
    }
  }

  const toggleCheck = (id: string, e: { shiftKey: boolean }) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (e.shiftKey && lastSelectedId) {
        const lastIdx = items.findIndex((c) => c.id === lastSelectedId)
        const currIdx = items.findIndex((c) => c.id === id)
        if (lastIdx >= 0 && currIdx >= 0) {
          const [lo, hi] = lastIdx < currIdx ? [lastIdx, currIdx] : [currIdx, lastIdx]
          for (let i = lo; i <= hi; i++) next.add(items[i].id)
          return next
        }
      }
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setLastSelectedId(id)
  }

  const parentRef = useRef<HTMLDivElement | null>(null)
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 8,
  })

  useEffect(() => {
    const el = parentRef.current
    if (!el) return
    const saved = loadInboxScroll()
    let raf = 0
    if (saved > 0) {
      // Defer one frame so the virtualizer measures before the browser clamps scrollTop.
      raf = requestAnimationFrame(() => {
        raf = 0
        if (el.scrollHeight >= saved) el.scrollTop = saved
      })
    }
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        saveInboxScroll(el.scrollTop)
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-2 p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    // Empty-state distinguishes "no data at all" vs "filtered out
    // everything." When the user has no filter narrowing applied, this
    // is a fresh-install state — give them an inviting, instructive
    // panel instead of a one-line stub.
    const hasActiveFilter = channels.length > 0 || statuses.length > 1 || search.trim().length > 0
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-card/60 text-muted-foreground">
          <IconInbox size={22} />
        </div>
        {hasActiveFilter ? (
          <>
            <p className="text-sm font-medium text-foreground/90">
              No conversations match
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Try clearing channel filters or switching status to see more threads.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="mt-2 cursor-pointer"
            >
              Clear filters
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground/90">
              Inbox is empty
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Inbound messages from connected SMS, WhatsApp, email, and voice channels will appear here.
            </p>
            {import.meta.env.DEV && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 cursor-pointer"
                onClick={() => {
                  enableMockMode()
                  queryClient.invalidateQueries({ queryKey: ['crm', 'conversations', 'list'] })
                }}
              >
                Show mock data (dev)
              </Button>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-1">
      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIds.size}
          totalVisible={totalVisible}
          selectAllState={selectAllState}
          onToggleSelectAll={toggleSelectAll}
          onClearSelection={onClearSelection}
        />
      )}
      <div ref={parentRef} className="custom-scrollbar h-full overflow-y-auto">
        <div
          style={{
            height: rowVirtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((vi) => {
            const conv = items[vi.index]
            return (
              <div
                key={conv.id}
                className="absolute left-0 top-0 w-full"
                style={{
                  height: vi.size,
                  transform: `translateY(${vi.start}px)`,
                }}
              >
                <ThreadRow
                  conversation={conv}
                  selected={selectedId === conv.id}
                  isChecked={selectedIds.has(conv.id)}
                  bulkActive={selectedIds.size > 0}
                  onSelect={() => onSelect(conv.id)}
                  onToggleCheck={(e) => toggleCheck(conv.id, e)}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
