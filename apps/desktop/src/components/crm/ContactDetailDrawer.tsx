import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { IconCalendar, IconExternalLink } from '@tabler/icons-react'
import { toast } from 'sonner'
import { TagChips, TagPicker } from './TagPicker'
import { AddressRepeater } from './AddressRepeater'
import { ConversationsTab } from './inbox/ConversationsTab'
import {
  useContact,
  useUpdateContact,
  useAddContactTag,
  useRemoveContactTag,
} from '@/hooks/useContacts'
import { useAgents } from '@/hooks/useAgents'
import {
  LIFECYCLE_STAGES,
  LIFECYCLE_STAGE_LABELS,
  type Contact,
  type ContactAddress,
  type ContactStatus,
  type LifecycleStage,
} from '@/types/portal'
import { cn } from '@/lib/utils'

const TABS = [
  'overview',
  'addresses',
  'tags',
  'conversations',
  'activity',
  'custom',
  'linked',
] as const
type Tab = (typeof TABS)[number]

interface ContactDetailDrawerProps {
  contactId: string | null
  onClose: () => void
  isAdmin?: boolean
}

export function ContactDetailDrawer({ contactId, onClose, isAdmin }: ContactDetailDrawerProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const searchParams = new URLSearchParams(location.search)
  const initialTab = (searchParams.get('tab') as Tab) || 'overview'
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab) ? initialTab : 'overview')

  const { data: contact, isLoading } = useContact(contactId)

  // Sync ?tab= without adding a history entry.
  useEffect(() => {
    if (!contactId) return
    const params = new URLSearchParams(location.search)
    const current = params.get('tab') ?? 'overview'
    if (current !== tab) {
      params.set('tab', tab)
      navigate(`${location.pathname}?${params.toString()}`, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const open = contactId !== null

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-[640px] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle>{contact?.fullName || 'Loading…'}</SheetTitle>
          {contact && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{LIFECYCLE_STAGE_LABELS[contact.lifecycleStage]}</Badge>
              <Separator orientation="vertical" className="h-4" />
              <Badge variant="secondary" className="capitalize">
                {contact.sourceType.replace(/_/g, ' ')}
              </Badge>
              {contact.status === 'archived' && (
                <Badge variant="destructive" className="ml-2">
                  Archived
                </Badge>
              )}
            </div>
          )}
        </SheetHeader>

        {isLoading || !contact ? (
          <div className="space-y-4 p-2" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="h-9 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-9 w-32" />
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="addresses">Addresses</TabsTrigger>
              <TabsTrigger value="tags">Tags</TabsTrigger>
              <TabsTrigger value="conversations">Inbox</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
              <TabsTrigger value="linked">Linked</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="pt-4">
              <OverviewTab contact={contact} isAdmin={isAdmin} />
            </TabsContent>
            <TabsContent value="addresses" className="pt-4">
              <AddressesTab contact={contact} />
            </TabsContent>
            <TabsContent value="tags" className="pt-4">
              <TagsTab contact={contact} />
            </TabsContent>
            <TabsContent value="conversations" className="pt-4">
              <ConversationsTab contactId={contact.id} onClose={onClose} />
            </TabsContent>
            <TabsContent value="activity" className="pt-4">
              <ActivityTab />
            </TabsContent>
            <TabsContent value="custom" className="pt-4">
              <CustomFieldsTab contact={contact} />
            </TabsContent>
            <TabsContent value="linked" className="pt-4">
              <LinkedTab contact={contact} />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── Overview ────────────────────────────────────────────────────────────

function OverviewTab({ contact, isAdmin }: { contact: Contact; isAdmin?: boolean }) {
  const update = useUpdateContact()
  const [firstName, setFirstName] = useState(contact.firstName ?? '')
  const [lastName, setLastName] = useState(contact.lastName ?? '')
  const [email, setEmail] = useState(contact.email ?? '')
  const [phone, setPhone] = useState(contact.phone ?? '')
  const [dob, setDob] = useState<Date | undefined>(contact.dob ? parseISO(contact.dob) : undefined)
  const [lifecycleStage, setLifecycleStage] = useState<LifecycleStage>(contact.lifecycleStage)
  const [status, setStatus] = useState<ContactStatus>(contact.status)
  const [ownerAgentDiscordId, setOwner] = useState(contact.ownerAgentDiscordId ?? '')
  const [doNotSms, setDoNotSms] = useState(contact.doNotSms)
  const [doNotEmail, setDoNotEmail] = useState(contact.doNotEmail)
  const [doNotCall, setDoNotCall] = useState(contact.doNotCall)

  async function save() {
    try {
      await update.mutateAsync({
        id: contact.id,
        patch: {
          firstName: firstName || null,
          lastName: lastName || null,
          email: email || null,
          phone: phone || null,
          dob: dob ? format(dob, 'yyyy-MM-dd') : null,
          lifecycleStage,
          status,
          ownerAgentDiscordId: ownerAgentDiscordId || null,
          doNotSms,
          doNotEmail,
          doNotCall,
        },
      })
      toast.success('Saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">First name</Label>
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Last name</Label>
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>

      <div>
        <Label className="text-xs">Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Phone</Label>
          <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Date of birth</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !dob && 'text-muted-foreground',
                )}
              >
                <IconCalendar size={16} className="mr-2" />
                {dob ? format(dob, 'PP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dob} onSelect={setDob} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Lifecycle</Label>
          <Select value={lifecycleStage} onValueChange={(v) => setLifecycleStage(v as LifecycleStage)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LIFECYCLE_STAGES.map((s) => (
                <SelectItem key={s} value={s}>
                  {LIFECYCLE_STAGE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as ContactStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="do_not_contact">Do not contact</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isAdmin && <OwnerField value={ownerAgentDiscordId} onChange={setOwner} />}

      <div className="space-y-2 rounded-lg border border-border/50 p-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Do not SMS</Label>
          <Switch checked={doNotSms} onCheckedChange={setDoNotSms} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm">Do not email</Label>
          <Switch checked={doNotEmail} onCheckedChange={setDoNotEmail} />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm">Do not call</Label>
          <Switch checked={doNotCall} onCheckedChange={setDoNotCall} />
        </div>
      </div>

      <Button variant="brand" onClick={save} disabled={update.isPending}>
        {update.isPending ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  )
}

// ── Addresses ───────────────────────────────────────────────────────────

function AddressesTab({ contact }: { contact: Contact }) {
  const update = useUpdateContact()
  const [drafts, setDrafts] = useState<Partial<ContactAddress>[]>(contact.addresses ?? [])
  const [dirty, setDirty] = useState(false)

  // Reset local state when a different contact loads into the drawer.
  useEffect(() => {
    setDrafts(contact.addresses ?? [])
    setDirty(false)
  }, [contact.id, contact.addresses])

  async function save() {
    try {
      await update.mutateAsync({
        id: contact.id,
        patch: { addresses: drafts },
      })
      setDirty(false)
      toast.success('Addresses saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Address save failed')
    }
  }

  return (
    <div className="space-y-3">
      <AddressRepeater
        addresses={drafts}
        onChange={(next) => {
          setDrafts(next)
          setDirty(true)
        }}
      />
      <div className="flex justify-end">
        <Button
          variant="brand"
          onClick={save}
          disabled={!dirty || update.isPending}
        >
          {update.isPending ? 'Saving…' : 'Save addresses'}
        </Button>
      </div>
    </div>
  )
}

// ── Owner Select (admin-only) ──────────────────────────────────────────

function OwnerField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: agentsResp } = useAgents()
  const agents = agentsResp?.agents ?? []
  const knownOwner = agents.some((a) => a.discord_id === value)

  return (
    <div>
      <Label className="text-xs">Owner</Label>
      <Select
        value={value || 'unassigned'}
        onValueChange={(v) => onChange(v === 'unassigned' ? '' : v)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Unassigned" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {agents
            .filter((a) => a.discord_id)
            .map((a) => (
              <SelectItem key={a.discord_id} value={a.discord_id}>
                {a.full_name?.trim() || a.discord_id}
              </SelectItem>
            ))}
          {/* If the current owner isn't in the visible agent list (e.g. off-guild), surface the raw id. */}
          {value && !knownOwner && (
            <SelectItem value={value} className="font-mono text-xs">
              {value} (not in list)
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  )
}

// ── Tags ────────────────────────────────────────────────────────────────

function TagsTab({ contact }: { contact: Contact }) {
  const addTag = useAddContactTag()
  const removeTag = useRemoveContactTag()

  return (
    <div className="space-y-3">
      <TagChips
        tags={contact.tags}
        onRemove={(tag) => removeTag.mutate({ id: contact.id, tag })}
      />
      <TagPicker
        selected={contact.tags}
        onToggle={(tag) =>
          contact.tags.includes(tag)
            ? removeTag.mutate({ id: contact.id, tag })
            : addTag.mutate({ id: contact.id, tag })
        }
        onCreate={(tag) => addTag.mutate({ id: contact.id, tag })}
      />
    </div>
  )
}

// ── Activity (M3 placeholder) ───────────────────────────────────────────

function ActivityTab() {
  return (
    <Card className="bg-card/30 backdrop-blur">
      <CardHeader>
        <CardTitle className="text-base">Activity timeline</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {/* TODO(M3): mount <ContactActivityTimeline contactId={id} /> here when the
            tasks + events slice ships. */}
        Ships in M3 alongside tasks + events view.
      </CardContent>
    </Card>
  )
}

// ── Custom Fields ───────────────────────────────────────────────────────

function CustomFieldsTab({ contact }: { contact: Contact }) {
  const update = useUpdateContact()
  const [raw, setRaw] = useState(() => JSON.stringify(contact.customFields ?? {}, null, 2))
  const [error, setError] = useState<string | null>(null)

  async function save() {
    try {
      const parsed = JSON.parse(raw)
      setError(null)
      await update.mutateAsync({ id: contact.id, patch: { customFields: parsed } })
      toast.success('Custom fields saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON')
    }
  }

  return (
    <div className="space-y-3">
      <Label className="text-xs">Custom fields (JSON)</Label>
      <Textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={12} className="font-mono text-xs" />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button variant="outline" onClick={save} disabled={update.isPending}>
        {update.isPending ? 'Saving…' : 'Save JSON'}
      </Button>
    </div>
  )
}

// ── Linked Records ──────────────────────────────────────────────────────

function LinkedTab({ contact }: { contact: Contact }) {
  if (!contact.sourceId) {
    return (
      <p className="text-sm text-muted-foreground">No linked source record.</p>
    )
  }

  const typeLabel: Record<string, string> = {
    recruit: 'Recruit',
    sale: 'Sale',
    agent_lead: 'Agent Lead',
    manual: 'Manually created',
    import: 'Imported',
    inbound_message: 'Inbound message',
  }

  // Route mapping to the existing pages that own each source type.
  let route: string | null = null
  switch (contact.sourceType) {
    case 'recruit':
      route = `/recruits?highlight=${contact.sourceId}`
      break
    case 'sale':
      route = `/sales?highlight=${contact.sourceId}`
      break
    case 'agent_lead':
      // Agent-lead detail is surfaced inside /agents/{discordId} — fall back
      // to the owner if we have one.
      if (contact.ownerAgentDiscordId) {
        route = `/agents/${contact.ownerAgentDiscordId}?lead=${contact.sourceId}`
      }
      break
    default:
      route = null
  }

  return (
    <Card className="bg-card/30 backdrop-blur">
      <CardContent className="p-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase text-muted-foreground">{typeLabel[contact.sourceType] ?? contact.sourceType}</div>
          <div className="text-sm font-mono mt-1">{contact.sourceId}</div>
        </div>
        {route && (
          <Button variant="outline" size="sm" asChild>
            <a href={`#${route}`} target="_blank" rel="noopener noreferrer">
              <IconExternalLink size={14} className="mr-1" /> Open
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
