import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  IconPlus,
  IconFilter,
  IconBookmark,
  IconSearch,
  IconAddressBook,
  IconDatabaseImport,
  IconDownload,
  IconX,
} from '@tabler/icons-react'
import { ContactsHeaderStats } from '@/components/crm/ContactsHeaderStats'
import { ContactsTable, type ContactsSort } from '@/components/crm/ContactsTable'
import { ContactDetailDrawer } from '@/components/crm/ContactDetailDrawer'
import { BulkActionBar } from '@/components/crm/BulkActionBar'
import { NewContactDialog } from '@/components/crm/NewContactDialog'
import { SaveSmartListDialog } from '@/components/crm/SaveSmartListDialog'
import { FilterBuilder } from '@/components/crm/FilterBuilder'
import { useContacts, useContactTags, useExportContactsCsv, useRunBackfill } from '@/hooks/useContacts'
import { useSmartLists, useSmartList } from '@/hooks/useSmartLists'
import { useBulkSelection } from '@/hooks/useBulkSelection'
import { useDebounce } from '@/hooks/useDebounce'
import { useAgents } from '@/hooks/useAgents'
import { useAuthStore } from '@/store'
import {
  LIFECYCLE_STAGES,
  LIFECYCLE_STAGE_LABELS,
  type FilterRule,
  type LifecycleStage,
  type SmartListFilter,
} from '@/types/portal'

const EMPTY_FILTER: SmartListFilter = { combinator: 'and', rules: [] }

function isCRMAdmin(permissions: string[] | undefined): boolean {
  if (!permissions) return false
  return permissions.includes('*') || permissions.includes('crm.admin')
}

export default function ContactsPage() {
  const params = useParams<{ id?: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const isAdmin = isCRMAdmin(user?.permissions)

  // The same :id slot backs two routes: /crm/contacts/:id (contact drawer) and
  // /crm/lists/:id (pre-apply smart list filter). Disambiguate by pathname.
  const isListView = location.pathname.startsWith('/crm/lists/')
  const smartListId = isListView ? params.id ?? null : null
  const drawerContactIdParam = isListView ? null : params.id ?? null

  // ── Top-bar state ──
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 250)
  const [stageFilter, setStageFilter] = useState<LifecycleStage | 'all'>('all')
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [filter, setFilter] = useState<SmartListFilter>(EMPTY_FILTER)
  const [showFilterBuilder, setShowFilterBuilder] = useState(false)
  const [newOpen, setNewOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [sort, setSort] = useState<ContactsSort | null>(null)

  // Agents list drives the Owner filter Select when admin. Non-admins never see
  // the Select, but the query is cheap and shared with other admin features.
  const { data: agentsResp } = useAgents()
  const agents = agentsResp?.agents ?? []
  const { data: tagStats } = useContactTags()
  const exportContacts = useExportContactsCsv()

  // Compose the effective filter from search + stage + owner + manual rules.
  const effectiveFilter: SmartListFilter | null = useMemo(() => {
    const rules: FilterRule[] = []
    if (debouncedSearch.trim()) {
      rules.push({ field: 'fullName', op: 'contains', value: debouncedSearch.trim() })
    }
    if (stageFilter !== 'all') {
      rules.push({ field: 'lifecycleStage', op: 'eq', value: stageFilter })
    }
    if (isAdmin && ownerFilter !== 'all') {
      rules.push({ field: 'ownerAgentDiscordId', op: 'eq', value: ownerFilter })
    }
    if (tagFilter !== 'all') {
      rules.push({ field: 'tags', op: 'hasTag', value: tagFilter })
    }
    const manualRules = filter.rules.filter(Boolean)
    if (rules.length === 0 && manualRules.length === 0) return null
    return {
      combinator: 'and',
      rules: [...rules, ...manualRules],
    }
  }, [debouncedSearch, stageFilter, ownerFilter, tagFilter, isAdmin, filter])

  const { data: page, isLoading } = useContacts({
    filter: effectiveFilter,
    limit: 500, // fetch up to cap; virtualization handles render
    sort: sort ? [{ field: sort.field, dir: sort.dir }] : undefined,
  })
  const contacts = page?.contacts ?? []
  const backfill = useRunBackfill()

  // When viewing /crm/lists/:id, hydrate the manual filter state from the
  // smart list on mount / when the id changes.
  const { data: activeSmartList } = useSmartList(smartListId)
  useEffect(() => {
    if (activeSmartList) setFilter(activeSmartList.filter)
    else if (!smartListId) setFilter(EMPTY_FILTER)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSmartList?.id, smartListId])

  function clearSmartListView() {
    setFilter(EMPTY_FILTER)
    navigate('/crm/contacts')
  }

  const { data: smartLists } = useSmartLists()
  const pinnedLists = (smartLists?.smartlists ?? []).filter((s) => s.isPinned)

  const selection = useBulkSelection(contacts)

  // Sync drawer open state with /crm/contacts/:id path.
  const drawerContactId = drawerContactIdParam

  function openContact(id: string) {
    navigate(`/crm/contacts/${encodeURIComponent(id)}`)
  }
  function closeDrawer() {
    navigate('/crm/contacts')
  }

  // Reset selection when query changes.
  useEffect(() => {
    selection.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, stageFilter, ownerFilter, tagFilter, filter])

  function handleRunBackfill() {
    backfill.mutate(
      { dryRun: false },
      {
        onSuccess: () => toast.success('Backfill started. New contacts will appear shortly.'),
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Backfill failed'),
      },
    )
  }

  function downloadCsv(blob: Blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contacts-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function handleExportContacts() {
    exportContacts.mutate(effectiveFilter, {
      onSuccess: (blob) => {
        downloadCsv(blob)
        toast.success('Export downloaded')
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Export failed'),
    })
  }

  // For bulk actions, the server-side filter IS the selection. We embed the
  // currently-selected ids as an `id in [...]` rule that composes with the
  // existing filter so the same visibility predicate runs server-side.
  const bulkFilter: SmartListFilter | null = useMemo(() => {
    if (selection.count === 0) return null
    const base = effectiveFilter ?? { combinator: 'and', rules: [] as FilterRule[] }
    return {
      combinator: 'and',
      rules: [
        ...base.rules,
        { field: 'id', op: 'in', value: selection.selectedIds },
      ],
    }
  }, [effectiveFilter, selection.count, selection.selectedIds])

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="sticky top-0 z-30 -mx-6 flex-shrink-0 space-y-4 border-b border-border/40 bg-background/80 px-6 pt-6 pb-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] max-w-[360px] flex-1">
            <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, phone..."
              className="pl-9"
            />
          </div>

          <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as LifecycleStage | 'all')}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All stages" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {LIFECYCLE_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {LIFECYCLE_STAGE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="All tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {(tagStats ?? []).map((tag) => (
                <SelectItem key={tag.tag} value={tag.tag}>
                  {tag.tag} ({tag.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isAdmin && (
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All owners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All owners</SelectItem>
                {agents
                  .filter((a) => a.discord_id)
                  .map((a) => (
                    <SelectItem key={a.discord_id} value={a.discord_id}>
                      {a.full_name?.trim() || a.discord_id}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}

          <Button
            variant={showFilterBuilder ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowFilterBuilder((v) => !v)}
          >
            <IconFilter size={14} className="mr-1" /> Filter
            {filter.rules.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {filter.rules.length}
              </Badge>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <IconBookmark size={14} className="mr-1" /> Saved Lists
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Pinned</DropdownMenuLabel>
              {pinnedLists.length === 0 && (
                <DropdownMenuItem disabled>No pinned lists yet</DropdownMenuItem>
              )}
              {pinnedLists.map((sl) => (
                <DropdownMenuItem key={sl.id} onSelect={() => navigate(`/crm/lists/${sl.id}`)}>
                  {sl.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate('/crm/lists')}>
                Manage smart lists...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportContacts}
              disabled={exportContacts.isPending}
            >
              <IconDownload size={14} className="mr-1" />
              {exportContacts.isPending ? 'Exporting...' : 'Export CSV'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSaveOpen(true)}
              disabled={!effectiveFilter}
            >
              Save as Smart List
            </Button>
            <Button variant="brand" size="sm" onClick={() => setNewOpen(true)}>
              <IconPlus size={14} className="mr-1" /> New Contact
            </Button>
          </div>
        </div>

        {activeSmartList && (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 pr-1">
              Viewing: {activeSmartList.name}
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 h-5 w-5"
                aria-label="Clear smart list"
                onClick={clearSmartListView}
              >
                <IconX size={10} />
              </Button>
            </Badge>
            {activeSmartList.description && (
              <p className="text-xs text-muted-foreground">{activeSmartList.description}</p>
            )}
          </div>
        )}

        {showFilterBuilder && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-lg border border-border/50 bg-card/40 p-4 backdrop-blur"
          >
            <FilterBuilder value={filter} onChange={setFilter} />
          </motion.div>
        )}

        <ContactsHeaderStats contacts={contacts} />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pt-4 pr-1">
        {!isLoading && contacts.length === 0 && !effectiveFilter ? (
          <Card className="bg-card/50 backdrop-blur">
            <CardHeader className="items-center gap-2 text-center">
              <div className="rounded-full bg-accent/10 p-3">
                <IconAddressBook size={32} className="text-accent-foreground" />
              </div>
              <CardTitle>No contacts yet</CardTitle>
              <CardDescription>
                Run backfill to import existing recruits, sales, and agent leads into the CRM,
                or create your first contact manually.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-center gap-2">
              {isAdmin && (
                <Button
                  variant="outline"
                  onClick={handleRunBackfill}
                  disabled={backfill.isPending}
                >
                  <IconDatabaseImport size={14} className="mr-1" />
                  {backfill.isPending ? 'Running...' : 'Run Backfill'}
                </Button>
              )}
              <Button variant="brand" onClick={() => setNewOpen(true)}>
                <IconPlus size={14} className="mr-1" /> Add Contact
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ContactsTable
            contacts={contacts}
            isLoading={isLoading}
            selectedIds={selection.selected}
            onToggleId={selection.toggle}
            onSelectAll={selection.selectAll}
            onClear={selection.clear}
            allSelected={selection.allSelected}
            someSelected={selection.someSelected}
            onRowClick={openContact}
            sort={sort}
            onSortChange={setSort}
          />
        )}
      </div>

      <BulkActionBar
        filter={bulkFilter}
        count={selection.count}
        onClear={selection.clear}
        isAdmin={isAdmin}
      />

      <NewContactDialog open={newOpen} onOpenChange={setNewOpen} onCreated={openContact} />
      <SaveSmartListDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        filter={effectiveFilter ?? EMPTY_FILTER}
        isAdmin={isAdmin}
      />
      <ContactDetailDrawer contactId={drawerContactId} onClose={closeDrawer} isAdmin={isAdmin} />
    </div>
  )
}
