export const LEAD_VENDOR_TYPES = ['internet', 'aged', 'referral', 'direct_mail', 'social_ads', 'search_ads', 'seminar', 'other'] as const
export const LEAD_SOURCE_STATUSES = ['active', 'testing', 'paused', 'killed'] as const
export const LEAD_COST_MODELS = ['per_lead', 'flat_batch', 'weekly', 'monthly', 'retainer', 'revenue_share'] as const
export const LEAD_INTEGRATION_STATUSES = ['manual', 'api_connected', 'import_only', 'paused', 'needs_review'] as const
export const LEAD_BATCH_STATUSES = ['testing', 'active', 'exhausted', 'refunded', 'disputed'] as const
export const RECURRING_SPEND_CADENCES = ['weekly', 'biweekly', 'monthly'] as const

export type LeadVendorType = (typeof LEAD_VENDOR_TYPES)[number]
export type LeadSourceStatus = (typeof LEAD_SOURCE_STATUSES)[number]
export type LeadCostModel = (typeof LEAD_COST_MODELS)[number]
export type LeadIntegrationStatus = (typeof LEAD_INTEGRATION_STATUSES)[number]
export type LeadBatchStatus = (typeof LEAD_BATCH_STATUSES)[number]
export type RecurringSpendCadence = (typeof RECURRING_SPEND_CADENCES)[number]

export interface LeadSourceProfile {
  id: string
  name: string
  vendorType: LeadVendorType
  status: LeadSourceStatus
  contactName: string
  contactEmail: string
  targetStates: string
  targetProducts: string
  costModel: LeadCostModel
  integrationStatus: LeadIntegrationStatus
  notes: string
  createdAt: string
  updatedAt: string
}

export interface LeadSpendBatch {
  id: string
  sourceId: string
  campaignName: string
  agentId: string
  agentName: string
  purchaseDate: string
  period: string
  leadCount: number
  totalSpend: number
  receiptUrl: string
  notes: string
  status: LeadBatchStatus
  createdByRuleId?: string
  importedInvoiceId?: string
  sourceMessageId?: string
  confidenceScore?: number
  createdAt: string
  updatedAt: string
}

export interface RecurringSpendRule {
  id: string
  sourceId: string
  agentId: string
  agentName: string
  cadence: RecurringSpendCadence
  amount: number
  expectedLeadCount: number
  startDate: string
  endDate: string
  nextRunDate: string
  active: boolean
  notes: string
  createdAt: string
  updatedAt: string
}

export interface VendorSyncStatus {
  id: string
  sourceId: string
  provider: string
  status: LeadIntegrationStatus
  lastSyncAt: string
  importedBatchCount: number
  errorMessage: string
  manualOverride: boolean
  updatedAt: string
}

const SOURCES_KEY = 'phantom.leadSpend.sources.v1'
const BATCHES_KEY = 'phantom.leadSpend.batches.v1'
const RULES_KEY = 'phantom.leadSpend.rules.v1'
const SYNC_KEY = 'phantom.leadSpend.sync.v1'

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

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function now() {
  return new Date().toISOString()
}

export function getLeadSourceProfiles(): LeadSourceProfile[] {
  return safeArray<LeadSourceProfile>(SOURCES_KEY)
}

export function saveLeadSourceProfile(input: Omit<LeadSourceProfile, 'id' | 'createdAt' | 'updatedAt'>): LeadSourceProfile {
  const source: LeadSourceProfile = { ...input, id: id('src'), createdAt: now(), updatedAt: now() }
  writeArray(SOURCES_KEY, [source, ...getLeadSourceProfiles()])
  return source
}

export function updateLeadSourceProfile(sourceId: string, patch: Partial<Omit<LeadSourceProfile, 'id' | 'createdAt'>>): LeadSourceProfile | null {
  let updated: LeadSourceProfile | null = null
  const next = getLeadSourceProfiles().map((source) => {
    if (source.id !== sourceId) return source
    updated = { ...source, ...patch, updatedAt: now() }
    return updated
  })
  writeArray(SOURCES_KEY, next)
  return updated
}

export function getLeadSpendBatches(): LeadSpendBatch[] {
  return safeArray<LeadSpendBatch>(BATCHES_KEY)
}

export function saveLeadSpendBatch(input: Omit<LeadSpendBatch, 'id' | 'createdAt' | 'updatedAt'>): LeadSpendBatch {
  const batch: LeadSpendBatch = { ...input, id: id('batch'), createdAt: now(), updatedAt: now() }
  writeArray(BATCHES_KEY, [batch, ...getLeadSpendBatches()])
  return batch
}

export function deleteLeadSpendBatch(batchId: string) {
  writeArray(BATCHES_KEY, getLeadSpendBatches().filter((batch) => batch.id !== batchId))
}

export function getRecurringSpendRules(): RecurringSpendRule[] {
  return safeArray<RecurringSpendRule>(RULES_KEY)
}

export function saveRecurringSpendRule(input: Omit<RecurringSpendRule, 'id' | 'createdAt' | 'updatedAt'>): RecurringSpendRule {
  const rule: RecurringSpendRule = { ...input, id: id('rule'), createdAt: now(), updatedAt: now() }
  writeArray(RULES_KEY, [rule, ...getRecurringSpendRules()])
  return rule
}

export function updateRecurringSpendRule(ruleId: string, patch: Partial<Omit<RecurringSpendRule, 'id' | 'createdAt'>>): RecurringSpendRule | null {
  let updated: RecurringSpendRule | null = null
  const next = getRecurringSpendRules().map((rule) => {
    if (rule.id !== ruleId) return rule
    updated = { ...rule, ...patch, updatedAt: now() }
    return updated
  })
  writeArray(RULES_KEY, next)
  return updated
}

export function getVendorSyncStatuses(): VendorSyncStatus[] {
  return safeArray<VendorSyncStatus>(SYNC_KEY)
}

export function upsertVendorSyncStatus(input: Omit<VendorSyncStatus, 'id' | 'updatedAt'> & { id?: string }): VendorSyncStatus {
  const statuses = getVendorSyncStatuses()
  const existingIndex = statuses.findIndex((status) => status.sourceId === input.sourceId)
  const status: VendorSyncStatus = { ...input, id: input.id || id('sync'), updatedAt: now() }
  if (existingIndex >= 0) statuses[existingIndex] = status
  else statuses.unshift(status)
  writeArray(SYNC_KEY, statuses)
  return status
}

export function addCadenceDate(dateValue: string, cadence: RecurringSpendCadence): string {
  const date = new Date(`${dateValue}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateValue
  if (cadence === 'weekly') date.setDate(date.getDate() + 7)
  else if (cadence === 'biweekly') date.setDate(date.getDate() + 14)
  else date.setMonth(date.getMonth() + 1)
  return date.toISOString().slice(0, 10)
}
