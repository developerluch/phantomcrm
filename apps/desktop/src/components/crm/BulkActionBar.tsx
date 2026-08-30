import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import {
  IconTag,
  IconTagOff,
  IconArchive,
  IconFlag,
  IconX,
  IconUser,
  IconDownload,
} from '@tabler/icons-react'
import { TagPicker } from './TagPicker'
import { useBulkContacts, useExportContactsCsv } from '@/hooks/useContacts'
import { useAgents } from '@/hooks/useAgents'
import { Separator } from '@/components/ui/separator'
import { LIFECYCLE_STAGES, LIFECYCLE_STAGE_LABELS } from '@/types/portal'
import type { LifecycleStage, SmartListFilter } from '@/types/portal'

interface BulkActionBarProps {
  /** Filter that resolves to the current selection on the server. If you are
   *  selecting visible rows only, wrap their ids in an `id in [...]` rule. */
  filter: SmartListFilter | null
  count: number
  onClear: () => void
  isAdmin?: boolean
}

export function BulkActionBar({ filter, count, onClear, isAdmin }: BulkActionBarProps) {
  const [confirmArchive, setConfirmArchive] = useState(false)
  const bulk = useBulkContacts()
  const exportContacts = useExportContactsCsv()

  if (count === 0 || !filter) return null

  async function run(kind: Parameters<typeof bulk.mutateAsync>[0]['action'], payload?: Record<string, unknown>, successMsg?: string) {
    try {
      const res = await bulk.mutateAsync({ filter: filter!, action: kind, payload })
      toast.success(successMsg ?? `${res.affected} contact${res.affected === 1 ? '' : 's'} updated`)
      onClear()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bulk action failed')
    }
  }

  async function exportCsv() {
    try {
      // The caller passes a filter that resolves to the current selection.
      const blob = await exportContacts.mutateAsync(filter)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `contacts-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="bulk-bar"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40"
      >
        <div className="flex items-center gap-2 rounded-full border border-border/50 bg-card/95 backdrop-blur px-4 py-2 shadow-lg">
          <Badge className="bg-accent/20 text-accent-foreground hover:bg-accent/30">
            {count} selected
          </Badge>

          <Separator orientation="vertical" className="h-5 bg-border/50" />

          <TagPicker
            selected={[]}
            onToggle={(tag) => run('tag', { tag }, `Added "${tag}" to ${count} contact${count === 1 ? '' : 's'}`)}
            onCreate={(tag) => run('tag', { tag }, `Added "${tag}" to ${count} contact${count === 1 ? '' : 's'}`)}
            trigger={
              <Button variant="ghost" size="sm">
                <IconTag size={14} className="mr-1" /> Add Tag
              </Button>
            }
            align="center"
          />

          <TagPicker
            selected={[]}
            onToggle={(tag) => run('untag', { tag }, `Removed "${tag}" from ${count} contact${count === 1 ? '' : 's'}`)}
            trigger={
              <Button variant="ghost" size="sm">
                <IconTagOff size={14} className="mr-1" /> Remove Tag
              </Button>
            }
            align="center"
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <IconFlag size={14} className="mr-1" /> Set Stage
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              {LIFECYCLE_STAGES.map((stage) => (
                <DropdownMenuItem
                  key={stage}
                  onSelect={() =>
                    run('setLifecycle', { lifecycleStage: stage as LifecycleStage }, `Set stage → ${LIFECYCLE_STAGE_LABELS[stage]}`)
                  }
                >
                  {LIFECYCLE_STAGE_LABELS[stage]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {isAdmin && (
            <SetOwnerPopover
              onSelect={(discordId, name) =>
                run('setOwner', { ownerAgentDiscordId: discordId }, `Owner → ${name}`)
              }
            />
          )}

          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  DNC
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                <DropdownMenuItem onSelect={() => run('setDNC', { doNotSms: true })}>
                  Set Do Not SMS
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => run('setDNC', { doNotEmail: true })}>
                  Set Do Not Email
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => run('setDNC', { doNotCall: true })}>
                  Set Do Not Call
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button variant="ghost" size="sm" onClick={() => setConfirmArchive(true)}>
            <IconArchive size={14} className="mr-1" /> Archive
          </Button>

          <Separator orientation="vertical" className="h-5 bg-border/50" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => void exportCsv()}
            disabled={exportContacts.isPending}
          >
            <IconDownload size={14} className="mr-1" />
            {exportContacts.isPending ? 'Exporting...' : 'Export CSV'}
          </Button>

          <Button variant="ghost" size="icon" onClick={onClear}>
            <IconX size={14} />
          </Button>
        </div>

        <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Archive {count} contact{count === 1 ? '' : 's'}?</AlertDialogTitle>
              <AlertDialogDescription>
                Archive is a soft delete. An admin can restore later. No messages will be sent to
                archived contacts.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setConfirmArchive(false)
                  void run('archive', undefined, `Archived ${count} contact${count === 1 ? '' : 's'}`)
                }}
              >
                Archive
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Set Owner (admin-only) ─────────────────────────────────────────────

function SetOwnerPopover({
  onSelect,
}: {
  onSelect: (discordId: string, displayName: string) => void
}) {
  const [open, setOpen] = useState(false)
  const { data: agentsResp } = useAgents()
  const agents = (agentsResp?.agents ?? []).filter((a) => a.discord_id)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm">
          <IconUser size={14} className="mr-1" /> Set Owner
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="center">
        <Command>
          <CommandInput placeholder="Search agents…" />
          <CommandList>
            <CommandEmpty>No agents.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onSelect('', 'Unassigned')
                  setOpen(false)
                }}
              >
                Unassigned
              </CommandItem>
              {agents.map((a) => (
                <CommandItem
                  key={a.discord_id}
                  value={`${a.full_name ?? ''} ${a.discord_id}`}
                  onSelect={() => {
                    onSelect(a.discord_id, a.full_name?.trim() || a.discord_id)
                    setOpen(false)
                  }}
                >
                  {a.full_name?.trim() || a.discord_id}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
