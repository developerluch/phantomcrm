// API client for Phantom CRM Onboarding API

/** Custom error that preserves the HTTP status code for React Query retry logic */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Sleep helper */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function readApiError(res: Response): Promise<{ message: string; details?: unknown }> {
  const text = await res.text().catch(() => 'Unknown error')
  try {
    const details = JSON.parse(text) as { error?: unknown }
    const error = typeof details.error === 'string' ? details.error : text
    return { message: `API ${res.status}: ${error}`, details }
  } catch {
    return { message: `API ${res.status}: ${text}` }
  }
}
import {
  getAccessToken as vaultGetAccessToken,
  getRefreshToken as vaultGetRefreshToken,
  setAccessToken as vaultSetAccessToken,
  setRefreshToken as vaultSetRefreshToken,
  clearTokens as vaultClearTokens,
  scrubLocalStorageOnce,
} from './tokenVault'
import type {
  AgentDetail,
  AgentSummary,
  AgentsListResponse,
  AtRiskAgent,
  DashboardSummary,
  FunnelResponse,
} from '../types/agent'
import type {
  AgentProfile,
  AgentLead,
  CreateAgentLeadRequest,
  UpdateAgentLeadRequest,
  AgentTrainingItem,
  CreateTrainingItemRequest,
  UpdateTrainingItemRequest,
  AgentScheduleEvent,
  CreateScheduleEventRequest,
  UpdateScheduleEventRequest,
  OrgChartNode,
  CompTierWithAgents,
  DiscordMemberLookup,
  AgentOnboardingInviteRequest,
  AgentOnboardingInviteResponse,
  CreateAgentRequest,
  VerifyAgentResponse,
  BulkImportResponse,
  Sale,
  SaleStats,
  SalesAgentDirectoryEntry,
  CreateSaleRequest,
  UpdateSaleRequest,
  BugReport,
  CreateBugReportRequest,
  Recruit,
  RecruitsResponse,
  CreateRecruitRequest,
  UpdateRecruitRequest,
  RecruitStats,
  RecruitFunnelData,
  OnboardingChecklist,
  ConversionDataPoint,
  SourceDataPoint,
  TrendDataPoint,
  StageDurationDataPoint,
  License,
  CreateLicenseRequest,
  UpdateLicenseRequest,
  LicenseAppointment,
  CreateLicenseAppointmentRequest,
  LicenseDocument,
  LicenseStats,
  Notification,
  NotificationsResponse,
  ActivityLogEntry,
  Appointment,
  AppointmentsResponse,
  CreateAppointmentRequest,
  SmsMessage,
  SmsHistoryResponse,
  WhatsAppMessage,
  WhatsAppConversation,
  DashboardStats,
  RevenueChartPoint,
  LeaderboardEntry,
  PipelineValueEntry,
  Server,
  PendingJoin,
  PendingJoinsResponse,
  IntegrationStatus,
  ChatConversation,
  ChatMessage,
  LockIn,
  LockInPartner,
  LockInAgent,
  LockInBudgetItem,
  LockInItineraryItem,
  BudgetSummary,
  StageConfig,
  Expense,
  CreateExpenseRequest,
  UpdateExpenseRequest,
  MailboxConnection,
  CreateMailboxConnectionRequest,
  UpdateMailboxConnectionRequest,
  MailboxTestResult,
  MailboxSyncResult,
  ImportedInvoice,
  UpdateImportedInvoiceRequest,
  ApproveImportedInvoiceRequest,
  FinanceSummary,
  AgentPL,
  LeadROI,
  Chargeback,
  CreateChargebackRequest,
  UpdateChargebackRequest,
  ChargebackSummary,
  LeadProgram,
  LeadProgramEntry,
  CreateLeadProgramRequest,
  CreateLeadProgramEntryRequest,
  LeadProgramProfitability,
  PipelineSummary,
  SalesAnalytics,
  AgentProfitabilityRow,
  DripCampaign,
  DripStep,
  DripExecution,
  ParsedLead,
  CalcomStatus,
  CalcomBooking,
  CalcomEventTypesResponse,
  CalcomBookingsResponse,
  GoogleCalendarEvent,
  GoogleCalendarEventCreate,
  GoogleCalendarAccount,
  WebhookConfig,
  WebhookLog,
  GenerateWebhookKeyResponse,
  AgentWavvData,
  AgentAppointmentData,
  AgentActivityData,
  AgentRecruitsData,
  PostableSettings,
  UpdatePostableSettingsRequest,
  PostableCard,
  Contact,
  ContactsPage,
  ContactTagStat,
  SmartList,
  SmartListFilter,
  CreateContactRequest,
  UpdateContactRequest,
  BulkByFilterRequest,
  BulkActionReport,
  Conversation,
  Message,
  MessageTemplate,
  ConversationListRequest,
  ConversationListResponse,
  ConversationDetailResponse,
  MessageListResponse,
  SendMessageRequest,
  CreateMessageTemplateRequest,
  UpdateMessageTemplateRequest,
  VerificationState,
  AISettings,
  ChatActionResponse,
} from '../types/portal'
import type { AIAction } from '../types/ai-actions'
import { RECRUIT_STAGE_COLORS } from '../types/portal'
import { getApiBaseUrl } from './config'
import { isMockMode } from '../components/sales/sales-mock-mode'
import {
  mockBulkImportSales,
  mockParseCsvRows,
  mockParseDocument,
} from '../components/sales/mock-policies'

// ── Raw API shapes (what the server actually returns) ──────────────────────

interface RawFunnelStage {
  stage: number
  label: string
  count: number
}

interface RawSummary {
  totalActive: number
  totalKicked: number
  atRisk: number
  funnel: RawFunnelStage[]
}

interface RawAgent {
  discordId: string | number
  guildId: string | number
  firstName?: string
  lastName?: string
  state?: string
  agency?: string
  uplineManager?: string
  experienceLevel?: string
  licenseStatus?: string
  licenseVerified?: boolean
  licenseNpn?: string
  currentStage: number
  createdAt?: string
  lastActive?: string
  kickedAt?: string
}

interface RawAtRiskAgent {
  discordId: string | number
  firstName?: string
  lastName?: string
  agency?: string
  currentStage: number
  lastActive?: string
  daysInactive: number
  riskReason?: string
  // some servers may already send snake_case
  discord_id?: string | number
  full_name?: string
  days_inactive?: number
  risk_reason?: string
}

interface RawSalesAgentDirectoryEntry {
  agentId?: string | number | null
  agent_id?: string | number | null
  id?: string | number | null
  displayName?: string | null
  display_name?: string | null
  fullName?: string | null
  full_name?: string | null
  firstName?: string | null
  first_name?: string | null
  lastName?: string | null
  last_name?: string | null
  email?: string | null
  avatarUrl?: string | null
  avatar_url?: string | null
  isCurrentUser?: boolean | null
  is_current_user?: boolean | null
  isActive?: boolean | null
  is_active?: boolean | null
}

type RawSalesAgentDirectoryResponse =
  | RawSalesAgentDirectoryEntry[]
  | { agents?: RawSalesAgentDirectoryEntry[]; salesAgents?: RawSalesAgentDirectoryEntry[]; sales_agents?: RawSalesAgentDirectoryEntry[] }

interface AuthUserResponse {
  id: string
  agentId: string
  email: string
  discordId: string
  displayName: string
  avatarUrl: string
  orgId: string
  roleId: string
  permissions: string[]
}

type RawAuthUserResponse = Partial<AuthUserResponse> & {
  user?: Partial<AuthUserResponse>
}

type RawAuthSessionResponse = RawAuthUserResponse & {
  accessToken?: string
  refreshToken?: string
}

type AuthIdentityRepairResponse = AuthUserResponse & {
  accessToken?: string
  refreshToken?: string
}

// ── Transform helpers ──────────────────────────────────────────────────────

function transformFunnelStages(raw: RawFunnelStage[]): FunnelResponse {
  const stages = raw.map((s) => ({
    stage: s.stage,
    name: s.label,
    count: s.count,
  }))
  const total = stages.reduce((sum, s) => sum + s.count, 0)
  return { stages, total }
}

function transformSummary(raw: RawSummary): DashboardSummary {
  const funnel = raw.funnel ?? []
  const licensed = funnel.find((s) => s.stage === 5)?.count ?? 0
  const students = funnel.find((s) => s.stage === 4)?.count ?? 0
  return {
    total_agents: raw.totalActive + raw.totalKicked,
    active_agents: raw.totalActive,
    students,
    at_risk_count: raw.atRisk ?? 0,
    licensed_count: licensed,
    kicked_count: raw.totalKicked ?? 0,
    avg_days_to_activation: null,
  }
}

function transformAgent(a: RawAgent): AgentSummary {
  const first = a.firstName?.trim() ?? ''
  const last = a.lastName?.trim() ?? ''
  const fullName = [first, last].filter(Boolean).join(' ') || null
  return {
    discord_id: String(a.discordId),
    full_name: fullName,
    agency: a.agency || null,
    current_stage: a.currentStage,
    license_status: a.licenseStatus || null,
    upline_manager: a.uplineManager || null,
    experience_level: a.experienceLevel || null,
    joined_at: a.createdAt || null,
    last_active: a.lastActive || null,
    kicked_at: a.kickedAt || null,
  }
}

function transformAtRisk(a: RawAtRiskAgent): AtRiskAgent {
  const first = a.firstName?.trim() ?? ''
  const last = a.lastName?.trim() ?? ''
  const fullName = [first, last].filter(Boolean).join(' ') || a.full_name || null
  return {
    discord_id: String(a.discordId ?? a.discord_id),
    full_name: fullName,
    agency: a.agency || null,
    current_stage: a.currentStage,
    last_active: a.lastActive || null,
    days_inactive: a.daysInactive ?? a.days_inactive ?? 0,
    risk_reason: a.riskReason ?? a.risk_reason ?? 'Inactive',
  }
}

function normalizeSalesAgent(entry: RawSalesAgentDirectoryEntry): SalesAgentDirectoryEntry | null {
  const agentId = String(entry.agentId ?? entry.agent_id ?? entry.id ?? '').trim()
  if (!agentId) return null

  const firstName = entry.firstName ?? entry.first_name ?? null
  const lastName = entry.lastName ?? entry.last_name ?? null
  const fullName =
    entry.fullName ||
    entry.full_name ||
    [firstName, lastName].filter(Boolean).join(' ').trim()
  const displayName =
    entry.displayName ||
    entry.display_name ||
    fullName ||
    entry.email ||
    `Agent ${agentId.slice(0, 8)}`

  return {
    agentId,
    displayName,
    firstName,
    lastName,
    email: entry.email ?? null,
    avatarUrl: entry.avatarUrl ?? entry.avatar_url ?? null,
    isCurrentUser: Boolean(entry.isCurrentUser ?? entry.is_current_user ?? false),
    isActive: entry.isActive ?? entry.is_active ?? true,
  }
}

function unwrapAuthUserResponse(raw: RawAuthUserResponse): AuthUserResponse {
  const source = raw.user ?? raw
  return {
    id: String(source.id ?? ''),
    agentId: String(source.agentId ?? ''),
    email: String(source.email ?? ''),
    discordId: String(source.discordId ?? ''),
    displayName: String(source.displayName ?? source.email ?? ''),
    avatarUrl: String(source.avatarUrl ?? ''),
    orgId: String(source.orgId ?? ''),
    roleId: String(source.roleId ?? ''),
    permissions: Array.isArray(source.permissions) ? source.permissions : [],
  }
}

// ── API Client ─────────────────────────────────────────────────────────────

class ApiClient {
  private refreshPromise: Promise<string | null> | null = null

  private async getAccessToken(): Promise<string | null> {
    try {
      return await vaultGetAccessToken()
    } catch {
      return null
    }
  }

  private async getHeaders(): Promise<HeadersInit> {
    const token = await this.getAccessToken()

    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    }
  }

  private getBaseUrl(): string {
    return getApiBaseUrl()
  }

  /**
   * Try to refresh the access token using the stored refresh token.
   * Uses a mutex so concurrent 401s share a single refresh request.
   */
  private handleUnauthorized(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise

    this.refreshPromise = this.doRefresh().finally(() => {
      this.refreshPromise = null
    })

    return this.refreshPromise
  }

  private async doRefresh(): Promise<string | null> {
    // Belt-and-suspenders: scrub any stale localStorage tokens before reading
    // from the vault. No-op after first successful call (flag-gated).
    await scrubLocalStorageOnce()

    const refreshToken = await vaultGetRefreshToken()
    if (!refreshToken) return null

    try {
      const baseUrl = this.getBaseUrl()
      const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })

      if (!res.ok) return null

      const data = await res.json()
      await vaultSetAccessToken(data.accessToken)
      if (data.refreshToken) {
        await vaultSetRefreshToken(data.refreshToken)
      }
      return data.accessToken
    } catch {
      return null
    }
  }

  /**
   * Clear all auth tokens and redirect to login.
   */
  private async clearAuthAndRedirect(): Promise<void> {
    try { await vaultClearTokens() } catch { /* ignore */ }
    // Redirect to login — use hash path for HashRouter
    window.location.href = window.location.origin + '/#/login'
  }

  /**
   * Handle 429 responses with exponential backoff.
   * Respects Retry-After header, falls back to 1s/2s/4s delays.
   * Returns the successful response, or throws after 3 retries.
   */
  private async retryOn429(
    doFetch: () => Promise<Response>,
    maxRetries = 3,
  ): Promise<Response> {
    let res = await doFetch()

    for (let attempt = 0; attempt < maxRetries && res.status === 429; attempt++) {
      const retryAfter = res.headers.get('Retry-After')
      const delayMs = retryAfter
        ? Number(retryAfter) * 1000 // Retry-After is in seconds
        : 1000 * Math.pow(2, attempt) // 1s, 2s, 4s
      await sleep(delayMs)
      res = await doFetch()
    }

    return res
  }

  async fetch<T>(path: string): Promise<T> {
    const url = `${this.getBaseUrl()}${path}`
    const headers = await this.getHeaders()
    let res = await this.retryOn429(() => fetch(url, { headers }))

    // 401 interceptor: try token refresh, then retry once
    if (res.status === 401) {
      const newToken = await this.handleUnauthorized()
      if (newToken) {
        const retryHeaders = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${newToken}`,
        }
        res = await this.retryOn429(() => fetch(url, { headers: retryHeaders }))
      } else {
        await this.clearAuthAndRedirect()
        throw new Error('Session expired — please log in again.')
      }
    }

    if (!res.ok) {
      const { message, details } = await readApiError(res)
      throw new ApiError(res.status, message, details)
    }

    return res.json()
  }

  // ── Dashboard ──────────────────────────────────────

  async getFunnel(params?: { dateFrom?: string; dateTo?: string }): Promise<FunnelResponse> {
    const query = new URLSearchParams()
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    const raw = await this.fetch<RawFunnelStage[]>(`/api/v1/dashboard/funnel${qs ? `?${qs}` : ''}`)
    return transformFunnelStages(raw)
  }

  async getSummary(params?: { dateFrom?: string; dateTo?: string }): Promise<DashboardSummary> {
    const query = new URLSearchParams()
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    const raw = await this.fetch<RawSummary>(`/api/v1/dashboard/summary${qs ? `?${qs}` : ''}`)
    return transformSummary(raw)
  }

  async getAtRisk(params?: { dateFrom?: string; dateTo?: string }): Promise<AtRiskAgent[]> {
    const query = new URLSearchParams()
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    const raw = await this.fetch<RawAtRiskAgent[]>(`/api/v1/dashboard/at-risk${qs ? `?${qs}` : ''}`)
    return (raw ?? []).map(transformAtRisk)
  }

  // ── Agents ─────────────────────────────────────────

  async getAgents(params?: {
    stage?: number
    agency?: string
    search?: string
  }): Promise<AgentsListResponse> {
    const query = new URLSearchParams()
    if (params?.stage) query.set('stage', String(params.stage))
    if (params?.agency) query.set('agency', params.agency)
    if (params?.search) query.set('search', params.search)
    const qs = query.toString()
    const raw = await this.fetch<RawAgent[]>(`/api/v1/agents${qs ? `?${qs}` : ''}`)
    const agents = (raw ?? []).map(transformAgent)
    return { agents, total: agents.length }
  }

  async getAgent(discordId: string): Promise<AgentDetail> {
    // Agent detail endpoint — transform base fields and pass rest through
    const raw = await this.fetch<RawAgent & Record<string, unknown>>(`/api/v1/agents/${discordId}`)
    const base = transformAgent(raw)
    return {
      ...base,
      guild_id: String(raw.guildId ?? ''),
      production_written: (raw.productionWritten as string) ?? null,
      lead_source: (raw.leadSource as string) ?? null,
      vision_goals: (raw.visionGoals as string) ?? null,
      npn: (raw.licenseNpn as string) ?? null,
      license_number: (raw.licenseNumber as string) ?? null,
      resident_state: (raw.state as string) ?? null,
      verified_at: (raw.verifiedAt as string) ?? null,
      notification_pref: (raw.notificationPref as string) ?? null,
      contracting_booked: Number(raw.contractingBooked ?? 0),
      contracting_completed: Number(raw.contractingCompleted ?? 0),
      setup_completed: Number(raw.setupCompleted ?? 0),
      form_completed_at: (raw.formCompletedAt as string) ?? null,
      sorted_at: (raw.sortedAt as string) ?? null,
      activated_at: (raw.activatedAt as string) ?? null,
      kick_reason: (raw.kickReason as string) ?? null,
      activity: (raw.activity as AgentDetail['activity']) ?? [],
      checkins: (raw.checkins as AgentDetail['checkins']) ?? [],
      setup_items: (raw.setupItems as AgentDetail['setup_items']) ?? [],
    }
  }

  // ── Health Check ───────────────────────────────────

  async healthCheck(): Promise<boolean> {
    try {
      await this.fetch('/api/v1/health')
      return true
    } catch {
      return false
    }
  }

  // ── Mutating fetch (POST/PUT/DELETE) ────────────────

  async fetchMutate<T>(path: string, method: string, body?: unknown): Promise<T> {
    const url = `${this.getBaseUrl()}${path}`
    const headers = await this.getHeaders()
    const opts = {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }
    let res = await this.retryOn429(() => fetch(url, opts))

    // 401 interceptor: try token refresh, then retry once
    if (res.status === 401) {
      const newToken = await this.handleUnauthorized()
      if (newToken) {
        const retryOpts = {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${newToken}`,
          },
          body: body ? JSON.stringify(body) : undefined,
        }
        res = await this.retryOn429(() => fetch(url, retryOpts))
      } else {
        await this.clearAuthAndRedirect()
        throw new Error('Session expired — please log in again.')
      }
    }

    if (!res.ok) {
      const { message, details } = await readApiError(res)
      throw new ApiError(res.status, message, details)
    }
    if (res.status === 204) return undefined as T
    return res.json()
  }

  // ── Profile ─────────────────────────────────────────

  async getProfile(agentId: string): Promise<AgentProfile> {
    return this.fetch(`/api/v1/portal/profile/${agentId}`)
  }

  async updateProfile(agentId: string, data: Partial<AgentProfile>): Promise<AgentProfile> {
    return this.fetchMutate(`/api/v1/portal/profile/${agentId}`, 'PUT', data)
  }

  async setManager(agentId: string, managerId: string | null): Promise<AgentProfile> {
    return this.fetchMutate(`/api/v1/portal/profile/${agentId}/manager`, 'PUT', { managerId })
  }

  async setCompTier(agentId: string, compTierId: string | null): Promise<AgentProfile> {
    return this.fetchMutate(`/api/v1/portal/profile/${agentId}/comp-tier`, 'PUT', { compTierId })
  }

  // ── Agent Leads ─────────────────────────────────────

  async getAgentLeads(agentId: string, params?: { status?: string }): Promise<AgentLead[]> {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    const qs = query.toString()
    return this.fetch(`/api/v1/portal/agents/${agentId}/leads${qs ? `?${qs}` : ''}`)
  }

  async createAgentLead(agentId: string, data: CreateAgentLeadRequest): Promise<AgentLead> {
    return this.fetchMutate(`/api/v1/portal/agents/${agentId}/leads`, 'POST', data)
  }

  async updateAgentLead(agentId: string, leadId: string, data: UpdateAgentLeadRequest): Promise<AgentLead> {
    return this.fetchMutate(`/api/v1/portal/agents/${agentId}/leads/${leadId}`, 'PUT', data)
  }

  async deleteAgentLead(agentId: string, leadId: string): Promise<void> {
    await this.fetchMutate(`/api/v1/portal/agents/${agentId}/leads/${leadId}`, 'DELETE')
  }

  // ── Training ────────────────────────────────────────

  async getTrainingItems(agentId: string): Promise<AgentTrainingItem[]> {
    return this.fetch(`/api/v1/portal/agents/${agentId}/training`)
  }

  async createTrainingItem(agentId: string, data: CreateTrainingItemRequest): Promise<AgentTrainingItem> {
    return this.fetchMutate(`/api/v1/portal/agents/${agentId}/training`, 'POST', data)
  }

  async updateTrainingItem(agentId: string, itemId: string, data: UpdateTrainingItemRequest): Promise<AgentTrainingItem> {
    return this.fetchMutate(`/api/v1/portal/agents/${agentId}/training/${itemId}`, 'PUT', data)
  }

  async deleteTrainingItem(agentId: string, itemId: string): Promise<void> {
    await this.fetchMutate(`/api/v1/portal/agents/${agentId}/training/${itemId}`, 'DELETE')
  }

  // ── Schedule ────────────────────────────────────────

  async getScheduleEvents(agentId: string, params?: { start?: string; end?: string }): Promise<AgentScheduleEvent[]> {
    const query = new URLSearchParams()
    if (params?.start) query.set('start', params.start)
    if (params?.end) query.set('end', params.end)
    const qs = query.toString()
    return this.fetch(`/api/v1/portal/agents/${agentId}/schedule${qs ? `?${qs}` : ''}`)
  }

  async createScheduleEvent(agentId: string, data: CreateScheduleEventRequest): Promise<AgentScheduleEvent> {
    return this.fetchMutate(`/api/v1/portal/agents/${agentId}/schedule`, 'POST', data)
  }

  async updateScheduleEvent(agentId: string, eventId: string, data: UpdateScheduleEventRequest): Promise<AgentScheduleEvent> {
    return this.fetchMutate(`/api/v1/portal/agents/${agentId}/schedule/${eventId}`, 'PUT', data)
  }

  async deleteScheduleEvent(agentId: string, eventId: string): Promise<void> {
    await this.fetchMutate(`/api/v1/portal/agents/${agentId}/schedule/${eventId}`, 'DELETE')
  }

  // ── Sales ──────────────────────────────────────────

  async getAllSales(params?: { page?: number; status?: string; agentId?: string; policyType?: string; carrier?: string; dateFrom?: string; dateTo?: string }): Promise<{ sales: Sale[]; total: number; totalPremium: number; activeCount: number }> {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.status) query.set('status', params.status)
    if (params?.agentId) query.set('agentId', params.agentId)
    if (params?.policyType) query.set('policyType', params.policyType)
    if (params?.carrier) query.set('carrier', params.carrier)
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/portal/sales${qs ? `?${qs}` : ''}`)
  }

  async getAgentSales(agentId: string, params?: { status?: string }): Promise<Sale[]> {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    const qs = query.toString()
    return this.fetch(`/api/v1/portal/sales/agent/${agentId}${qs ? `?${qs}` : ''}`)
  }

  async getAgentSalesStats(agentId: string): Promise<SaleStats> {
    return this.fetch(`/api/v1/portal/sales/agent/${agentId}/stats`)
  }

  async getSalesAgentDirectory(params?: { search?: string; includeInactive?: boolean }): Promise<SalesAgentDirectoryEntry[]> {
    const query = new URLSearchParams()
    if (params?.search) query.set('search', params.search)
    if (params?.includeInactive) query.set('includeInactive', 'true')
    const qs = query.toString()
    const raw = await this.fetch<RawSalesAgentDirectoryResponse>(
      `/api/v1/portal/sales/agents${qs ? `?${qs}` : ''}`,
    )
    const rows = Array.isArray(raw) ? raw : raw.agents ?? raw.salesAgents ?? raw.sales_agents ?? []
    return rows
      .map(normalizeSalesAgent)
      .filter((agent): agent is SalesAgentDirectoryEntry => agent !== null)
  }

  async createSale(data: CreateSaleRequest): Promise<Sale> {
    return this.fetchMutate('/api/v1/portal/sales', 'POST', data)
  }

  async updateSale(id: string, data: UpdateSaleRequest): Promise<Sale> {
    return this.fetchMutate(`/api/v1/portal/sales/${id}`, 'PUT', data)
  }

  async deleteSale(id: string): Promise<void> {
    await this.fetchMutate(`/api/v1/portal/sales/${id}`, 'DELETE')
  }

  async parseTranscript(transcript: string): Promise<Record<string, unknown>> {
    return this.fetchMutate('/api/v1/portal/sales/parse-transcript', 'POST', { transcript })
  }

  async bulkImportSales(sales: Array<Partial<Sale>>): Promise<{
    created: number
    skipped: number
    duplicates: Array<{ policyNumber: string; clientName: string }>
  }> {
    if (isMockMode()) return mockBulkImportSales(sales)
    return this.fetchMutate('/api/v1/portal/sales/bulk-import', 'POST', { sales })
  }

  async parseSalesCsvRows(rows: Array<Record<string, string>>): Promise<{
    rows: Array<Partial<Sale>>
    confidence: Array<Record<string, number>>
  }> {
    if (isMockMode()) return mockParseCsvRows(rows)
    return this.fetchMutate('/api/v1/portal/sales/parse-csv-rows', 'POST', { rows })
  }

  async parseSalesDocument(file: File): Promise<{
    fields: Partial<Sale>
    confidence: Record<string, number>
    raw_text_excerpt: string
  }> {
    if (isMockMode()) return mockParseDocument(file.name)
    // Multipart upload — strip Content-Type so the browser sets the boundary.
    const form = new FormData()
    form.append('file', file)
    const url = `${this.getBaseUrl()}/api/v1/portal/sales/parse-document`
    const headers = { ...(await this.getHeaders()) } as Record<string, string>
    delete headers['Content-Type']
    const res = await fetch(url, { method: 'POST', headers, body: form })
    if (!res.ok) {
      const { message, details } = await readApiError(res)
      throw new ApiError(res.status, `parseSalesDocument failed: ${message}`, details)
    }
    return res.json()
  }

  // ── Org Chart ───────────────────────────────────────

  async getOrgChart(): Promise<OrgChartNode[]> {
    return this.fetch('/api/v1/portal/org-chart')
  }

  async getMyTeam(): Promise<OrgChartNode[]> {
    return this.fetch('/api/v1/portal/org-chart/my-team')
  }

  async assignManager(agentId: string, managerId: string): Promise<void> {
    await this.fetchMutate('/api/v1/portal/org-chart/assign-manager', 'PUT', { agentId, managerId })
  }

  async saveOrgChartPositions(positions: { agentId: string; x: number; y: number }[]): Promise<void> {
    await this.fetchMutate('/api/v1/portal/org-chart/positions', 'PUT', { positions })
  }

  async resetOrgChartPositions(): Promise<void> {
    await this.fetchMutate('/api/v1/portal/org-chart/positions', 'DELETE')
  }

  // ── Comp Tiers ──────────────────────────────────────

  async getCompTiers(): Promise<CompTierWithAgents[]> {
    return this.fetch('/api/v1/portal/comp-tiers')
  }

  async createCompTier(data: { name: string; percentage: number }): Promise<CompTierWithAgents> {
    return this.fetchMutate('/api/v1/portal/comp-tiers', 'POST', data)
  }

  async updateCompTier(id: string, data: { name?: string; percentage?: number }): Promise<CompTierWithAgents> {
    return this.fetchMutate(`/api/v1/portal/comp-tiers/${id}`, 'PUT', data)
  }

  async deleteCompTier(id: string): Promise<void> {
    await this.fetchMutate(`/api/v1/portal/comp-tiers/${id}`, 'DELETE')
  }

  async reorderCompTiers(ids: string[]): Promise<void> {
    await this.fetchMutate('/api/v1/portal/comp-tiers/reorder', 'PUT', { ids })
  }

  async setCompTierWithEmail(agentId: string, compTierId: string | null): Promise<unknown> {
    return this.fetchMutate('/api/v1/portal/org-chart/set-comp-tier', 'PUT', { agentId, compTierId })
  }

  // ── Stage Change ─────────────────────────────────────

  async changeAgentStage(agentId: string, stageId: string): Promise<void> {
    await this.fetchMutate(`/api/v1/portal/agents/${agentId}/stage`, 'PUT', { stageId })
  }

  // ── Discord Lookup ────────────────────────────────────

  async lookupDiscordMember(discordId: string): Promise<DiscordMemberLookup> {
    return this.fetch(`/api/v1/discord/members/${discordId}`)
  }

  // ── Agent Creation + Verification ─────────────────────

  async createAgent(data: CreateAgentRequest): Promise<unknown> {
    return this.fetchMutate('/api/v1/agents', 'POST', data)
  }

  async inviteAgentOnboarding(data: AgentOnboardingInviteRequest): Promise<AgentOnboardingInviteResponse> {
    return this.fetchMutate('/api/v1/agents/onboarding-invite', 'POST', data)
  }

  async verifyAgent(agentId: string, data?: { firstName?: string; lastName?: string; state?: string; npn?: string }): Promise<VerifyAgentResponse> {
    return this.fetchMutate(`/api/v1/agents/${agentId}/verify`, 'POST', data || {})
  }

  async updateAgentRole(discordId: string, role: string): Promise<void> {
    await this.fetchMutate(`/api/v1/agents/${discordId}`, 'PUT', { role })
  }

  // ── Bulk Import ───────────────────────────────────────

  async bulkImportAgents(): Promise<BulkImportResponse> {
    return this.fetchMutate('/api/v1/agents/bulk-import', 'POST', {})
  }

  async deleteAllAgents(): Promise<{ deleted: number }> {
    return this.fetchMutate('/api/v1/agents', 'DELETE')
  }

  // ── Recruits ──────────────────────────────────────────

  async getRecruits(params?: { search?: string; stage?: string; page?: number; perPage?: number }): Promise<RecruitsResponse> {
    const query = new URLSearchParams()
    if (params?.search) query.set('search', params.search)
    if (params?.stage) query.set('stage', params.stage)
    if (params?.page) query.set('page', String(params.page))
    if (params?.perPage) query.set('perPage', String(params.perPage))
    const qs = query.toString()
    return this.fetch(`/api/v1/recruits${qs ? `?${qs}` : ''}`)
  }

  async getRecruitStats(params?: { dateFrom?: string; dateTo?: string }): Promise<RecruitStats> {
    const query = new URLSearchParams()
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/recruits/stats${qs ? `?${qs}` : ''}`)
  }

  async getRecruit(id: string): Promise<Recruit> {
    return this.fetch(`/api/v1/recruits/${id}`)
  }

  async createRecruit(data: CreateRecruitRequest): Promise<Recruit> {
    return this.fetchMutate('/api/v1/recruits', 'POST', data)
  }

  async updateRecruit(id: string, data: UpdateRecruitRequest): Promise<Recruit> {
    return this.fetchMutate(`/api/v1/recruits/${id}`, 'PUT', data)
  }

  async deleteRecruit(id: string): Promise<void> {
    await this.fetchMutate(`/api/v1/recruits/${id}`, 'DELETE')
  }

  async sendRecruitSms(id: string, data: { body: string; toNumber: string }): Promise<unknown> {
    return this.fetchMutate(`/api/v1/recruits/${id}/sms`, 'POST', data)
  }

  async scheduleRecruitInterview(id: string, data: { interviewType: string; date: string }): Promise<Recruit> {
    return this.fetchMutate(`/api/v1/recruits/${id}/schedule`, 'POST', data)
  }

  async onboardRecruit(id: string): Promise<{ recruit: Recruit; agent: unknown }> {
    return this.fetchMutate(`/api/v1/recruits/${id}/onboard`, 'POST')
  }

  async bulkImportRecruits(data: { recruits: Array<{ firstName: string; lastName: string; phone?: string; tags?: string; smsMessage?: string; source?: string }> }): Promise<{ created: number; skipped: number; queued: number }> {
    return this.fetchMutate('/api/v1/recruits/bulk-import', 'POST', data)
  }

  async getRecruitMessages(id: string): Promise<SmsMessage[]> {
    return this.fetch(`/api/v1/recruits/${id}/messages`)
  }

  async getRecruitFunnel(params?: { leadSource?: string; dateFrom?: string; dateTo?: string }): Promise<RecruitFunnelData> {
    const query = new URLSearchParams()
    if (params?.leadSource) query.set('leadSource', params.leadSource)
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/recruits/funnel${qs ? `?${qs}` : ''}`)
  }

  async updateOnboardingChecklist(id: string, updates: Partial<OnboardingChecklist>): Promise<Recruit> {
    return this.fetchMutate(`/api/v1/recruits/${id}/checklist`, 'PUT', updates)
  }

  // ── Webhooks ─────────────────────────────────────────────

  async getWebhookConfig(): Promise<WebhookConfig | null> {
    return this.fetch('/api/v1/webhooks/config')
  }

  async generateWebhookKey(): Promise<GenerateWebhookKeyResponse> {
    return this.fetchMutate('/api/v1/webhooks/config/generate', 'POST')
  }

  async updateWebhookConfig(data: { enabled?: boolean }): Promise<WebhookConfig> {
    return this.fetchMutate('/api/v1/webhooks/config', 'PUT', data)
  }

  async revokeWebhookKey(): Promise<void> {
    await this.fetchMutate('/api/v1/webhooks/config', 'DELETE')
  }

  async getWebhookLogs(params?: { page?: number; perPage?: number }): Promise<{ logs: WebhookLog[]; total: number }> {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.perPage) query.set('perPage', String(params.perPage))
    const qs = query.toString()
    return this.fetch(`/api/v1/webhooks/logs${qs ? `?${qs}` : ''}`)
  }

  async testWebhook(): Promise<{ success: boolean; message: string }> {
    return this.fetchMutate('/api/v1/webhooks/config/test', 'POST')
  }

  // ── Postable ──────────────────────────────────────────

  async getPostableSettings(): Promise<PostableSettings> {
    return this.fetch('/api/v1/portal/settings/postable')
  }

  async updatePostableSettings(data: UpdatePostableSettingsRequest): Promise<PostableSettings> {
    return this.fetchMutate('/api/v1/portal/settings/postable', 'PUT', data)
  }

  async listPostableCards(occasionId?: string): Promise<PostableCard[]> {
    const qs = occasionId ? `?occasion_id=${occasionId}` : ''
    return this.fetch(`/api/v1/portal/postable/cards${qs}`)
  }

  async testPostableConnection(): Promise<{ success: boolean; message: string }> {
    return this.fetchMutate('/api/v1/portal/postable/test', 'POST')
  }

  async sendPostcard(saleId: string): Promise<{ success: boolean; message: string }> {
    return this.fetchMutate(`/api/v1/portal/sales/${saleId}/postcard`, 'POST')
  }

  // ── Analytics ─────────────────────────────────────────

  async getConversionAnalytics(params?: { guildId?: string; dateFrom?: string; dateTo?: string }): Promise<ConversionDataPoint[]> {
    const query = new URLSearchParams()
    if (params?.guildId) query.set('guild_id', params.guildId)
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/analytics/conversion${qs ? `?${qs}` : ''}`)
  }

  async getSourceAnalytics(params?: { guildId?: string; dateFrom?: string; dateTo?: string }): Promise<SourceDataPoint[]> {
    const query = new URLSearchParams()
    if (params?.guildId) query.set('guild_id', params.guildId)
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/analytics/sources${qs ? `?${qs}` : ''}`)
  }

  async getTrendsAnalytics(params?: { guildId?: string; dateFrom?: string; dateTo?: string }): Promise<TrendDataPoint[]> {
    const query = new URLSearchParams()
    if (params?.guildId) query.set('guild_id', params.guildId)
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/analytics/trends${qs ? `?${qs}` : ''}`)
  }

  async getStageDurationAnalytics(params?: { guildId?: string; dateFrom?: string; dateTo?: string }): Promise<StageDurationDataPoint[]> {
    const query = new URLSearchParams()
    if (params?.guildId) query.set('guild_id', params.guildId)
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/analytics/stage-duration${qs ? `?${qs}` : ''}`)
  }

  async exportCsv(guildId?: string): Promise<Blob> {
    const qs = guildId ? `?guild_id=${guildId}` : ''
    const url = `${this.getBaseUrl()}/api/v1/analytics/export/csv${qs}`
    const headers = await this.getHeaders()
    let res = await fetch(url, { headers })

    if (res.status === 401) {
      const newToken = await this.handleUnauthorized()
      if (newToken) {
        res = await fetch(url, {
          headers: { Authorization: `Bearer ${newToken}` },
        })
      } else {
        await this.clearAuthAndRedirect()
        throw new Error('Session expired — please log in again.')
      }
    }

    if (!res.ok) throw new Error(`API ${res.status}: Export failed`)
    return res.blob()
  }

  // ── Licenses ──────────────────────────────────────────

  async getLicenses(params?: { agentId?: string; state?: string; status?: string }): Promise<License[]> {
    const query = new URLSearchParams()
    if (params?.agentId) query.set('agentId', params.agentId)
    if (params?.state) query.set('state', params.state)
    if (params?.status) query.set('status', params.status)
    const qs = query.toString()
    return this.fetch(`/api/v1/licenses${qs ? `?${qs}` : ''}`)
  }

  async createLicense(data: CreateLicenseRequest): Promise<License> {
    return this.fetchMutate('/api/v1/licenses', 'POST', data)
  }

  async getLicense(id: string): Promise<License> {
    return this.fetch(`/api/v1/licenses/${id}`)
  }

  async updateLicense(id: string, data: UpdateLicenseRequest): Promise<License> {
    return this.fetchMutate(`/api/v1/licenses/${id}`, 'PUT', data)
  }

  async deleteLicense(id: string): Promise<void> {
    await this.fetchMutate(`/api/v1/licenses/${id}`, 'DELETE')
  }

  async getLicenseStats(agentId?: string): Promise<LicenseStats> {
    const qs = agentId ? `?agentId=${encodeURIComponent(agentId)}` : ''
    return this.fetch(`/api/v1/licenses/stats${qs}`)
  }

  async getExpiringLicenses(days: number = 60): Promise<License[]> {
    return this.fetch(`/api/v1/admin/licenses/expiring?days=${days}`)
  }

  async listLicenseAppointments(licenseId: string): Promise<LicenseAppointment[]> {
    return this.fetch(`/api/v1/licenses/${licenseId}/appointments`)
  }

  async createLicenseAppointment(
    licenseId: string,
    data: CreateLicenseAppointmentRequest,
  ): Promise<LicenseAppointment> {
    return this.fetchMutate(`/api/v1/licenses/${licenseId}/appointments`, 'POST', data)
  }

  async deleteLicenseAppointment(licenseId: string, appointmentId: string): Promise<void> {
    await this.fetchMutate(
      `/api/v1/licenses/${licenseId}/appointments/${appointmentId}`,
      'DELETE',
    )
  }

  async listLicenseDocuments(licenseId: string): Promise<LicenseDocument[]> {
    return this.fetch(`/api/v1/licenses/${licenseId}/documents`)
  }

  // ── Notifications ─────────────────────────────────────

  async getNotifications(params?: { type?: string; page?: number; perPage?: number }): Promise<NotificationsResponse> {
    const query = new URLSearchParams()
    if (params?.type) query.set('type', params.type)
    if (params?.page) query.set('page', String(params.page))
    if (params?.perPage) query.set('perPage', String(params.perPage))
    const qs = query.toString()
    return this.fetch(`/api/v1/notifications${qs ? `?${qs}` : ''}`)
  }

  async getUnreadCount(): Promise<{ count: number }> {
    return this.fetch('/api/v1/notifications/unread-count')
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.fetchMutate(`/api/v1/notifications/${id}/read`, 'POST')
  }

  async markAllNotificationsRead(): Promise<void> {
    await this.fetchMutate('/api/v1/notifications/read-all', 'POST')
  }

  // ── Activity Log ──────────────────────────────────────

  async getActivityLog(params?: { guild_id?: string; action_type?: string; limit?: number; dateFrom?: string; dateTo?: string }): Promise<ActivityLogEntry[]> {
    const query = new URLSearchParams()
    if (params?.guild_id) query.set('guild_id', params.guild_id)
    if (params?.action_type) query.set('action_type', params.action_type)
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/activity${qs ? `?${qs}` : ''}`)
  }

  async sendAnnouncement(data: { guildId: string; channelId: string; message: string }): Promise<void> {
    await this.fetchMutate('/api/v1/activity/announce', 'POST', data)
  }

  // ── Appointments ──────────────────────────────────────

  async getAppointments(params?: { status?: string; page?: number; perPage?: number }): Promise<AppointmentsResponse> {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    if (params?.page) query.set('page', String(params.page))
    if (params?.perPage) query.set('perPage', String(params.perPage))
    const qs = query.toString()
    return this.fetch(`/api/v1/appointments${qs ? `?${qs}` : ''}`)
  }

  async getUpcomingAppointments(from?: string, to?: string): Promise<Appointment[]> {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const qs = params.toString()
    return this.fetch(`/api/v1/appointments/upcoming${qs ? `?${qs}` : ''}`)
  }

  async createAppointment(data: CreateAppointmentRequest): Promise<Appointment> {
    return this.fetchMutate('/api/v1/appointments', 'POST', data)
  }

  async updateAppointmentStatus(id: string, status: string): Promise<Appointment> {
    return this.fetchMutate(`/api/v1/appointments/${id}/status`, 'PUT', { status })
  }

  async deleteAppointment(id: string): Promise<void> {
    await this.fetchMutate(`/api/v1/appointments/${id}`, 'DELETE')
  }

  async rescheduleAppointment(id: string, startTime: string, endTime: string): Promise<Appointment> {
    return this.fetchMutate<Appointment>(`/api/v1/appointments/${id}/reschedule`, 'PUT', { startTime, endTime })
  }

  // ── SMS ───────────────────────────────────────────────

  async sendSms(data: { agentId: string; message: string }): Promise<unknown> {
    return this.fetchMutate('/api/v1/sms/send', 'POST', data)
  }

  async sendSmsCampaign(data: { stageId?: string; guildId?: string; message: string }): Promise<{ total: number; sent: number; failed: number }> {
    return this.fetchMutate('/api/v1/sms/campaign', 'POST', data)
  }

  async getSmsHistory(params?: { agent_id?: string; guild_id?: string; page?: number; perPage?: number }): Promise<SmsHistoryResponse> {
    const query = new URLSearchParams()
    if (params?.agent_id) query.set('agent_id', params.agent_id)
    if (params?.guild_id) query.set('guild_id', params.guild_id)
    if (params?.page) query.set('page', String(params.page))
    if (params?.perPage) query.set('perPage', String(params.perPage))
    const qs = query.toString()
    return this.fetch(`/api/v1/sms/history${qs ? `?${qs}` : ''}`)
  }

  // ── WhatsApp ──────────────────────────────────────────

  async sendWhatsApp(data: { to: string; body: string; recruitId?: string }): Promise<{ id: string; sid: string; conversationId: string; status: string }> {
    return this.fetchMutate('/api/v1/whatsapp/messages', 'POST', { ...data, send: true })
  }

  async getWhatsAppConversations(sessionId?: string): Promise<WhatsAppConversation[]> {
    if (!sessionId) {
      // Get first available session
      const sessions = await this.fetch<{ id: string }[]>('/api/v1/whatsapp/sessions')
      if (!sessions?.length) return []
      sessionId = sessions[0].id
    }
    return this.fetch(`/api/v1/whatsapp/sessions/${sessionId}/conversations`)
  }

  async getAllWhatsAppConversations(): Promise<WhatsAppConversation[]> {
    return this.fetch('/api/v1/whatsapp/conversations')
  }

  async linkConversationToRecruit(conversationId: string, recruitId: string): Promise<{ status: string }> {
    return this.fetchMutate(`/api/v1/whatsapp/conversations/${conversationId}/link`, 'PUT', { recruitId })
  }

  async getWhatsAppMessages(conversationId: string): Promise<WhatsAppMessage[]> {
    return this.fetch(`/api/v1/whatsapp/conversations/${conversationId}/messages`)
  }

  // ── Dashboard Enhanced ────────────────────────────────

  async getDashboardStats(params?: { guildId?: string; dateFrom?: string; dateTo?: string }): Promise<DashboardStats> {
    const query = new URLSearchParams()
    if (params?.guildId) query.set('guild_id', params.guildId)
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/dashboard/stats${qs ? `?${qs}` : ''}`)
  }

  async getRevenueChart(params?: { dateFrom?: string; dateTo?: string }): Promise<RevenueChartPoint[]> {
    const query = new URLSearchParams()
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/dashboard/revenue-chart${qs ? `?${qs}` : ''}`)
  }

  async getLeaderboard(params?: { dateFrom?: string; dateTo?: string }): Promise<LeaderboardEntry[]> {
    const query = new URLSearchParams()
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/dashboard/leaderboard${qs ? `?${qs}` : ''}`)
  }

  async getPipelineValue(params?: { dateFrom?: string; dateTo?: string }): Promise<PipelineValueEntry[]> {
    const query = new URLSearchParams()
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/dashboard/pipeline-value${qs ? `?${qs}` : ''}`)
  }

  // ── Servers ───────────────────────────────────────────

  async getServers(): Promise<Server[]> {
    return this.fetch('/api/v1/servers')
  }

  async createServer(data: { discordGuildId: string; guildName: string; ownerDiscordId: string; iconUrl?: string }): Promise<Server> {
    return this.fetchMutate('/api/v1/servers', 'POST', data)
  }

  async deleteServer(id: string): Promise<void> {
    await this.fetchMutate(`/api/v1/servers/${id}`, 'DELETE')
  }

  async getServerInviteLink(guildId?: string): Promise<{ url: string }> {
    return this.fetch(`/api/v1/servers/bot-invite`)
  }

  // ── WAVV Tracker ──────────────────────────────────────

  async getWavvOverview(params?: { from?: string; to?: string }): Promise<{
    totalDials: number; totalConnections: number; totalTalkMins: number
    totalAppointments: number; totalPolicies: number; agentCount: number
  }> {
    const query = new URLSearchParams()
    if (params?.from) query.set('from', params.from)
    if (params?.to) query.set('to', params.to)
    const qs = query.toString()
    return this.fetch(`/api/v1/wavv/overview${qs ? `?${qs}` : ''}`)
  }

  async getWavvTeams(params?: { from?: string; to?: string }): Promise<{
    agency: string; agentCount: number; dials: number; connections: number
    talkTimeMins: number; appointments: number; policies: number
  }[]> {
    const query = new URLSearchParams()
    if (params?.from) query.set('from', params.from)
    if (params?.to) query.set('to', params.to)
    const qs = query.toString()
    return this.fetch(`/api/v1/wavv/teams${qs ? `?${qs}` : ''}`)
  }

  async getWavvLeaderboard(params?: { from?: string; to?: string }): Promise<{
    discordId: string; firstName: string; lastName: string; agency: string
    dials: number; connections: number; talkTimeMins: number
    appointments: number; callbacks: number; policies: number; sessionCount: number
  }[]> {
    const query = new URLSearchParams()
    if (params?.from) query.set('from', params.from)
    if (params?.to) query.set('to', params.to)
    const qs = query.toString()
    return this.fetch(`/api/v1/wavv/leaderboard${qs ? `?${qs}` : ''}`)
  }

  // ── Audit Log ──────────────────────────────────────────

  async getAuditLog(params?: { limit?: number; offset?: number }): Promise<{
    id: number; orgId: string; userId: string; action: string
    resourceType: string; resourceId: string; details: Record<string, unknown>
    ipAddress: string; createdAt: string
  }[]> {
    const query = new URLSearchParams()
    if (params?.limit) query.set('limit', String(params.limit))
    if (params?.offset) query.set('offset', String(params.offset))
    const qs = query.toString()
    return this.fetch(`/api/v1/audit${qs ? `?${qs}` : ''}`)
  }

  // ── Documents ──────────────────────────────────────────

  async getDocuments(agent?: string): Promise<{
    id: string; orgId: string; agentDiscordId: string; uploadedBy: string
    filename: string; fileUrl: string; category: string; fileSize: number
    mimeType: string; createdAt: string; updatedAt: string
  }[]> {
    const qs = agent ? `?agent=${agent}` : ''
    return this.fetch(`/api/v1/documents${qs}`)
  }

  async createDocument(data: {
    agentDiscordId?: string; filename: string; fileUrl: string
    category?: string; fileSize?: number; mimeType?: string
  }): Promise<{ id: string; status: string }> {
    return this.fetchMutate('/api/v1/documents', 'POST', data)
  }

  async deleteDocument(id: string): Promise<void> {
    await this.fetchMutate(`/api/v1/documents/${id}`, 'DELETE')
  }

  // ── Campaigns ──────────────────────────────────────────

  async getCampaigns(): Promise<{
    id: string; orgId: string; createdBy: string; name: string; channel: string
    targetType: string; targetFilter: Record<string, unknown>; messageTemplate: string
    status: string; scheduledAt: string | null; sentAt: string | null
    sentCount: number; createdAt: string; updatedAt: string
  }[]> {
    return this.fetch('/api/v1/campaigns')
  }

  async createCampaign(data: {
    name: string; channel?: string; targetType?: string
    messageTemplate?: string; status?: string; scheduledAt?: string
  }): Promise<{ id: string; status: string }> {
    return this.fetchMutate('/api/v1/campaigns', 'POST', data)
  }

  async updateCampaignStatus(id: string, status: string): Promise<void> {
    await this.fetchMutate(`/api/v1/campaigns/${id}/status`, 'PUT', { status })
  }

  async deleteCampaign(id: string): Promise<void> {
    await this.fetchMutate(`/api/v1/campaigns/${id}`, 'DELETE')
  }

  // ── Users & Roles ──────────────────────────────────────

  async getUsers(): Promise<{
    id: string; email: string; discordId: string; displayName: string
    avatarUrl: string; orgId: string; roleId: string; isActive: boolean
    lastLoginAt: string | null; createdAt: string; updatedAt: string
  }[]> {
    return this.fetch('/api/v1/users')
  }

  async updateUser(id: string, data: {
    roleId?: string; isActive?: boolean; displayName?: string
  }): Promise<void> {
    await this.fetchMutate(`/api/v1/users/${id}`, 'PUT', data)
  }

  async getRoles(): Promise<{
    id: string; name: string; permissions: string[]
    isSystem: boolean; sortOrder: number; createdAt: string
  }[]> {
    return this.fetch('/api/v1/roles')
  }

  async createRole(data: { name: string; permissions: string[] }): Promise<{ id: string; status: string }> {
    return this.fetchMutate('/api/v1/roles', 'POST', data)
  }

  async updateRole(id: string, data: { name: string; permissions: string[] }): Promise<void> {
    await this.fetchMutate(`/api/v1/roles/${id}`, 'PUT', data)
  }

  async deleteRole(id: string): Promise<void> {
    await this.fetchMutate(`/api/v1/roles/${id}`, 'DELETE')
  }

  // ── Reports ─────────────────────────────────────────────

  async getAgentReport(): Promise<unknown[]> {
    return this.fetch('/api/v1/reports/agents')
  }

  async getProductionReport(params?: { from?: string; to?: string }): Promise<{
    discordId: string; firstName: string; lastName: string; agency: string
    dials: number; connections: number; talkTimeMins: number
    appointments: number; callbacks: number; policies: number; sessionCount: number
  }[]> {
    const query = new URLSearchParams()
    if (params?.from) query.set('from', params.from)
    if (params?.to) query.set('to', params.to)
    const qs = query.toString()
    return this.fetch(`/api/v1/reports/production${qs ? `?${qs}` : ''}`)
  }
  // ── Bug Reports ──────────────────────────────────────

  async submitBugReport(data: CreateBugReportRequest): Promise<{ id: string; status: string }> {
    return this.fetchMutate('/api/v1/bug-reports', 'POST', data)
  }

  async getBugReports(): Promise<BugReport[]> {
    return this.fetch('/api/v1/bug-reports')
  }

  // ── Pending Joins ─────────────────────────────────────────────
  async getPendingJoins(guildId?: string): Promise<PendingJoinsResponse> {
    const params = guildId ? `?guild_id=${guildId}` : ''
    return this.fetch(`/api/v1/pending-joins${params}`)
  }

  async approvePendingJoin(id: string): Promise<PendingJoin> {
    return this.fetchMutate(`/api/v1/pending-joins/${id}/approve`, 'POST')
  }

  async rejectPendingJoin(id: string, kick = false): Promise<PendingJoin> {
    return this.fetchMutate(`/api/v1/pending-joins/${id}/reject`, 'POST', { kick })
  }

  async bulkPendingJoins(ids: string[], action: 'approve' | 'reject', kick = false): Promise<{ updated: PendingJoin[]; count: number }> {
    return this.fetchMutate('/api/v1/pending-joins/bulk', 'POST', { ids, action, kick })
  }

  // ── Calendar Integrations ────────────────────────────────────
  async getGoogleAuthUrl() {
    return this.fetch<{ url: string }>('/api/v1/integrations/google/authorize')
  }
  async getGoogleStatus() {
    return this.fetch<IntegrationStatus>('/api/v1/integrations/google/status')
  }
  async disconnectGoogle() {
    return this.fetchMutate<{ disconnected: boolean }>('/api/v1/integrations/google', 'DELETE')
  }
  async syncGoogleCalendar() {
    return this.fetchMutate<{ synced: number }>('/api/v1/integrations/google/sync', 'POST')
  }
  async getGoogleCalendarEvents(params: { timeMin: string; timeMax: string }): Promise<GoogleCalendarEvent[]> {
    const sp = new URLSearchParams({ timeMin: params.timeMin, timeMax: params.timeMax })
    return this.fetch<GoogleCalendarEvent[]>(`/api/v1/integrations/google/events?${sp}`)
  }
  async createGoogleCalendarEvent(event: GoogleCalendarEventCreate): Promise<GoogleCalendarEvent> {
    return this.fetchMutate<GoogleCalendarEvent>('/api/v1/integrations/google/events', 'POST', event)
  }
  async updateGoogleCalendarEvent(eventId: string, updates: Partial<GoogleCalendarEventCreate>): Promise<GoogleCalendarEvent> {
    return this.fetchMutate<GoogleCalendarEvent>(`/api/v1/integrations/google/events/${eventId}`, 'PUT', updates)
  }
  async deleteGoogleCalendarEvent(eventId: string): Promise<void> {
    return this.fetchMutate<void>(`/api/v1/integrations/google/events/${eventId}`, 'DELETE')
  }

  // ── Multi-Account Google Calendar ────────────────────────────
  async getGoogleCalendarAccounts(): Promise<GoogleCalendarAccount[]> {
    return this.fetch<GoogleCalendarAccount[]>('/api/v1/integrations/google/accounts')
  }

  async addGoogleCalendarAccount(): Promise<{ url: string }> {
    return this.fetchMutate<{ url: string }>('/api/v1/integrations/google/accounts', 'POST')
  }

  async removeGoogleCalendarAccount(accountId: string): Promise<void> {
    return this.fetchMutate<void>(`/api/v1/integrations/google/accounts/${accountId}`, 'DELETE')
  }

  async getGoogleAccountEvents(accountId: string, params: { timeMin: string; timeMax: string }): Promise<GoogleCalendarEvent[]> {
    const sp = new URLSearchParams({ timeMin: params.timeMin, timeMax: params.timeMax })
    return this.fetch<GoogleCalendarEvent[]>(`/api/v1/integrations/google/accounts/${accountId}/events?${sp}`)
  }

  async updateGoogleAccountEvent(accountId: string, eventId: string, updates: Partial<GoogleCalendarEventCreate>): Promise<GoogleCalendarEvent> {
    return this.fetchMutate<GoogleCalendarEvent>(`/api/v1/integrations/google/accounts/${accountId}/events/${eventId}`, 'PUT', updates)
  }

  async deleteGoogleAccountEvent(accountId: string, eventId: string): Promise<void> {
    return this.fetchMutate<void>(`/api/v1/integrations/google/accounts/${accountId}/events/${eventId}`, 'DELETE')
  }

  async getMicrosoftAuthUrl() {
    return this.fetch<{ url: string }>('/api/v1/integrations/microsoft/authorize')
  }
  async getMicrosoftStatus() {
    return this.fetch<IntegrationStatus>('/api/v1/integrations/microsoft/status')
  }
  async disconnectMicrosoft() {
    return this.fetchMutate<{ disconnected: boolean }>('/api/v1/integrations/microsoft', 'DELETE')
  }
  async syncMicrosoftCalendar() {
    return this.fetchMutate<{ synced: number }>('/api/v1/integrations/microsoft/sync', 'POST')
  }

  // ── Cal.com ──
  async getCalcomStatus() {
    return this.fetch<{ connected: boolean; bookingUrl?: string; defaultDuration?: number; autoSync?: boolean }>('/api/v1/integrations/calcom/status')
  }
  async connectCalcom(apiKey: string) {
    return this.fetchMutate<{ connected: boolean }>('/api/v1/integrations/calcom/connect', 'POST', { apiKey })
  }
  async disconnectCalcom() {
    return this.fetchMutate<{ disconnected: boolean }>('/api/v1/integrations/calcom', 'DELETE')
  }

  // ── Cal.com v2 Proxy ──
  async getCalcomV2Status(): Promise<CalcomStatus> {
    return this.fetch('/api/v1/calcom/status')
  }
  async getCalcomEventTypes(): Promise<CalcomEventTypesResponse> {
    return this.fetch('/api/v1/calcom/event-types')
  }
  async getCalcomBookings(params?: { status?: string; afterStart?: string; beforeEnd?: string }): Promise<CalcomBookingsResponse> {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    if (params?.afterStart) query.set('afterStart', params.afterStart)
    if (params?.beforeEnd) query.set('beforeEnd', params.beforeEnd)
    const qs = query.toString()
    return this.fetch(`/api/v1/calcom/bookings${qs ? `?${qs}` : ''}`)
  }
  async getCalcomBookingDetail(uid: string): Promise<{ status: string; data: CalcomBooking }> {
    return this.fetch(`/api/v1/calcom/bookings/${encodeURIComponent(uid)}`)
  }
  async getCalcomSlots(params: { startTime: string; endTime: string; eventTypeId?: number }): Promise<unknown> {
    const query = new URLSearchParams({ startTime: params.startTime, endTime: params.endTime })
    if (params.eventTypeId) query.set('eventTypeId', String(params.eventTypeId))
    return this.fetch(`/api/v1/calcom/slots?${query}`)
  }

  // ── AI Chat ──────────────────────────────────────────────────
  async sendChatMessage(message: string, conversationId?: string) {
    return this.fetchMutate<{ conversationId: string; message: string; role: string; actions: AIAction[] }>('/api/v1/chat', 'POST', { message, conversationId })
  }
  async getAISettings(): Promise<AISettings> {
    return this.fetch('/api/v1/ai/settings')
  }
  async updateAISettings(settings: Pick<AISettings, 'fullTrustMode' | 'categories'>): Promise<AISettings> {
    return this.fetchMutate('/api/v1/ai/settings', 'PUT', settings)
  }
  async getChatActions(conversationId?: string): Promise<{ actions: AIAction[] }> {
    const query = conversationId ? `?conversationId=${encodeURIComponent(conversationId)}` : ''
    return this.fetch(`/api/v1/chat/actions${query}`)
  }
  async confirmChatAction(actionId: string): Promise<ChatActionResponse> {
    return this.fetchMutate(`/api/v1/chat/actions/${encodeURIComponent(actionId)}/confirm`, 'POST')
  }
  async dismissChatAction(actionId: string): Promise<ChatActionResponse> {
    return this.fetchMutate(`/api/v1/chat/actions/${encodeURIComponent(actionId)}/dismiss`, 'POST')
  }
  async getChatConversations() {
    return this.fetch<{ conversations: ChatConversation[] }>('/api/v1/chat/conversations')
  }
  async getChatMessages(conversationId: string) {
    return this.fetch<{ messages: ChatMessage[] }>(`/api/v1/chat/conversations/${conversationId}/messages`)
  }
  async deleteChatConversation(conversationId: string) {
    return this.fetchMutate<{ deleted: boolean }>(`/api/v1/chat/conversations/${conversationId}`, 'DELETE')
  }
  async renameChatConversation(conversationId: string, title: string) {
    return this.fetchMutate<{ updated: boolean }>(`/api/v1/chat/conversations/${conversationId}`, 'PATCH', { title })
  }

  // ── Profile ──────────────────────────────────────────────────────

  async updateMe(data: { displayName?: string; email?: string; timezone?: string; phone?: string }) {
    return this.fetchMutate<{ id: string; agentId: string; email: string; discordId: string; displayName: string; avatarUrl: string; orgId: string; roleId: string; permissions: string[] }>('/api/v1/auth/me', 'PATCH', data)
  }

  async repairAuthIdentity(): Promise<AuthIdentityRepairResponse> {
    const raw = await this.fetchMutate<RawAuthSessionResponse>('/api/v1/auth/me/repair-agent-id', 'POST')
    if (raw.accessToken) {
      await vaultSetAccessToken(raw.accessToken)
    }
    if (raw.refreshToken) {
      await vaultSetRefreshToken(raw.refreshToken)
    }
    return {
      ...unwrapAuthUserResponse(raw),
      accessToken: raw.accessToken,
      refreshToken: raw.refreshToken,
    }
  }

  async getVerificationStatus(): Promise<VerificationState> {
    return this.fetch<VerificationState>('/api/v1/auth/me/verification-status')
  }

  async verifyNpn(body: { npn: string; canonical_name: string; uid: string }): Promise<VerificationState> {
    return this.fetchMutate<VerificationState>('/api/v1/auth/me/verify-npn', 'POST', body)
  }

  // ── Lock-In Planner ──────────────────────────────────────────────

  async getLockIns(orgId?: number): Promise<LockIn[]> {
    const qs = orgId ? `?org_id=${orgId}` : ''
    return this.fetch(`/api/v1/lock-ins${qs}`)
  }

  async getLockIn(id: string): Promise<LockIn> {
    return this.fetch(`/api/v1/lock-ins/${id}`)
  }

  async createLockIn(data: Partial<LockIn>): Promise<LockIn> {
    return this.fetchMutate('/api/v1/lock-ins', 'POST', data)
  }

  async updateLockIn(id: string, data: Partial<LockIn>): Promise<LockIn> {
    return this.fetchMutate(`/api/v1/lock-ins/${id}`, 'PUT', data)
  }

  async deleteLockIn(id: string): Promise<void> {
    await this.fetchMutate(`/api/v1/lock-ins/${id}`, 'DELETE')
  }

  async invitePartner(lockInId: string, data: { orgId: number; orgName: string }): Promise<LockInPartner> {
    return this.fetchMutate(`/api/v1/lock-ins/${lockInId}/invite`, 'POST', data)
  }

  async respondPartnerInvite(lockInId: string, partnerId: string, status: string): Promise<void> {
    await this.fetchMutate(`/api/v1/lock-ins/${lockInId}/partners/${partnerId}`, 'PUT', { status })
  }

  async getLockInAgents(lockInId: string): Promise<LockInAgent[]> {
    return this.fetch(`/api/v1/lock-ins/${lockInId}/agents`)
  }

  async addLockInAgent(lockInId: string, data: Partial<LockInAgent>): Promise<LockInAgent> {
    return this.fetchMutate(`/api/v1/lock-ins/${lockInId}/agents`, 'POST', data)
  }

  async updateLockInAgent(lockInId: string, agentId: string, data: Partial<LockInAgent>): Promise<LockInAgent> {
    return this.fetchMutate(`/api/v1/lock-ins/${lockInId}/agents/${agentId}`, 'PUT', data)
  }

  async getLockInBudget(lockInId: string): Promise<{ items: LockInBudgetItem[]; summary: BudgetSummary }> {
    return this.fetch(`/api/v1/lock-ins/${lockInId}/budget`)
  }

  async addBudgetItem(lockInId: string, data: Partial<LockInBudgetItem>): Promise<LockInBudgetItem> {
    return this.fetchMutate(`/api/v1/lock-ins/${lockInId}/budget`, 'POST', data)
  }

  async getLockInItinerary(lockInId: string): Promise<LockInItineraryItem[]> {
    return this.fetch(`/api/v1/lock-ins/${lockInId}/itinerary`)
  }

  async addItineraryItem(lockInId: string, data: Partial<LockInItineraryItem>): Promise<LockInItineraryItem> {
    return this.fetchMutate(`/api/v1/lock-ins/${lockInId}/itinerary`, 'POST', data)
  }

  async sendLockInChat(lockInId: string, message: string): Promise<{ message: string }> {
    return this.fetchMutate(`/api/v1/lock-ins/${lockInId}/chat`, 'POST', { message })
  }

  // ── Organizations ─────────────────────────────────────

  async getOrganizations(): Promise<{ id: string; name: string; slug: string; createdAt: string; updatedAt: string }[]> {
    return this.fetch('/api/v1/organizations')
  }

  async getOrganization(id: string): Promise<{ id: string; name: string; slug: string; createdAt: string; updatedAt: string }> {
    return this.fetch(`/api/v1/organizations/${id}`)
  }

  async createOrganization(data: { name: string; slug: string }): Promise<{ id: string; name: string; slug: string; createdAt: string; updatedAt: string }> {
    return this.fetchMutate('/api/v1/organizations', 'POST', data)
  }

  async updateOrganization(id: string, data: { name: string; slug: string }): Promise<{ id: string; name: string; slug: string; createdAt: string; updatedAt: string }> {
    return this.fetchMutate(`/api/v1/organizations/${id}`, 'PUT', data)
  }

  async deleteOrganization(id: string): Promise<void> {
    await this.fetchMutate(`/api/v1/organizations/${id}`, 'DELETE')
  }

  // ── Stage Configs (Pipeline Settings) ──────────────────

  async getStageConfigs(): Promise<StageConfig[]> {
    return this.fetch('/api/v1/recruits/stage-configs')
  }

  async updateStageConfig(stage: string, data: Partial<StageConfig>): Promise<StageConfig> {
    return this.fetchMutate(`/api/v1/recruits/stage-configs/${stage}`, 'PUT', data)
  }

  // ── Expenses ──────────────────────────────────────────

  async getExpenses(params?: { page?: number; category?: string; agentId?: string; dateFrom?: string; dateTo?: string }): Promise<{ expenses: Expense[]; total: number }> {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', String(params.page))
    if (params?.category) query.set('category', params.category)
    if (params?.agentId) query.set('agentId', params.agentId)
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/portal/expenses${qs ? `?${qs}` : ''}`)
  }

  async createExpense(data: CreateExpenseRequest): Promise<Expense> {
    return this.fetchMutate('/api/v1/portal/expenses', 'POST', data)
  }

  async updateExpense(id: string, data: UpdateExpenseRequest): Promise<Expense> {
    return this.fetchMutate(`/api/v1/portal/expenses/${id}`, 'PUT', data)
  }

  async deleteExpense(id: string): Promise<void> {
    await this.fetchMutate(`/api/v1/portal/expenses/${id}`, 'DELETE')
  }

  // ── Mailbox Invoice Import ───────────────────────────

  async getMailboxes(): Promise<MailboxConnection[]> {
    return this.fetch('/api/v1/portal/mailboxes')
  }

  async createMailbox(data: CreateMailboxConnectionRequest): Promise<MailboxConnection> {
    return this.fetchMutate('/api/v1/portal/mailboxes', 'POST', data)
  }

  async updateMailbox(id: string, data: UpdateMailboxConnectionRequest): Promise<MailboxConnection> {
    return this.fetchMutate(`/api/v1/portal/mailboxes/${id}`, 'PATCH', data)
  }

  async deleteMailbox(id: string): Promise<void> {
    await this.fetchMutate(`/api/v1/portal/mailboxes/${id}`, 'DELETE')
  }

  async testMailbox(idOrData: string | CreateMailboxConnectionRequest): Promise<MailboxTestResult> {
    if (typeof idOrData === 'string') {
      return this.fetchMutate(`/api/v1/portal/mailboxes/${idOrData}/test`, 'POST')
    }
    return this.fetchMutate('/api/v1/portal/mailboxes/test', 'POST', idOrData)
  }

  async syncMailbox(id: string): Promise<MailboxSyncResult> {
    return this.fetchMutate(`/api/v1/portal/mailboxes/${id}/sync`, 'POST')
  }

  async getImportedInvoices(params?: { status?: string; mailboxId?: string }): Promise<{ invoices: ImportedInvoice[]; total: number }> {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    if (params?.mailboxId) query.set('mailboxId', params.mailboxId)
    const qs = query.toString()
    return this.fetch(`/api/v1/portal/imported-invoices${qs ? `?${qs}` : ''}`)
  }

  async updateImportedInvoice(id: string, data: UpdateImportedInvoiceRequest): Promise<ImportedInvoice> {
    return this.fetchMutate(`/api/v1/portal/imported-invoices/${id}`, 'PATCH', data)
  }

  async approveImportedInvoice(id: string, data: ApproveImportedInvoiceRequest): Promise<ImportedInvoice> {
    return this.fetchMutate(`/api/v1/portal/imported-invoices/${id}/approve`, 'POST', data)
  }

  async rejectImportedInvoice(id: string): Promise<ImportedInvoice> {
    return this.fetchMutate(`/api/v1/portal/imported-invoices/${id}/reject`, 'POST')
  }

  // ── Finance ───────────────────────────────────────────

  async getFinanceSummary(params?: { dateFrom?: string; dateTo?: string }): Promise<FinanceSummary> {
    const query = new URLSearchParams()
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/portal/finance/summary${qs ? `?${qs}` : ''}`)
  }

  async getAgentPL(agentId: string): Promise<AgentPL> {
    return this.fetch(`/api/v1/portal/finance/agent/${agentId}`)
  }

  async getLeadROI(params?: { dateFrom?: string; dateTo?: string }): Promise<LeadROI[]> {
    const query = new URLSearchParams()
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/portal/finance/lead-roi${qs ? `?${qs}` : ''}`)
  }

  // ── Drip Campaigns ──────────────────────────────────

  async getDripCampaigns(): Promise<DripCampaign[]> {
    return this.fetch('/api/v1/drip-campaigns')
  }

  async getDripCampaign(id: string): Promise<DripCampaign & { steps: DripStep[] }> {
    return this.fetch(`/api/v1/drip-campaigns/${id}`)
  }

  async createDripCampaign(data: { name: string; channel: string; triggerStage: string }): Promise<DripCampaign> {
    return this.fetchMutate('/api/v1/drip-campaigns', 'POST', data)
  }

  async updateDripCampaign(id: string, data: Partial<DripCampaign>): Promise<DripCampaign> {
    return this.fetchMutate(`/api/v1/drip-campaigns/${id}`, 'PUT', data)
  }

  async deleteDripCampaign(id: string): Promise<void> {
    await this.fetchMutate(`/api/v1/drip-campaigns/${id}`, 'DELETE')
  }

  async createDripStep(campaignId: string, data: { stepOrder: number; delayMinutes: number; messageTemplate: string }): Promise<DripStep> {
    return this.fetchMutate(`/api/v1/drip-campaigns/${campaignId}/steps`, 'POST', data)
  }

  async updateDripStep(campaignId: string, stepId: string, data: Partial<DripStep>): Promise<DripStep> {
    return this.fetchMutate(`/api/v1/drip-campaigns/${campaignId}/steps/${stepId}`, 'PUT', data)
  }

  async deleteDripStep(campaignId: string, stepId: string): Promise<void> {
    await this.fetchMutate(`/api/v1/drip-campaigns/${campaignId}/steps/${stepId}`, 'DELETE')
  }

  async getDripExecutions(campaignId: string): Promise<DripExecution[]> {
    return this.fetch(`/api/v1/drip-campaigns/${campaignId}/executions`)
  }

  // ── AI Lead Import ──────────────────────────────────

  async aiImportParse(text: string): Promise<ParsedLead> {
    const res = await this.fetchMutate<{ parsed: ParsedLead; existing: unknown }>('/api/v1/recruits/ai-import/parse', 'POST', { text })
    return { ...res.parsed, isDuplicate: res.existing != null }
  }

  async aiImportConfirm(data: CreateRecruitRequest): Promise<Recruit> {
    return this.fetchMutate('/api/v1/recruits/ai-import/confirm', 'POST', data)
  }

  // ── Chargebacks ──────────────────────────────────────

  async getChargebacks(params?: { agentId?: string; status?: string; page?: number }): Promise<{ chargebacks: Chargeback[]; total: number }> {
    const query = new URLSearchParams()
    if (params?.agentId) query.set('agentId', params.agentId)
    if (params?.status) query.set('status', params.status)
    if (params?.page) query.set('page', String(params.page))
    const qs = query.toString()
    return this.fetch(`/api/v1/portal/chargebacks${qs ? `?${qs}` : ''}`)
  }

  async getChargeback(id: string): Promise<Chargeback> {
    return this.fetch(`/api/v1/portal/chargebacks/${id}`)
  }

  async createChargeback(data: CreateChargebackRequest): Promise<Chargeback> {
    return this.fetchMutate('/api/v1/portal/chargebacks', 'POST', data)
  }

  async updateChargeback(id: string, data: UpdateChargebackRequest): Promise<Chargeback> {
    return this.fetchMutate(`/api/v1/portal/chargebacks/${id}`, 'PUT', data)
  }

  async deleteChargeback(id: string): Promise<void> {
    await this.fetchMutate(`/api/v1/portal/chargebacks/${id}`, 'DELETE')
  }

  async getChargebackSummary(params?: { agentId?: string; dateFrom?: string; dateTo?: string }): Promise<ChargebackSummary> {
    const query = new URLSearchParams()
    if (params?.agentId) query.set('agentId', params.agentId)
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/portal/chargebacks/summary${qs ? `?${qs}` : ''}`)
  }

  // ── Lead Programs ────────────────────────────────────

  async getLeadPrograms(): Promise<LeadProgram[]> {
    return this.fetch('/api/v1/portal/lead-programs')
  }

  async createLeadProgram(data: CreateLeadProgramRequest): Promise<LeadProgram> {
    return this.fetchMutate('/api/v1/portal/lead-programs', 'POST', data)
  }

  async updateLeadProgram(id: string, data: Partial<CreateLeadProgramRequest>): Promise<LeadProgram> {
    return this.fetchMutate(`/api/v1/portal/lead-programs/${id}`, 'PUT', data)
  }

  async deleteLeadProgram(id: string): Promise<void> {
    await this.fetchMutate(`/api/v1/portal/lead-programs/${id}`, 'DELETE')
  }

  // ── Lead Program Entries ─────────────────────────────

  async getLeadProgramEntries(params?: { programId?: string; agentId?: string; periodFrom?: string; periodTo?: string }): Promise<{ entries: LeadProgramEntry[]; total: number }> {
    const query = new URLSearchParams()
    if (params?.programId) query.set('programId', params.programId)
    if (params?.agentId) query.set('agentId', params.agentId)
    if (params?.periodFrom) query.set('periodFrom', params.periodFrom)
    if (params?.periodTo) query.set('periodTo', params.periodTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/portal/lead-program-entries${qs ? `?${qs}` : ''}`)
  }

  async createLeadProgramEntry(data: CreateLeadProgramEntryRequest): Promise<LeadProgramEntry> {
    return this.fetchMutate('/api/v1/portal/lead-program-entries', 'POST', data)
  }

  async updateLeadProgramEntry(id: string, data: Partial<CreateLeadProgramEntryRequest>): Promise<LeadProgramEntry> {
    return this.fetchMutate(`/api/v1/portal/lead-program-entries/${id}`, 'PUT', data)
  }

  async deleteLeadProgramEntry(id: string): Promise<void> {
    await this.fetchMutate(`/api/v1/portal/lead-program-entries/${id}`, 'DELETE')
  }

  // ── Lead Program Profitability ───────────────────────

  async getLeadProgramProfitability(params?: { agentId?: string; dateFrom?: string; dateTo?: string }): Promise<LeadProgramProfitability[]> {
    const query = new URLSearchParams()
    if (params?.agentId) query.set('agentId', params.agentId)
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/portal/lead-programs/profitability${qs ? `?${qs}` : ''}`)
  }

  // ── Enhanced Sales Analytics ─────────────────────────

  async getSalesPipeline(params?: { agentId?: string; dateFrom?: string; dateTo?: string }): Promise<PipelineSummary> {
    const query = new URLSearchParams()
    if (params?.agentId) query.set('agentId', params.agentId)
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/portal/sales/pipeline${qs ? `?${qs}` : ''}`)
  }

  async getSalesAnalytics(params?: { agentId?: string; dateFrom?: string; dateTo?: string }): Promise<SalesAnalytics> {
    const query = new URLSearchParams()
    if (params?.agentId) query.set('agentId', params.agentId)
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/portal/sales/analytics${qs ? `?${qs}` : ''}`)
  }

  async getAgentProfitability(params?: { dateFrom?: string; dateTo?: string }): Promise<AgentProfitabilityRow[]> {
    const query = new URLSearchParams()
    if (params?.dateFrom) query.set('dateFrom', params.dateFrom)
    if (params?.dateTo) query.set('dateTo', params.dateTo)
    const qs = query.toString()
    return this.fetch(`/api/v1/portal/finance/agent-profitability${qs ? `?${qs}` : ''}`)
  }

  // ── Agent Analytics Stubs ───────────────────────────────────────────────

  async getAgentWavvMetrics(discordId: string): Promise<AgentWavvData> {
    try {
      return await this.fetch<AgentWavvData>(`/api/v1/agents/${discordId}/wavv-metrics`)
    } catch {
      // TODO: Backend endpoint needed — return empty metrics
      return {
        today: { dials: 0, connections: 0, talkMinutes: 0 },
        thisWeek: { dials: 0, connections: 0, talkMinutes: 0 },
        daily: [],
      }
    }
  }

  async getAgentAppointments(discordId: string): Promise<AgentAppointmentData> {
    try {
      return await this.fetch<AgentAppointmentData>(`/api/v1/agents/${discordId}/appointments/stats`)
    } catch {
      // TODO: Backend endpoint needed — return empty metrics
      return {
        thisWeek: { booked: 0, run: 0, showRate: 0 },
        avgPerWeek: 0,
        weekly: [],
      }
    }
  }

  async getAgentActivity(discordId: string): Promise<AgentActivityData> {
    try {
      return await this.fetch<AgentActivityData>(`/api/v1/agents/${discordId}/activity-stats`)
    } catch {
      // TODO: Backend endpoint needed — return empty metrics
      return {
        today: { hoursActive: 0 },
        thisWeek: { hoursActive: 0, avgDaily: 0 },
        daily: [],
      }
    }
  }

  async getAgentRecruitsData(discordId: string): Promise<AgentRecruitsData> {
    try {
      const res = await this.getRecruits({ search: discordId })
      const recruits = res.recruits ?? []
      const total = recruits.length
      const active = recruits.filter((r) => r.stage === 'ACTIVE').length
      const conversionRate = total > 0 ? Math.round((active / total) * 100) : 0

      const stageCounts: Record<string, number> = {}
      for (const r of recruits) {
        stageCounts[r.stage] = (stageCounts[r.stage] ?? 0) + 1
      }
      const byStage = Object.entries(stageCounts).map(([stage, count]) => ({
        stage,
        count,
        color: (RECRUIT_STAGE_COLORS as Record<string, string>)[stage] ?? '#6b7280',
      }))

      return { total, active, conversionRate, byStage, recruits }
    } catch {
      return { total: 0, active: 0, conversionRate: 0, byStage: [], recruits: [] }
    }
  }

  // ── CRM M1: Contacts ────────────────────────────────

  /**
   * List contacts — accepts either a FilterNode or a smartListId. One or neither,
   * never both. FilterNode is URL-safe-base64-encoded per backend spec.
   */
  async crmListContacts(opts: {
    filter?: SmartListFilter | null
    smartListId?: string
    cursor?: string
    limit?: number
    sort?: { field: string; dir: 'asc' | 'desc' }[]
  } = {}): Promise<ContactsPage> {
    const q = new URLSearchParams()
    if (opts.smartListId) {
      q.set('smartList', opts.smartListId)
    } else if (opts.filter) {
      q.set('filter', encodeFilterBase64(opts.filter))
    }
    if (opts.cursor) q.set('cursor', opts.cursor)
    if (opts.limit) q.set('limit', String(opts.limit))
    if (opts.sort?.length) {
      q.set('sort', opts.sort.map((s) => `${s.field}:${s.dir}`).join(','))
    }
    const qs = q.toString()
    return this.fetch(`/api/v1/crm/contacts${qs ? `?${qs}` : ''}`)
  }

  async crmGetContact(id: string): Promise<Contact> {
    return this.fetch(`/api/v1/crm/contacts/${encodeURIComponent(id)}`)
  }

  async crmCreateContact(body: CreateContactRequest): Promise<Contact> {
    return this.fetchMutate('/api/v1/crm/contacts', 'POST', body)
  }

  async crmUpdateContact(id: string, patch: UpdateContactRequest): Promise<Contact> {
    return this.fetchMutate(`/api/v1/crm/contacts/${encodeURIComponent(id)}`, 'PATCH', patch)
  }

  async crmArchiveContact(id: string): Promise<void> {
    return this.fetchMutate(`/api/v1/crm/contacts/${encodeURIComponent(id)}/archive`, 'POST')
  }

  async crmRestoreContact(id: string): Promise<void> {
    return this.fetchMutate(`/api/v1/crm/contacts/${encodeURIComponent(id)}/restore`, 'POST')
  }

  async crmAddContactTag(id: string, tag: string): Promise<void> {
    return this.fetchMutate(`/api/v1/crm/contacts/${encodeURIComponent(id)}/tags`, 'POST', { tag })
  }

  async crmRemoveContactTag(id: string, tag: string): Promise<void> {
    return this.fetchMutate(
      `/api/v1/crm/contacts/${encodeURIComponent(id)}/tags/${encodeURIComponent(tag)}`,
      'DELETE',
    )
  }

  /**
   * Bulk mutation. Backend takes {filter, action, payload} and scope-enforces
   * the match set server-side. NOTE: spec §1.6 describes an ids-based shape;
   * this client submits the filter-based shape the backend actually implements.
   */
  async crmBulkContacts(body: {
    filter: SmartListFilter
    action: BulkByFilterRequest['action']
    payload?: Record<string, unknown>
  }): Promise<{ affected: number }> {
    return this.fetchMutate('/api/v1/crm/contacts/bulk', 'POST', body)
  }

  async crmListContactTags(): Promise<ContactTagStat[]> {
    return this.fetch('/api/v1/crm/contacts/tags')
  }

  // ── CRM M1: Smart Lists ─────────────────────────────

  async crmListSmartLists(): Promise<{ smartlists: SmartList[]; total: number }> {
    return this.fetch('/api/v1/crm/smartlists')
  }

  async crmGetSmartList(id: string): Promise<SmartList> {
    return this.fetch(`/api/v1/crm/smartlists/${encodeURIComponent(id)}`)
  }

  async crmCreateSmartList(body: {
    name: string
    description?: string | null
    sharedWithAgentIds?: string[]
    filter: SmartListFilter
    isPinned?: boolean
  }): Promise<SmartList> {
    return this.fetchMutate('/api/v1/crm/smartlists', 'POST', body)
  }

  async crmUpdateSmartList(
    id: string,
    patch: Partial<{
      name: string
      description: string | null
      sharedWithAgentIds: string[]
      isPinned: boolean
      filter: SmartListFilter
    }>,
  ): Promise<SmartList> {
    return this.fetchMutate(`/api/v1/crm/smartlists/${encodeURIComponent(id)}`, 'PATCH', patch)
  }

  async crmDeleteSmartList(id: string): Promise<void> {
    return this.fetchMutate(`/api/v1/crm/smartlists/${encodeURIComponent(id)}`, 'DELETE')
  }

  async crmPinSmartList(id: string, pinned: boolean): Promise<void> {
    return this.fetchMutate(`/api/v1/crm/smartlists/${encodeURIComponent(id)}/pin`, 'POST', { pinned })
  }

  async crmExecuteSmartList(id: string): Promise<ContactsPage> {
    return this.fetchMutate(`/api/v1/crm/smartlists/${encodeURIComponent(id)}/execute`, 'POST')
  }

  // ── CRM M2A: Conversations + Messages ──────────────────

  async crmListConversations(req: ConversationListRequest = {}): Promise<ConversationListResponse> {
    const q = new URLSearchParams()
    if (req.channel) q.set('channel', req.channel)
    if (req.status) q.set('status', req.status)
    if (req.assignedAgentId) q.set('assigned_agent_id', req.assignedAgentId)
    if (req.cursor) q.set('cursor', req.cursor)
    if (req.limit) q.set('limit', String(req.limit))
    const qs = q.toString()
    return this.fetch(`/api/v1/crm/conversations${qs ? `?${qs}` : ''}`)
  }

  async crmGetConversation(id: string): Promise<ConversationDetailResponse> {
    return this.fetch(`/api/v1/crm/conversations/${encodeURIComponent(id)}`)
  }

  async crmListConversationMessages(
    conversationId: string,
    opts: { cursor?: string; limit?: number } = {},
  ): Promise<MessageListResponse> {
    const q = new URLSearchParams()
    if (opts.cursor) q.set('cursor', opts.cursor)
    if (opts.limit) q.set('limit', String(opts.limit))
    const qs = q.toString()
    return this.fetch(
      `/api/v1/crm/conversations/${encodeURIComponent(conversationId)}/messages${qs ? `?${qs}` : ''}`,
    )
  }

  /** Send a message. Backend de-dupes by (conversationId, idempotencyKey)
   *  so retries are safe; the hook mints a fresh UUID per fresh attempt. */
  async crmSendMessage(conversationId: string, body: SendMessageRequest): Promise<Message> {
    return this.fetchMutate(
      `/api/v1/crm/conversations/${encodeURIComponent(conversationId)}/messages`,
      'POST',
      body,
    )
  }

  async crmSnoozeConversation(id: string, snoozeUntil: string): Promise<void> {
    return this.fetchMutate(
      `/api/v1/crm/conversations/${encodeURIComponent(id)}/snooze`,
      'POST',
      { snoozeUntil },
    )
  }

  async crmCloseConversation(id: string): Promise<void> {
    return this.fetchMutate(`/api/v1/crm/conversations/${encodeURIComponent(id)}/close`, 'POST')
  }

  async crmReadConversation(id: string): Promise<void> {
    return this.fetchMutate(`/api/v1/crm/conversations/${encodeURIComponent(id)}/read`, 'POST')
  }

  async crmAssignConversation(id: string, agentId: string): Promise<void> {
    return this.fetchMutate(
      `/api/v1/crm/conversations/${encodeURIComponent(id)}/assign`,
      'POST',
      { agentId },
    )
  }

  async crmContactConversations(contactId: string): Promise<{ conversations: Conversation[] }> {
    return this.fetch(`/api/v1/crm/contacts/${encodeURIComponent(contactId)}/conversations`)
  }

  // ── CRM M2A: Templates ──────────────────────────────────

  async crmListTemplates(opts: { channel?: string; status?: string } = {}): Promise<{ templates: MessageTemplate[] }> {
    const q = new URLSearchParams()
    if (opts.channel) q.set('channel', opts.channel)
    if (opts.status) q.set('status', opts.status)
    const qs = q.toString()
    return this.fetch(`/api/v1/crm/templates${qs ? `?${qs}` : ''}`)
  }

  async crmCreateTemplate(body: CreateMessageTemplateRequest): Promise<MessageTemplate> {
    return this.fetchMutate('/api/v1/crm/templates', 'POST', body)
  }

  async crmUpdateTemplate(id: string, patch: UpdateMessageTemplateRequest): Promise<MessageTemplate> {
    return this.fetchMutate(`/api/v1/crm/templates/${encodeURIComponent(id)}`, 'PATCH', patch)
  }

  async crmDeleteTemplate(id: string): Promise<void> {
    return this.fetchMutate(`/api/v1/crm/templates/${encodeURIComponent(id)}`, 'DELETE')
  }

  // ── CRM M1: Bulk report (future: streaming errors) ──

  async crmBulkContactsDetailed(body: {
    filter: SmartListFilter
    action: BulkByFilterRequest['action']
    payload?: Record<string, unknown>
  }): Promise<BulkActionReport> {
    return this.fetchMutate('/api/v1/crm/contacts/bulk', 'POST', body)
  }

  // ── CRM M1: Admin — Contact backfill ────────────────

  /** Admin-only. Triggers the M0 `UpsertContactFromSource` sweep. `dryRun` may be
   *  honored server-side; default false = actually writes. Returns whatever the
   *  backend chooses to emit (counts, etc.) — kept loose until the contract
   *  stabilizes. */
  async crmRunBackfill(body: { dryRun?: boolean } = {}): Promise<Record<string, unknown>> {
    return this.fetchMutate('/api/v1/crm/admin/backfill', 'POST', body)
  }

  /** CSV export of the currently-filtered contacts. Returns a Blob so the caller
   *  can trigger a download via an anchor element. Respects the same auth +
   *  scope rules as the list endpoint. */
  async crmExportContactsCsv(filter: SmartListFilter | null): Promise<Blob> {
    const qs = filter ? `?filter=${encodeURIComponent(encodeFilterBase64(filter))}` : ''
    const url = `${this.getBaseUrl()}/api/v1/crm/contacts/export.csv${qs}`
    const headers = await this.getHeaders()
    let res = await this.retryOn429(() => fetch(url, { headers }))
    if (res.status === 401) {
      const newToken = await this.handleUnauthorized()
      if (newToken) {
        res = await this.retryOn429(() =>
          fetch(url, { headers: { Authorization: `Bearer ${newToken}` } }),
        )
      } else {
        this.clearAuthAndRedirect()
        throw new Error('Session expired — please log in again.')
      }
    }
    if (!res.ok) {
      const text = await res.text().catch(() => 'Unknown error')
      throw new ApiError(res.status, `CSV export ${res.status}: ${text}`)
    }
    return res.blob()
  }
}

// URL-safe base64 of the filter JSON. Backend accepts StdEncoding, URLEncoding,
// and the Raw variants — we pick URLEncoding so the string is safe in query
// params (no `+` / `/` that need additional escaping).
function encodeFilterBase64(filter: SmartListFilter): string {
  const json = JSON.stringify(filter)
  // btoa handles ASCII only; wrap with TextEncoder for full UTF-8 safety.
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_')
}

export const api = new ApiClient()
