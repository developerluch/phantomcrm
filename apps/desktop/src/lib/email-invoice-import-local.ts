import type {
  ApproveImportedInvoiceRequest,
  CreateMailboxConnectionRequest,
  ImportedInvoice,
  MailboxConnection,
  MailboxConnectionStatus,
  UpdateImportedInvoiceRequest,
} from '@/types/portal'

const MAILBOXES_KEY = 'phantom.invoiceImport.mailboxes.v1'
const INVOICES_KEY = 'phantom.invoiceImport.invoices.v1'

function now() {
  return new Date().toISOString()
}

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function safeArray<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeArray<T>(key: string, values: T[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(values))
}

export function getLocalMailboxes(): MailboxConnection[] {
  return safeArray<MailboxConnection>(MAILBOXES_KEY)
}

export function saveLocalMailbox(input: CreateMailboxConnectionRequest, status: MailboxConnectionStatus = 'needs_attention'): MailboxConnection {
  const mailbox: MailboxConnection = {
    id: id('mailbox'),
    providerType: input.providerType,
    email: input.email.trim(),
    displayName: input.displayName?.trim() || input.email.trim(),
    host: input.providerType === 'generic_imap' ? input.host?.trim() || null : null,
    port: input.providerType === 'generic_imap' ? input.port ?? null : null,
    securityMode: input.providerType === 'generic_imap' ? input.securityMode ?? 'ssl_tls' : null,
    folders: input.folders.length > 0 ? input.folders : ['INBOX', 'Sent'],
    status,
    lastUid: null,
    lastMessageDate: null,
    lastSyncAt: null,
    importedCount: 0,
    failedCount: 0,
    errorMessage: status === 'needs_attention' ? 'Backend mailbox endpoints are not deployed yet. Credentials were not stored locally.' : null,
    createdAt: now(),
    updatedAt: now(),
  }
  writeArray(MAILBOXES_KEY, [mailbox, ...getLocalMailboxes()])
  return mailbox
}

export function updateLocalMailboxStatus(mailboxId: string, patch: Partial<MailboxConnection>): MailboxConnection | null {
  let updated: MailboxConnection | null = null
  const next = getLocalMailboxes().map((mailbox) => {
    if (mailbox.id !== mailboxId) return mailbox
    updated = { ...mailbox, ...patch, updatedAt: now() }
    return updated
  })
  writeArray(MAILBOXES_KEY, next)
  return updated
}

export function deleteLocalMailbox(mailboxId: string) {
  writeArray(MAILBOXES_KEY, getLocalMailboxes().filter((mailbox) => mailbox.id !== mailboxId))
}

export function getLocalImportedInvoices(): ImportedInvoice[] {
  return safeArray<ImportedInvoice>(INVOICES_KEY)
}

export function updateLocalImportedInvoice(invoiceId: string, patch: UpdateImportedInvoiceRequest): ImportedInvoice | null {
  let updated: ImportedInvoice | null = null
  const next = getLocalImportedInvoices().map((invoice) => {
    if (invoice.id !== invoiceId) return invoice
    updated = {
      ...invoice,
      status: patch.status ?? invoice.status,
      extraction: { ...invoice.extraction, ...patch.extraction },
      updatedAt: now(),
    }
    return updated
  })
  writeArray(INVOICES_KEY, next)
  return updated
}

export function approveLocalImportedInvoice(invoiceId: string, request: ApproveImportedInvoiceRequest, approvedRecordId?: string): ImportedInvoice | null {
  let updated: ImportedInvoice | null = null
  const next = getLocalImportedInvoices().map((invoice) => {
    if (invoice.id !== invoiceId) return invoice
    updated = {
      ...invoice,
      status: 'approved',
      approvedTarget: request.target,
      approvedRecordId: approvedRecordId ?? null,
      updatedAt: now(),
    }
    return updated
  })
  writeArray(INVOICES_KEY, next)
  return updated
}

export function rejectLocalImportedInvoice(invoiceId: string): ImportedInvoice | null {
  return updateLocalImportedInvoice(invoiceId, { status: 'rejected' })
}
