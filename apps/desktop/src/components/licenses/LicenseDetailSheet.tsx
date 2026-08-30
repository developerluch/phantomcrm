import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  IconEdit,
  IconFileUpload,
  IconLoader2,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import { DateField, formatDateString, parseDateString } from '@/components/DateField'
import {
  useLicense,
  useUpdateLicense,
  useLicenseAppointments,
  useCreateLicenseAppointment,
  useDeleteLicenseAppointment,
  useLicenseDocuments,
} from '@/hooks/useLicenses'
import {
  createAppointmentSchema,
  type CreateAppointmentFormData,
} from '@/lib/schemas'
import {
  LICENSE_STATUSES,
  LICENSE_STATUS_COLORS,
  LICENSE_STATUS_LABELS,
  type License,
  type LicenseStatus,
} from '@/types/portal'

interface LicenseDetailSheetProps {
  licenseId: string | null
  fallbackLicense?: License
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LicenseDetailSheet({
  licenseId,
  fallbackLicense,
  open,
  onOpenChange,
}: LicenseDetailSheetProps) {
  const { data: fresh } = useLicense(licenseId ?? undefined)
  const license = fresh ?? fallbackLicense ?? null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        {license ? (
          <LicenseDetailContents license={license} onClose={() => onOpenChange(false)} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <IconLoader2 className="animate-spin mr-2 h-4 w-4" />
            Loading license…
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
function LicenseDetailContents({
  license,
  onClose,
}: {
  license: License
  onClose: () => void
}) {
  const status = (license.status as LicenseStatus) in LICENSE_STATUS_COLORS
    ? (license.status as LicenseStatus)
    : 'pending'
  const statusColor = LICENSE_STATUS_COLORS[status]
  const statusLabel = LICENSE_STATUS_LABELS[status]

  return (
    <>
      <SheetHeader className="space-y-2 pr-8">
        <div className="flex items-center gap-2">
          <Badge style={{ background: `${statusColor}20`, color: statusColor }}>
            {license.state}
          </Badge>
          <SheetTitle className="text-base font-semibold">
            {license.licenseNumber}
          </SheetTitle>
          <Badge
            className="ml-auto"
            style={{ background: `${statusColor}20`, color: statusColor }}
          >
            {statusLabel}
          </Badge>
        </div>
        <SheetDescription>
          {license.agent
            ? `${license.agent.firstName} ${license.agent.lastName} · agent ${license.agentId.slice(0, 8)}`
            : `Agent ${license.agentId.slice(0, 8)}`}
          {license.lastVerifiedAt ? (
            <span className="block text-[11px] mt-1">
              Last verified {format(new Date(license.lastVerifiedAt), 'PPpp')} · source: {license.source ?? 'manual'}
            </span>
          ) : null}
        </SheetDescription>
      </SheetHeader>

      <Tabs defaultValue="overview" className="mt-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab license={license} onClose={onClose} />
        </TabsContent>

        <TabsContent value="appointments" className="mt-4">
          <AppointmentsTab licenseId={license.id} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentsTab licenseId={license.id} />
        </TabsContent>
      </Tabs>
    </>
  )
}

// ───────── Overview tab ─────────

function OverviewTab({ license, onClose }: { license: License; onClose: () => void }) {
  const [editing, setEditing] = useState(false)
  const update = useUpdateLicense()

  const [formState, setFormState] = useState({
    status: license.status,
    licenseType: license.licenseType ?? '',
    isResident: !!license.isResident,
    issueDate: parseDateString(license.issueDate ?? null),
    expirationDate: parseDateString(license.expirationDate ?? null),
    ceRequired: license.ceRequired ?? 0,
    ceCompleted: license.ceCompleted ?? 0,
    ceDueDate: parseDateString(license.ceDueDate ?? null),
    notes: license.notes ?? '',
    linesOfAuthority: (license.linesOfAuthority ?? []).join(', '),
  })

  useEffect(() => {
    setFormState({
      status: license.status,
      licenseType: license.licenseType ?? '',
      isResident: !!license.isResident,
      issueDate: parseDateString(license.issueDate ?? null),
      expirationDate: parseDateString(license.expirationDate ?? null),
      ceRequired: license.ceRequired ?? 0,
      ceCompleted: license.ceCompleted ?? 0,
      ceDueDate: parseDateString(license.ceDueDate ?? null),
      notes: license.notes ?? '',
      linesOfAuthority: (license.linesOfAuthority ?? []).join(', '),
    })
  }, [license])

  const save = () => {
    update.mutate(
      {
        id: license.id,
        data: {
          status: formState.status,
          licenseType: formState.licenseType || undefined,
          isResident: formState.isResident,
          issueDate: formatDateString(formState.issueDate) || undefined,
          expirationDate: formatDateString(formState.expirationDate) || undefined,
          ceRequired: formState.ceRequired || undefined,
          ceCompleted: formState.ceCompleted || undefined,
          ceDueDate: formatDateString(formState.ceDueDate) || undefined,
          notes: formState.notes || undefined,
          linesOfAuthority: formState.linesOfAuthority
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        },
      },
      {
        onSuccess: () => {
          toast.success('License updated')
          setEditing(false)
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Update failed'),
      },
    )
  }

  if (!editing) {
    return (
      <div className="space-y-3 text-sm">
        <Field label="License type" value={license.licenseType ?? '—'} />
        <Field label="Resident" value={license.isResident ? 'Yes' : 'No'} />
        <Field label="Issue date" value={formatDisplayDate(license.issueDate)} />
        <Field label="Expiration" value={formatDisplayDate(license.expirationDate)} />
        <Field
          label="Lines of authority"
          value={(license.linesOfAuthority ?? []).join(', ') || '—'}
        />
        <Field
          label="CE required"
          value={license.ceRequired != null ? `${license.ceCompleted ?? 0} / ${license.ceRequired} hrs` : '—'}
        />
        <Field label="CE due" value={formatDisplayDate(license.ceDueDate)} />
        <Field label="NPN" value={license.npn ?? '—'} mono />
        {license.notes ? (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Notes</p>
            <p className="text-sm whitespace-pre-wrap">{license.notes}</p>
          </div>
        ) : null}
        <div className="pt-3 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            <IconEdit className="mr-1.5 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div className="text-xs text-muted-foreground">
          Status
          <div className="flex gap-1 flex-wrap mt-1">
            {LICENSE_STATUSES.map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={formState.status === s ? 'default' : 'outline'}
                onClick={() => setFormState((st) => ({ ...st, status: s }))}
              >
                {LICENSE_STATUS_LABELS[s]}
              </Button>
            ))}
          </div>
        </div>
        <label className="text-xs text-muted-foreground">
          License type
          <Input
            className="mt-1"
            value={formState.licenseType}
            onChange={(e) => setFormState((s) => ({ ...s, licenseType: e.target.value }))}
            placeholder="Life, Health, P&C…"
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={formState.isResident}
          onCheckedChange={(v) => setFormState((s) => ({ ...s, isResident: v }))}
        />
        <span className="text-xs text-muted-foreground">Resident license</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Issue date</p>
          <DateField
            value={formState.issueDate}
            onChange={(d) => setFormState((s) => ({ ...s, issueDate: d }))}
          />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Expiration</p>
          <DateField
            value={formState.expirationDate}
            onChange={(d) => setFormState((s) => ({ ...s, expirationDate: d }))}
          />
        </div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">Lines of authority (comma-separated)</p>
        <Input
          value={formState.linesOfAuthority}
          onChange={(e) =>
            setFormState((s) => ({ ...s, linesOfAuthority: e.target.value }))
          }
          placeholder="Life, Accident & Health"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-xs text-muted-foreground mb-1">CE required (hrs)</p>
          <Input
            type="number"
            value={formState.ceRequired}
            onChange={(e) =>
              setFormState((s) => ({ ...s, ceRequired: parseInt(e.target.value || '0', 10) }))
            }
          />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">CE completed</p>
          <Input
            type="number"
            value={formState.ceCompleted}
            onChange={(e) =>
              setFormState((s) => ({ ...s, ceCompleted: parseInt(e.target.value || '0', 10) }))
            }
          />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">CE due</p>
          <DateField
            value={formState.ceDueDate}
            onChange={(d) => setFormState((s) => ({ ...s, ceDueDate: d }))}
          />
        </div>
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">Notes</p>
        <Textarea
          value={formState.notes}
          onChange={(e) => setFormState((s) => ({ ...s, notes: e.target.value }))}
          rows={3}
        />
      </div>
      <div className="pt-2 flex gap-2">
        <Button size="sm" onClick={save} disabled={update.isPending}>
          {update.isPending ? <IconLoader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`text-sm text-foreground ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  )
}

function formatDisplayDate(s?: string | null) {
  if (!s) return '—'
  const d = parseDateString(s) ?? new Date(s)
  if (Number.isNaN(d.getTime())) return '—'
  return format(d, 'PPP')
}

// ───────── Appointments tab ─────────

function AppointmentsTab({ licenseId }: { licenseId: string }) {
  const { data: appointments = [], isLoading } = useLicenseAppointments(licenseId)
  const create = useCreateLicenseAppointment(licenseId)
  const del = useDeleteLicenseAppointment(licenseId)
  const [open, setOpen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isValid },
  } = useForm<CreateAppointmentFormData>({
    resolver: zodResolver(createAppointmentSchema),
    mode: 'onChange',
  })

  const submit = (data: CreateAppointmentFormData) => {
    create.mutate(
      {
        carrier: data.carrier.trim(),
        writingNumber: data.writingNumber?.trim() || undefined,
        appointedOn: data.appointedOn || undefined,
        terminatedOn: data.terminatedOn || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Appointment added')
          reset()
          setOpen(false)
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : 'Failed to add appointment'),
      },
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{appointments.length} appointment(s)</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <IconPlus className="mr-1.5 h-3.5 w-3.5" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Appointment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(submit)} className="space-y-3">
              <div>
                <Input {...register('carrier')} placeholder="Carrier *" />
                {errors.carrier ? (
                  <p className="text-[11px] text-red-400 mt-1">{errors.carrier.message}</p>
                ) : null}
              </div>
              <Input {...register('writingNumber')} placeholder="Writing number" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Appointed</p>
                  <Controller
                    control={control}
                    name="appointedOn"
                    render={({ field }) => (
                      <DateField
                        value={parseDateString(field.value)}
                        onChange={(d) => field.onChange(formatDateString(d))}
                      />
                    )}
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Terminated</p>
                  <Controller
                    control={control}
                    name="terminatedOn"
                    render={({ field }) => (
                      <DateField
                        value={parseDateString(field.value)}
                        onChange={(d) => field.onChange(formatDateString(d))}
                      />
                    )}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" size="sm" disabled={!isValid || create.isPending}>
                  {create.isPending ? (
                    <IconLoader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Save
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Separator />
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : appointments.length === 0 ? (
        <p className="text-xs text-muted-foreground">No appointments logged.</p>
      ) : (
        <div className="space-y-2">
          {appointments.map((a) => (
            <Card key={a.id} className="p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{a.carrier}</p>
                <p className="text-[11px] text-muted-foreground">
                  {a.writingNumber ? `#${a.writingNumber} · ` : ''}
                  {a.appointedOn ? `appointed ${a.appointedOn}` : 'not appointed'}
                  {a.terminatedOn ? ` · terminated ${a.terminatedOn}` : ''}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() =>
                  del.mutate(a.id, {
                    onSuccess: () => toast.success('Appointment removed'),
                    onError: () => toast.error('Failed to remove'),
                  })
                }
                className="h-7 w-7 text-muted-foreground hover:text-red-400"
              >
                <IconTrash className="h-3.5 w-3.5" />
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ───────── Documents tab (v1 stub) ─────────

function DocumentsTab({ licenseId }: { licenseId: string }) {
  const { data: docs = [] } = useLicenseDocuments(licenseId)

  return (
    <div className="space-y-3">
      <Card className="border-dashed bg-card/40 p-6 text-center">
        <IconFileUpload className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm text-foreground">Document uploads coming soon</p>
        <p className="text-[11px] text-muted-foreground">
          PDFs, CE certificates, appointment letters will live here.
        </p>
        <Button size="sm" variant="outline" className="mt-3" disabled>
          <IconFileUpload className="mr-1.5 h-3.5 w-3.5" />
          Upload
        </Button>
      </Card>
      {docs.length > 0 ? (
        <div className="space-y-1 text-xs">
          {docs.map((d) => (
            <div key={d.id} className="flex justify-between">
              <span>{d.filename}</span>
              <span className="text-muted-foreground">{d.kind}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
