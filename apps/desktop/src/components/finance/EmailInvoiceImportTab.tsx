import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  IconAlertTriangle,
  IconBrandGoogle,
  IconCheck,
  IconCloudUpload,
  IconCopyCheck,
  IconFileInvoice,
  IconInbox,
  IconMailCog,
  IconPlugConnected,
  IconRefresh,
  IconTrash,
  IconX,
} from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import {
  EMAIL_INVOICE_IMPORT_BACKEND_ENABLED,
  useApproveImportedInvoice,
  useCreateMailbox,
  useDeleteMailbox,
  useImportedInvoices,
  useMailboxes,
  useRejectImportedInvoice,
  useSyncMailbox,
  useTestMailbox,
  useUpdateImportedInvoice,
} from '@/hooks/useEmailInvoiceImport'
import { useCreateExpense } from '@/hooks/useExpenses'
import {
  getLeadSourceProfiles,
  saveLeadSpendBatch,
  type LeadSourceProfile,
} from '@/lib/lead-spend-local'
import type {
  ApproveImportedInvoiceRequest,
  ImportedInvoice,
  ImportedInvoiceStatus,
  MailboxSecurityMode,
} from '@/types/portal'

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })

const chartConfig = {
  pending: { label: 'Pending', color: 'hsl(var(--primary))' },
  approved: { label: 'Approved', color: '#22c55e' },
} satisfies ChartConfig

function label(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
}

function statusVariant(status: ImportedInvoiceStatus) {
  if (status === 'approved') return 'success'
  if (status === 'pending_review') return 'warning'
  if (status === 'rejected' || status === 'duplicate') return 'destructive'
  return 'secondary'
}

function confidenceVariant(score: number) {
  if (score >= 0.85) return 'success'
  if (score >= 0.65) return 'warning'
  return 'destructive'
}

function monthFromDate(dateValue: string) {
  return dateValue ? dateValue.slice(0, 7) : new Date().toISOString().slice(0, 7)
}

function sourceName(sources: LeadSourceProfile[], sourceId?: string | null) {
  if (!sourceId) return 'Unmatched'
  return sources.find((source) => source.id === sourceId)?.name ?? 'Unmatched'
}

export default function EmailInvoiceImportTab() {
  const [folders, setFolders] = useState({ inbox: true, sent: true })
  const [sources, setSources] = useState<LeadSourceProfile[]>(() => getLeadSourceProfiles())
  const [form, setForm] = useState({
    email: '',
    displayName: '',
    host: '',
    port: '993',
    securityMode: 'ssl_tls' as MailboxSecurityMode,
    username: '',
    password: '',
  })

  const mailboxes = useMailboxes()
  const importedInvoices = useImportedInvoices()
  const createMailbox = useCreateMailbox()
  const deleteMailbox = useDeleteMailbox()
  const testMailbox = useTestMailbox()
  const syncMailbox = useSyncMailbox()
  const updateInvoice = useUpdateImportedInvoice()
  const approveInvoice = useApproveImportedInvoice()
  const rejectInvoice = useRejectImportedInvoice()
  const createExpense = useCreateExpense()

  const mailboxRows = mailboxes.data ?? []
  const invoiceRows = importedInvoices.data?.invoices ?? []
  const pendingInvoices = invoiceRows.filter((invoice) => invoice.status === 'pending_review' || invoice.status === 'needs_attention')

  const totals = useMemo(() => {
    const pendingAmount = pendingInvoices.reduce((sum, invoice) => sum + invoice.extraction.amount, 0)
    const approvedAmount = invoiceRows.filter((invoice) => invoice.status === 'approved').reduce((sum, invoice) => sum + invoice.extraction.amount, 0)
    return {
      pendingAmount,
      approvedAmount,
      pendingCount: pendingInvoices.length,
      connectedCount: mailboxRows.filter((mailbox) => mailbox.status === 'connected').length,
    }
  }, [invoiceRows, mailboxRows, pendingInvoices])

  const chartData = useMemo(() => {
    const byVendor = new Map<string, { vendor: string; pending: number; approved: number }>()
    invoiceRows.forEach((invoice) => {
      const vendor = invoice.extraction.vendorName || 'Unknown'
      const row = byVendor.get(vendor) ?? { vendor, pending: 0, approved: 0 }
      if (invoice.status === 'approved') row.approved += invoice.extraction.amount
      else if (invoice.status === 'pending_review' || invoice.status === 'needs_attention') row.pending += invoice.extraction.amount
      byVendor.set(vendor, row)
    })
    return [...byVendor.values()].slice(0, 8)
  }, [invoiceRows])

  const selectedFolders = [folders.inbox ? 'INBOX' : null, folders.sent ? 'Sent' : null].filter(Boolean) as string[]

  const handleTestGeneric = () => {
    if (!form.email.trim() || !form.host.trim() || !form.username.trim() || !form.password.trim()) {
      toast.error('Email, host, username, and app password are required')
      return
    }
    testMailbox.mutate(
      {
        providerType: 'generic_imap',
        email: form.email.trim(),
        displayName: form.displayName.trim() || form.email.trim(),
        host: form.host.trim(),
        port: Number(form.port || 993),
        securityMode: form.securityMode,
        username: form.username.trim(),
        password: form.password,
        folders: selectedFolders,
      },
      {
        onSuccess: (result) => toast[result.ok ? 'success' : 'error'](result.message),
        onError: () => toast.error('Mailbox test failed'),
      },
    )
  }

  const handleCreateGeneric = () => {
    if (!form.email.trim() || !form.host.trim() || !form.username.trim() || !form.password.trim()) {
      toast.error('Email, host, username, and app password are required')
      return
    }
    createMailbox.mutate(
      {
        providerType: 'generic_imap',
        email: form.email.trim(),
        displayName: form.displayName.trim() || form.email.trim(),
        host: form.host.trim(),
        port: Number(form.port || 993),
        securityMode: form.securityMode,
        username: form.username.trim(),
        password: form.password,
        folders: selectedFolders,
      },
      {
        onSuccess: () => {
          setForm({ email: '', displayName: '', host: '', port: '993', securityMode: 'ssl_tls', username: '', password: '' })
          toast.success('Mailbox connection saved')
        },
        onError: () => toast.error('Failed to save mailbox connection'),
      },
    )
  }

  const handleGmailConnect = () => {
    createMailbox.mutate(
      {
        providerType: 'gmail_oauth',
        email: form.email.trim() || 'gmail-account@pending-oauth.local',
        displayName: form.displayName.trim() || 'Gmail OAuth',
        folders: selectedFolders,
      },
      {
        onSuccess: () => toast.success('Gmail connection initialized'),
        onError: () => toast.error('Failed to initialize Gmail connection'),
      },
    )
  }

  const updateInvoiceField = (invoice: ImportedInvoice, patch: Parameters<typeof updateInvoice.mutate>[0]['data']['extraction']) => {
    updateInvoice.mutate(
      { id: invoice.id, data: { extraction: patch } },
      { onSuccess: () => toast.success('Invoice updated'), onError: () => toast.error('Failed to update invoice') },
    )
  }

  const approveAsLeadSpend = (invoice: ImportedInvoice) => {
    const sourceId = invoice.extraction.sourceId || sources[0]?.id
    if (!sourceId) {
      toast.error('Create a lead source before approving as Lead Spend')
      return
    }
    const batch = saveLeadSpendBatch({
      sourceId,
      campaignName: invoice.subject || `${invoice.extraction.vendorName} invoice`,
      agentId: invoice.extraction.agentId || 'unassigned',
      agentName: invoice.extraction.agentId || 'Unassigned',
      purchaseDate: invoice.extraction.invoiceDate,
      period: invoice.extraction.billingPeriod || monthFromDate(invoice.extraction.invoiceDate),
      leadCount: invoice.extraction.leadCount || 1,
      totalSpend: invoice.extraction.amount,
      receiptUrl: invoice.receiptUrl || '',
      notes: `Imported from ${invoice.folder}: ${invoice.extraction.extractionNotes}`,
      status: 'active',
      importedInvoiceId: invoice.id,
      sourceMessageId: invoice.sourceMessageId || invoice.messageId,
      confidenceScore: invoice.extraction.confidenceScore,
    })
    const request: ApproveImportedInvoiceRequest = {
      target: 'lead_spend',
      sourceId,
      agentId: invoice.extraction.agentId || undefined,
      campaignName: invoice.subject,
      notes: invoice.extraction.extractionNotes,
    }
    approveInvoice.mutate(
      { id: invoice.id, data: request, approvedRecordId: batch.id },
      {
        onSuccess: () => {
          setSources(getLeadSourceProfiles())
          toast.success('Invoice approved as Lead Spend')
        },
        onError: () => toast.error('Failed to approve invoice'),
      },
    )
  }

  const approveAsReceipt = (invoice: ImportedInvoice) => {
    createExpense.mutate(
      {
        category: invoice.extraction.category || 'other',
        description: `${invoice.extraction.vendorName}${invoice.extraction.invoiceNumber ? ` · ${invoice.extraction.invoiceNumber}` : ''}`,
        amount: invoice.extraction.amount,
        expenseDate: invoice.extraction.invoiceDate,
        agentDiscordId: invoice.extraction.agentId || undefined,
        receiptUrl: invoice.receiptUrl || undefined,
      },
      {
        onSuccess: (expense) => {
          approveInvoice.mutate({
            id: invoice.id,
            data: { target: 'receipt', category: invoice.extraction.category || 'other', notes: invoice.extraction.extractionNotes },
            approvedRecordId: expense.id,
          })
          toast.success('Invoice approved as Receipt')
        },
        onError: () => toast.error('Failed to create receipt expense'),
      },
    )
  }

  return (
    <div className="space-y-5">
      {!EMAIL_INVOICE_IMPORT_BACKEND_ENABLED && (
        <Card className="bg-amber-500/10 backdrop-blur border-amber-500/25">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <IconAlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" />
              <div>
                <p className="text-sm font-semibold text-amber-100">Local prototype mode</p>
                <p className="text-xs text-amber-100/75">Mailbox sync and imported invoice endpoints are deferred. This tab uses local prototype data unless VITE_EMAIL_INVOICE_IMPORT_BACKEND=true is set.</p>
              </div>
            </div>
            <Badge variant="warning" className="w-fit">Backend disabled</Badge>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending Review</p>
            <p className="mt-1 text-2xl font-semibold">{totals.pendingCount}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Pending Amount</p>
            <p className="mt-1 text-2xl font-semibold">{money.format(totals.pendingAmount)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Approved Imports</p>
            <p className="mt-1 text-2xl font-semibold">{money.format(totals.approvedAmount)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Connected Mailboxes</p>
            <p className="mt-1 text-2xl font-semibold">{totals.connectedCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[440px_minmax(0,1fr)] gap-4">
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><IconMailCog size={18} /> Email Invoice Import</CardTitle>
            <CardDescription>
              {EMAIL_INVOICE_IMPORT_BACKEND_ENABLED
                ? 'Connect IMAP or Gmail. Credentials are sent to the backend only and are not stored in localStorage.'
                : 'Prototype-only mailbox setup. Credentials are not tested against a backend in this mode.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="billing@agency.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Display name</Label>
                <Input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} placeholder="Lead invoices" />
              </div>
              <div className="space-y-1.5">
                <Label>IMAP host</Label>
                <Input value={form.host} onChange={(event) => setForm({ ...form, host: event.target.value })} placeholder="imap.gmail.com" />
              </div>
              <div className="grid grid-cols-[1fr_1.2fr] gap-2">
                <div className="space-y-1.5">
                  <Label>Port</Label>
                  <Input type="number" value={form.port} onChange={(event) => setForm({ ...form, port: event.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Security</Label>
                  <Select value={form.securityMode} onValueChange={(securityMode) => setForm({ ...form, securityMode: securityMode as MailboxSecurityMode })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ssl_tls">SSL/TLS</SelectItem>
                      <SelectItem value="starttls">STARTTLS</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Username</Label>
                <Input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="Usually email" />
              </div>
              <div className="space-y-1.5">
                <Label>App password</Label>
                <Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Stored server-side only" />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Folders to scan</p>
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                <span className="text-sm">Inbox</span>
                <Switch checked={folders.inbox} onCheckedChange={(checked) => setFolders({ ...folders, inbox: checked })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                <span className="text-sm">Sent</span>
                <Switch checked={folders.sent} onCheckedChange={(checked) => setFolders({ ...folders, sent: checked })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleTestGeneric} disabled={testMailbox.isPending}>Test IMAP</Button>
              <Button onClick={handleCreateGeneric} disabled={createMailbox.isPending}>Save IMAP</Button>
              <Button variant="outline" className="col-span-2" onClick={handleGmailConnect} disabled={createMailbox.isPending}>
                <IconBrandGoogle size={16} className="mr-2" />
                Connect Gmail OAuth
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><IconFileInvoice size={18} /> Invoice Import Mix</CardTitle>
            <CardDescription>Spend waiting for review versus approved imported invoice totals.</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-80 w-full">
                <BarChart data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="vendor" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="pending" fill="var(--color-pending)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="approved" fill="var(--color-approved)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-80 flex-col items-center justify-center text-center">
                <IconInbox size={34} className="text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium">No imported invoices yet</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">Connect a mailbox and sync when the backend ingestion worker is deployed.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><IconPlugConnected size={18} /> Sync Health</CardTitle>
          <CardDescription>Mailbox connection status, last sync, imported count, and error state.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {mailboxRows.map((mailbox) => (
            <motion.div key={mailbox.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="bg-background/50 border-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm">{mailbox.displayName}</CardTitle>
                      <CardDescription>{mailbox.email}</CardDescription>
                    </div>
                    <Badge variant={mailbox.status === 'connected' ? 'success' : mailbox.status === 'needs_attention' ? 'destructive' : 'secondary'}>{label(mailbox.status)}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-muted-foreground">
                  <p>Folders: {mailbox.folders.join(', ')}</p>
                  <p>Last sync: {mailbox.lastSyncAt || 'Never'}</p>
                  <p>Imported: {mailbox.importedCount} · Failed: {mailbox.failedCount}</p>
                  {mailbox.errorMessage && (
                    <p className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-destructive">
                      <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
                      {mailbox.errorMessage}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => syncMailbox.mutate(mailbox.id)} disabled={syncMailbox.isPending}>
                      <IconRefresh size={14} className="mr-1.5" /> Sync now
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteMailbox.mutate(mailbox.id)}>
                      <IconTrash size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {mailboxRows.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-border/60 p-8 text-center">
              <IconCloudUpload size={30} className="mx-auto text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium">No mailboxes connected</p>
              <p className="mt-1 text-xs text-muted-foreground">Add IMAP or Gmail OAuth to start importing invoice emails.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><IconCopyCheck size={18} /> Review Queue</CardTitle>
          <CardDescription>Approve only after vendor, amount, date, source, and receipt link are correct.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor / Email</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Routing</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoiceRows.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="align-top">
                    <div className="space-y-1">
                      <Input defaultValue={invoice.extraction.vendorName} onBlur={(event) => updateInvoiceField(invoice, { vendorName: event.target.value })} className="h-8 min-w-44" />
                      <p className="text-xs text-muted-foreground">{invoice.fromEmail} · {invoice.folder}</p>
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="space-y-1">
                      <Input defaultValue={invoice.extraction.invoiceNumber || ''} onBlur={(event) => updateInvoiceField(invoice, { invoiceNumber: event.target.value })} className="h-8 min-w-32" placeholder="Invoice #" />
                      <Input type="date" defaultValue={invoice.extraction.invoiceDate} onBlur={(event) => updateInvoiceField(invoice, { invoiceDate: event.target.value })} className="h-8 min-w-36" />
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="space-y-1">
                      <Select value={invoice.extraction.sourceId || '_none'} onValueChange={(value) => updateInvoiceField(invoice, { sourceId: value === '_none' ? null : value })}>
                        <SelectTrigger className="h-8 min-w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Generic receipt</SelectItem>
                          {sources.map((source) => <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">{sourceName(sources, invoice.extraction.sourceId)}</p>
                    </div>
                  </TableCell>
                  <TableCell className="align-top text-right">
                    <Input type="number" defaultValue={invoice.extraction.amount} onBlur={(event) => updateInvoiceField(invoice, { amount: Number(event.target.value) })} className="ml-auto h-8 w-28 text-right font-mono" />
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant={confidenceVariant(invoice.extraction.confidenceScore)}>{Math.round(invoice.extraction.confidenceScore * 100)}%</Badge>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant={statusVariant(invoice.status)}>{label(invoice.status)}</Badge>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => approveAsLeadSpend(invoice)} disabled={invoice.status === 'approved'}>
                        <IconCheck size={14} className="mr-1.5" /> Lead Spend
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => approveAsReceipt(invoice)} disabled={invoice.status === 'approved'}>
                        <IconFileInvoice size={14} className="mr-1.5" /> Receipt
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => rejectInvoice.mutate(invoice.id)} disabled={invoice.status === 'rejected'}>
                        <IconX size={14} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {invoiceRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No invoices in the review queue.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Textarea className="mt-4" readOnly value="Import policy: deterministic vendor rules first, AI extraction second, user approval before financial posting. Duplicate detection uses message ID, attachment hash, vendor, amount, invoice number, and invoice date." />
        </CardContent>
      </Card>
    </div>
  )
}
