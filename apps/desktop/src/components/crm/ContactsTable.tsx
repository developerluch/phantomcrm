import { useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { formatDistanceToNow } from 'date-fns'
import { IconArrowUp, IconArrowDown, IconArrowsSort } from '@tabler/icons-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { TagChips } from './TagPicker'
import { LIFECYCLE_STAGE_COLORS, LIFECYCLE_STAGE_LABELS, type Contact } from '@/types/portal'

const VIRTUALIZE_THRESHOLD = 200

export type ContactsSortDir = 'asc' | 'desc'
export type ContactsSortField =
  | 'fullName'
  | 'email'
  | 'lifecycleStage'
  | 'lastActivityAt'
  | 'createdAt'

export interface ContactsSort {
  field: ContactsSortField
  dir: ContactsSortDir
}

interface ContactsTableProps {
  contacts: Contact[]
  isLoading?: boolean
  selectedIds: Set<string>
  onToggleId: (id: string) => void
  onSelectAll: () => void
  onClear: () => void
  allSelected: boolean
  someSelected: boolean
  onRowClick?: (id: string) => void
  sort?: ContactsSort | null
  onSortChange?: (next: ContactsSort | null) => void
}

export function ContactsTable({
  contacts,
  isLoading,
  selectedIds,
  onToggleId,
  onSelectAll,
  onClear,
  allSelected,
  someSelected,
  onRowClick,
  sort,
  onSortChange,
}: ContactsTableProps) {
  const useVirtual = contacts.length > VIRTUALIZE_THRESHOLD

  const header = (
    <TableHeader className="sticky top-0 bg-card/80 backdrop-blur z-10">
      <TableRow>
        <TableHead className="w-[40px]">
          <Checkbox
            checked={allSelected}
            // When some rows are selected but not all, show a visually indeterminate
            // state via data-[state=indeterminate]. Radix's Checkbox accepts the string
            // but our local alias types it as boolean; cast narrowly.
            data-state={someSelected && !allSelected ? 'indeterminate' : undefined}
            onCheckedChange={(checked) => (checked ? onSelectAll() : onClear())}
            aria-label="Select all"
          />
        </TableHead>
        <SortableHead field="fullName" label="Name" sort={sort} onSortChange={onSortChange} />
        <SortableHead field="email" label="Email" sort={sort} onSortChange={onSortChange} />
        <TableHead>Phone</TableHead>
        <SortableHead field="lifecycleStage" label="Stage" sort={sort} onSortChange={onSortChange} />
        <TableHead>Tags</TableHead>
        <TableHead>Owner</TableHead>
        <SortableHead field="lastActivityAt" label="Last Activity" sort={sort} onSortChange={onSortChange} />
        <SortableHead field="createdAt" label="Created" sort={sort} onSortChange={onSortChange} align="right" />
      </TableRow>
    </TableHeader>
  )

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border/50 bg-card/50 backdrop-blur overflow-hidden">
        <Table>
          {header}
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i} aria-hidden>
                <TableCell className="w-[40px]">
                  <Skeleton className="h-4 w-4" />
                </TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (contacts.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-10 text-center border border-border/50 rounded-lg">
        No contacts match.
      </div>
    )
  }

  if (!useVirtual) {
    return (
      <div className="rounded-lg border border-border/50 bg-card/50 backdrop-blur overflow-hidden">
        <Table>
          {header}
          <TableBody>
            {contacts.map((c) => (
              <Row
                key={c.id}
                c={c}
                selected={selectedIds.has(c.id)}
                onToggle={onToggleId}
                onRowClick={onRowClick}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <VirtualTable
      contacts={contacts}
      header={header}
      selectedIds={selectedIds}
      onToggleId={onToggleId}
      onRowClick={onRowClick}
    />
  )
}

function Row({
  c,
  selected,
  onToggle,
  onRowClick,
}: {
  c: Contact
  selected: boolean
  onToggle: (id: string) => void
  onRowClick?: (id: string) => void
}) {
  const stageColor = LIFECYCLE_STAGE_COLORS[c.lifecycleStage]
  return (
    <TableRow
      className={cn(
        'cursor-pointer',
        selected && 'bg-accent/5',
      )}
      onClick={(e) => {
        const target = e.target as HTMLElement
        if (target.closest('[data-no-row-click]')) return
        onRowClick?.(c.id)
      }}
    >
      <TableCell data-no-row-click onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggle(c.id)}
          aria-label={`Select ${c.fullName}`}
        />
      </TableCell>
      <TableCell className="font-medium">{c.fullName || '—'}</TableCell>
      <TableCell className="text-muted-foreground">{c.email ?? '—'}</TableCell>
      <TableCell className="text-muted-foreground">{c.phone ?? '—'}</TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className="gap-1.5"
          style={{ borderColor: stageColor, color: stageColor }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: stageColor }}
          />
          {LIFECYCLE_STAGE_LABELS[c.lifecycleStage]}
        </Badge>
      </TableCell>
      <TableCell>
        <TagChips tags={c.tags} max={3} />
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {c.ownerAgentDiscordId ? truncateId(c.ownerAgentDiscordId) : '—'}
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {c.lastActivityAt
          ? formatDistanceToNow(new Date(c.lastActivityAt), { addSuffix: true })
          : '—'}
      </TableCell>
      <TableCell className="text-right text-muted-foreground text-xs">
        {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
      </TableCell>
    </TableRow>
  )
}

function truncateId(id: string): string {
  if (id.length <= 8) return id
  return id.slice(0, 6) + '…'
}

function VirtualTable({
  contacts,
  header,
  selectedIds,
  onToggleId,
  onRowClick,
}: {
  contacts: Contact[]
  header: React.ReactNode
  selectedIds: Set<string>
  onToggleId: (id: string) => void
  onRowClick?: (id: string) => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: contacts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  const padTop = useMemo(
    () => (virtualItems[0] ? virtualItems[0].start : 0),
    [virtualItems],
  )
  const padBottom = useMemo(
    () =>
      virtualItems.length
        ? totalSize - virtualItems[virtualItems.length - 1].end
        : 0,
    [virtualItems, totalSize],
  )

  return (
    <div
      ref={parentRef}
      className="rounded-lg border border-border/50 bg-card/50 backdrop-blur overflow-auto"
      style={{ maxHeight: '70vh' }}
    >
      <Table>
        {header}
        <TableBody>
          {padTop > 0 && (
            <TableRow style={{ height: padTop }}>
              <TableCell colSpan={9} className="p-0" />
            </TableRow>
          )}
          {virtualItems.map((v) => {
            const c = contacts[v.index]
            return (
              <Row
                key={c.id}
                c={c}
                selected={selectedIds.has(c.id)}
                onToggle={onToggleId}
                onRowClick={onRowClick}
              />
            )
          })}
          {padBottom > 0 && (
            <TableRow style={{ height: padBottom }}>
              <TableCell colSpan={9} className="p-0" />
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function SortableHead({
  field,
  label,
  sort,
  onSortChange,
  align,
}: {
  field: ContactsSortField
  label: string
  sort?: ContactsSort | null
  onSortChange?: (next: ContactsSort | null) => void
  align?: 'right'
}) {
  const active = sort?.field === field
  const dir = active ? sort!.dir : null

  function handleClick() {
    if (!onSortChange) return
    if (!active) return onSortChange({ field, dir: 'desc' })
    if (dir === 'desc') return onSortChange({ field, dir: 'asc' })
    // Tri-state: desc → asc → none.
    onSortChange(null)
  }

  const disabled = !onSortChange
  const Icon = active ? (dir === 'asc' ? IconArrowUp : IconArrowDown) : IconArrowsSort

  return (
    <TableHead
      className={align === 'right' ? 'text-right' : undefined}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          '-ml-3 h-auto px-2 py-1 gap-1 font-medium',
          align === 'right' && 'ml-auto',
          active ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        {label}
        <Icon size={12} className={cn(!active && 'opacity-40')} />
      </Button>
    </TableHead>
  )
}
