// Types for admin portal features (profile, leads, training, schedule, org chart, comp tiers)

import type { AIAction } from './ai-actions'

export interface VerificationState {
  npn_verified: boolean
  npn: string | null
  canonical_name: string | null
  verified_at: string | null
}

export interface AgentProfile {
  id: string
  agentId: string
  bio: string | null
  city: string | null
  timezone: string | null
  linkedinUrl: string | null
  photoUrl: string | null
  startDate: string | null
  compTierId: string | null
  managerId: string | null
  createdAt: string
  updatedAt: string
  compTier?: CompTier | null
  manager?: { id: string; firstName: string; lastName: string } | null
}

export interface CompTier {
  id: string
  name: string
  percentage: number
  order: number
  createdAt: string
  updatedAt: string
}

export interface CompTierWithAgents extends CompTier {
  profiles: {
    agentId: string
    agent: { firstName: string; lastName: string }
  }[]
}

export interface AgentLead {
  id: string
  agentId: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  source: string | null
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
  /** CRM M1: populated on create/update by UpsertContactFromSource. */
  contactId?: string | null
}

export interface CreateAgentLeadRequest {
  firstName: string
  lastName: string
  email?: string
  phone?: string
  source?: string
  notes?: string
}

export interface UpdateAgentLeadRequest {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  source?: string
  status?: string
  notes?: string
}

export interface AgentTrainingItem {
  id: string
  agentId: string
  title: string
  description: string | null
  status: string
  dueDate: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTrainingItemRequest {
  title: string
  description?: string
  dueDate?: string
}

export interface UpdateTrainingItemRequest {
  title?: string
  description?: string
  status?: string
  dueDate?: string
}

export interface AgentScheduleEvent {
  id: string
  agentId: string
  title: string
  description: string | null
  startTime: string
  endTime: string
  type: string
  createdAt: string
  updatedAt: string
}

export interface CreateScheduleEventRequest {
  title: string
  description?: string
  startTime: string
  endTime: string
  type?: string
}

export interface UpdateScheduleEventRequest {
  title?: string
  description?: string
  startTime?: string
  endTime?: string
  type?: string
}

export interface OrgChartNode {
  id: string
  firstName: string
  lastName: string
  email?: string
  discordUsername?: string | null
  profile?: {
    managerId: string | null
    compTier?: CompTier | null
    photoUrl?: string | null
    positionX?: number | null
    positionY?: number | null
  } | null
  role?: string | null
  stage?: {
    name: string
    color: string
  } | null
}

export const LEAD_STATUSES = ['new', 'contacted', 'interested', 'converted', 'lost'] as const
export const TRAINING_STATUSES = ['pending', 'in_progress', 'completed'] as const
export const EVENT_TYPES = ['meeting', 'training', 'call', 'other'] as const

export interface DiscordMemberLookup {
  exists: boolean
  discordId: string
  username?: string
  displayName?: string
  avatarUrl?: string
  roles?: string[]
  joinedAt?: string
}

export interface CreateAgentRequest {
  discordId?: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  state?: string
  agency?: string
  npn?: string
  licenseNumber?: string
}

export interface AgentOnboardingInviteRequest {
  agentId?: string
  firstName: string
  lastName: string
  email?: string
  phone?: string
  channels: Array<'email' | 'sms'>
}

export interface AgentOnboardingInviteResponse {
  emailSent?: boolean
  smsSent?: boolean
  inviteUrl?: string
}

export interface VerifyAgentResponse {
  verified: boolean
  npn?: string
  licenseNumber?: string
  licenseType?: string
  status?: string
  expirationDate?: string
  loas?: string
  error?: string
}

export interface BulkImportResponse {
  imported: number
  skipped: number
  bots: number
  total: number
}

export interface BulkRecruitImportResponse {
  created: number
  skipped: number
  queued: number
}

// ── Sales Tracking ──────────────────────────────────

export interface Sale {
  id: string
  agentId: string
  clientName: string
  policyType: string
  carrier: string
  premium: number
  commission: number | null
  status: string
  submittedAt: string
  approvedAt: string | null
  issuedAt: string | null
  paidAt: string | null
  policyNumber: string | null
  notes: string | null
  clientDOB: string | null
  clientAddress: string | null
  clientPhone: string | null
  clientEmail: string | null
  faceAmount: number | null
  paymentMode: string | null
  transcript: string | null
  productName: string | null
  insuredName?: string | null
  postcardSentAt?: string | null
  createdAt: string
  updatedAt: string
  agentFirstName?: string
  agentLastName?: string
  agent?: { firstName: string; lastName: string }
  /** CRM M1: populated on create/update by UpsertContactFromSource. */
  contactId?: string | null
}

export interface SaleStats {
  totalSales: number
  totalPremium: number
  totalCommission: number
  byStatus: Record<string, number>
  byPolicyType: Record<string, number>
  thisMonth: { count: number; premium: number }
  lastMonth: { count: number; premium: number }
}

export interface SalesAgentDirectoryEntry {
  agentId: string
  displayName: string
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  avatarUrl?: string | null
  isCurrentUser?: boolean
  isActive?: boolean
}

export interface CreateSaleRequest {
  agentId?: string
  clientName: string
  policyType: string
  carrier: string
  premium: number
  commission?: number
  status?: string
  policyNumber?: string
  notes?: string
  clientDOB?: string
  clientAddress?: string
  clientPhone?: string
  clientEmail?: string
  faceAmount?: number
  paymentMode?: string
  transcript?: string
  productName?: string
}

export interface UpdateSaleRequest {
  clientName?: string
  policyType?: string
  carrier?: string
  premium?: number
  commission?: number
  status?: string
  policyNumber?: string
  notes?: string
  clientDOB?: string
  clientAddress?: string
  clientPhone?: string
  clientEmail?: string
  faceAmount?: number
  paymentMode?: string
  productName?: string
}

// ── Postable Integration ──────────────────────────────

export interface PostableSettings {
  id: string
  orgId: string
  enabled: boolean
  email: string
  hasPassword: boolean
  defaultCardId: string
  defaultCardImage: string
  messageTemplate: string
  triggerStatuses: string[]
  createdAt: string
  updatedAt: string
}

export interface UpdatePostableSettingsRequest {
  enabled?: boolean
  email?: string
  password?: string
  defaultCardId?: string
  defaultCardImage?: string
  messageTemplate?: string
  triggerStatuses?: string[]
}

export interface PostableCard {
  id: number
  name: string
  slug: string
  image_url: string
  price: string
}

export const POLICY_TYPES = ['life', 'health', 'auto', 'home', 'medicare', 'final_expense', 'annuity'] as const

export const FFL_CARRIERS = [
  'Aetna',
  'Aflac',
  'American Amicable',
  'American Equity',
  'American General (AIG)',
  'Americo',
  'Assurity',
  'Athene',
  'Cigna',
  'Columbian Financial',
  'CUNA Mutual',
  'CVS Aetna',
  'Family Heritage (Torchmark)',
  'Fidelity & Guaranty (F&G)',
  'Foresters Financial',
  'Gerber Life',
  'Globe Life',
  'Great Western',
  'GTL (Guarantee Trust Life)',
  'Kansas City Life',
  'Kemper',
  'Liberty Bankers Life',
  'Lincoln Financial',
  'Manhattan Life',
  'Mutual of Omaha',
  'National Life Group',
  'National Western',
  'Nationwide',
  'North American (Sammons)',
  'Oxford Life',
  'Pacific Life',
  'Philadelphia American Life',
  'Prosperity Life',
  'Protective Life',
  'Royal Neighbors of America',
  'SBLI',
  'Security Benefit',
  'Sentinel Security Life',
  'Transamerica',
  'United Home Life',
  'United of Omaha',
  'Other',
] as const
export const SALE_STATUSES = ['submitted', 'approved', 'issued', 'paid', 'cancelled'] as const

export const SALE_STATUS_COLORS: Record<string, string> = {
  submitted: '#f39c12',
  approved: '#3498db',
  issued: '#9b59b6',
  paid: '#27ae60',
  cancelled: '#e74c3c',
}

// ── Agent Roles (Org Chart Hierarchy) ─────────────────

export const AGENT_ROLES = [
  'OWNER',
  'AGENCY_MANAGER',
  'TEAM_LEAD',
  'SENIOR_AGENT',
  'AGENT',
  'TRAINEE',
] as const

export type AgentRole = (typeof AGENT_ROLES)[number]

export const AGENT_ROLE_LABELS: Record<AgentRole, string> = {
  OWNER: 'Owner',
  AGENCY_MANAGER: 'Agency Manager',
  TEAM_LEAD: 'Team Lead',
  SENIOR_AGENT: 'Senior Agent',
  AGENT: 'Agent',
  TRAINEE: 'Trainee',
}

export const AGENT_ROLE_COLORS: Record<AgentRole, string> = {
  OWNER: '#7DD3FC',
  AGENCY_MANAGER: '#8b5cf6',
  TEAM_LEAD: '#06b6d4',
  SENIOR_AGENT: '#3b82f6',
  AGENT: '#6b7280',
  TRAINEE: '#f59e0b',
}

// ── Recruit Pipeline ──────────────────────────────────

export const RECRUIT_STAGES = [
  'NEW_LEAD',
  'PREQUALIFIED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWED',
  'ONBOARDING',
  'IN_COURSE',
  'LICENSED',
  'CONTRACTING',
  'ACTIVE',
  'REJECTED',
] as const

export type RecruitStage = (typeof RECRUIT_STAGES)[number]

export const RECRUIT_STAGE_COLORS: Record<RecruitStage, string> = {
  NEW_LEAD: '#3b82f6',
  PREQUALIFIED: '#06b6d4',
  INTERVIEW_SCHEDULED: '#8b5cf6',
  INTERVIEWED: '#a855f7',
  ONBOARDING: '#f59e0b',
  IN_COURSE: '#f97316',
  LICENSED: '#10b981',
  CONTRACTING: '#14b8a6',
  ACTIVE: '#22c55e',
  REJECTED: '#ef4444',
}

export const RECRUIT_STAGE_LABELS: Record<RecruitStage, string> = {
  NEW_LEAD: 'New Lead',
  PREQUALIFIED: 'Prequalified',
  INTERVIEW_SCHEDULED: 'Interview Scheduled',
  INTERVIEWED: 'Interviewed',
  ONBOARDING: 'Onboarding',
  IN_COURSE: 'In Course',
  LICENSED: 'Licensed',
  CONTRACTING: 'Contracting',
  ACTIVE: 'Active',
  REJECTED: 'Rejected',
}

export interface OnboardingChecklist {
  discordInviteSent: boolean
  discordJoined: boolean
  jessicaMeetingScheduled: boolean
  jessicaMeetingCompleted: boolean
  courseEnrolled: boolean
  courseCompleted: boolean
  examPassed: boolean
  licenseObtained: boolean
  contractingSubmitted: boolean
  contractingApproved: boolean
}

export interface Recruit {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  city: string | null
  source: string | null
  reason: string | null
  agentType: string | null
  stage: RecruitStage
  approvalStatus: string | null
  rejectedReason: string | null
  interviewType: string | null
  interviewDate: string | null
  interviewLink: string | null
  interviewNotes: string | null
  calendlyEventUri: string | null
  assignedManagerId: string | null
  optedOut: boolean
  assignedManager?: { id: string; firstName: string; lastName: string } | null
  agent?: { id: string; firstName: string; lastName: string } | null
  smsMessages?: { id: string; body: string; direction: string; createdAt: string }[]
  createdAt: string
  updatedAt: string

  // Extended pipeline fields
  leadSource: 'facebook_ads' | 'in_person' | 'referral' | 'website_form' | 'other' | null
  isLicensed: boolean
  licenseState: string | null
  licenseNumber: string | null
  licenseExpiryDate: string | null
  courseEnrolledDate: string | null
  courseName: string | null
  courseProgress: number | null
  contractingStatus: string | null
  contractingCarrier: string | null
  contractingSubmittedDate: string | null
  discordJoinedDate: string | null
  onboardingChecklist: OnboardingChecklist | null
  /** CRM M1: populated on create/update by UpsertContactFromSource. */
  contactId?: string | null
}

export interface RecruitsResponse {
  recruits: Recruit[]
  total: number
  page: number
  perPage: number
  pageCount: number
}

export interface CreateRecruitRequest {
  firstName: string
  lastName: string
  email: string
  phone?: string
  city?: string
  source?: string
  leadSource?: 'facebook_ads' | 'in_person' | 'referral' | 'website_form' | 'other'
  reason?: string
  priorExperience?: string
  isCurrentlyLicensed?: boolean
  assignedManagerId?: string
}

export interface UpdateRecruitRequest {
  stage?: RecruitStage
  rejectedReason?: string
  interviewType?: string
  interviewDate?: string
  interviewLink?: string
  interviewNotes?: string
  calendlyEventUri?: string
  assignedManagerId?: string
  approvalStatus?: string
  declineReason?: string
  declinedById?: string
  leadSource?: 'facebook_ads' | 'in_person' | 'referral' | 'website_form' | 'other'
  isLicensed?: boolean
  licenseState?: string
  licenseNumber?: string
  licenseExpiryDate?: string
  courseEnrolledDate?: string
  courseName?: string
  courseProgress?: number
  contractingStatus?: string
  contractingCarrier?: string
  contractingSubmittedDate?: string
  discordJoinedDate?: string
  onboardingChecklist?: Partial<OnboardingChecklist>
}

export interface RecruitStats {
  byStage: Record<string, number>
  total: number
  thisWeek: number
  conversionRate: number
  avgDaysInPipeline: number
  avgDaysToActive: number
  inLicensingCount: number
  thirtyDayAlerts: number
}

export interface RecruitFunnelData {
  stages: { stage: RecruitStage; count: number; avgDays: number }[]
  conversions: { from: RecruitStage; to: RecruitStage; rate: number }[]
  bySource: { source: string; stages: Record<string, number> }[]
  thirtyDayAlerts: { recruitId: string; name: string; daysRemaining: number }[]
}

// ── Analytics ──────────────────────────────────────────

export interface ConversionDataPoint {
  name: string
  slug: string
  color: string
  count: number
  percentage: number
}

export interface SourceDataPoint {
  source: string
  count: number
}

export interface TrendDataPoint {
  week: string
  count: number
}

export interface StageDurationDataPoint {
  name: string
  slug: string
  color: string
  avgDays: number
  agentCount: number
}

// ── Licenses ──────────────────────────────────────────

export const LICENSE_STATUSES = ['active', 'pending', 'expired', 'revoked'] as const
export type LicenseStatus = (typeof LICENSE_STATUSES)[number]

export const LICENSE_STATUS_COLORS: Record<LicenseStatus, string> = {
  active: '#22c55e',
  pending: '#f59e0b',
  expired: '#ef4444',
  revoked: '#6b7280',
}

export const LICENSE_STATUS_LABELS: Record<LicenseStatus, string> = {
  active: 'Active',
  pending: 'Pending',
  expired: 'Expired',
  revoked: 'Revoked',
}

export type LicenseSource = 'manual' | 'scraper' | 'backfill'

export interface License {
  id: string
  agentId: string
  state: string
  licenseNumber: string
  npn: string | null
  licenseType?: string | null
  status: string
  isResident?: boolean
  issueDate?: string | null
  expirationDate: string | null
  ceRequired?: number | null
  ceCompleted?: number | null
  ceDueDate?: string | null
  notes?: string | null
  lastVerifiedAt?: string | null
  source?: LicenseSource
  linesOfAuthority: string[] | null
  verifiedBy: string | null
  createdAt: string
  updatedAt: string
  agent?: { id: string; firstName: string; lastName: string }
}

export interface CreateLicenseRequest {
  agentId: string
  state: string
  licenseNumber: string
  npn?: string
  licenseType?: string
  isResident?: boolean
  issueDate?: string
  expirationDate?: string
  ceRequired?: number
  ceDueDate?: string
  notes?: string
  linesOfAuthority?: string[]
}

export interface UpdateLicenseRequest {
  status?: string
  npn?: string
  licenseType?: string
  isResident?: boolean
  issueDate?: string
  expirationDate?: string
  ceRequired?: number
  ceCompleted?: number
  ceDueDate?: string
  notes?: string
  linesOfAuthority?: string[]
  verifiedBy?: string
}

export interface LicenseAppointment {
  id: string
  licenseId: string
  carrier: string
  writingNumber?: string | null
  appointedOn?: string | null
  terminatedOn?: string | null
  createdAt: string
}

export interface CreateLicenseAppointmentRequest {
  carrier: string
  writingNumber?: string
  appointedOn?: string
  terminatedOn?: string
}

export interface LicenseDocument {
  id: string
  licenseId: string
  kind: string
  filename: string
  uploadedAt: string
}

export interface LicenseStats {
  total: number
  active: number
  pending: number
  expired: number
  revoked: number
  expiringSoon30: number
  expiringSoon60: number
  ceOverdue: number
}

// ── Notifications ──────────────────────────────────────

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  data: Record<string, unknown> | null
  createdAt: string
}

export interface NotificationsResponse {
  notifications: Notification[]
  total: number
  page: number
  perPage: number
  pageCount: number
}

// ── Activity Log ──────────────────────────────────────

export interface ActivityLogEntry {
  id: string
  action: string
  description: string
  guildId: string | null
  agentId: string | null
  userId: string | null
  metadata: Record<string, unknown> | null
  agent?: { firstName: string; lastName: string } | null
  user?: { name: string } | null
  createdAt: string
}

// ── Appointments ──────────────────────────────────────

export interface Appointment {
  id: string
  title: string
  description: string | null
  startTime: string
  endTime: string
  status: string
  agentId: string
  meetingLink: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  agent?: { id: string; firstName: string; lastName: string }
}

export interface AppointmentsResponse {
  appointments: Appointment[]
  total: number
  page: number
  perPage: number
  pageCount: number
}

export interface CreateAppointmentRequest {
  title: string
  description?: string
  startTime: string
  endTime: string
  agentId: string
  meetingLink?: string
  notes?: string
}

// ── Cal.com v2 ──────────────────────────────────────

export interface CalcomStatus {
  connected: boolean
  username?: string
  bookingUrl?: string
  timeZone?: string
}

export interface CalcomEventType {
  id: number
  title: string
  slug: string
  description: string | null
  length: number // duration in minutes
  locations: { type: string; link?: string }[]
}

export interface CalcomBooking {
  id: number
  uid: string
  title: string
  description: string | null
  start: string  // ISO datetime
  end: string    // ISO datetime
  status: 'accepted' | 'pending' | 'cancelled' | 'rejected' | 'rescheduled'
  location: string | null
  attendees: { name: string; email: string; timeZone: string }[]
  eventType: { id: number; title: string; slug: string } | null
}

export interface CalcomEventTypesResponse {
  status: string
  data: CalcomEventType[]
}

export interface CalcomBookingsResponse {
  status: string
  data: CalcomBooking[]
}

// ── SMS ──────────────────────────────────────────────

export interface SmsMessage {
  id: string
  agentId: string | null
  recruitId: string | null
  toNumber: string
  fromNumber: string | null
  body: string
  direction: string
  status: string | null
  createdAt: string
}

export interface SmsHistoryResponse {
  messages: SmsMessage[]
  total: number
  page: number
  perPage: number
  pageCount: number
}

// ── WhatsApp ──────────────────────────────────────────

export interface WhatsAppMessage {
  id: string
  conversationId: string
  sender: string
  body: string
  mediaUrl: string | null
  mediaType: string | null
  isFromContact: boolean
  sentAt: string
  contactPhone?: string
  direction?: string
  type?: string
  status?: string | null
  createdAt?: string
}

export interface WhatsAppConversation {
  id: string
  contactPhone: string
  contactName: string | null
  lastMessageAt: string | null
  unreadCount: number
  lastMessage?: string
  lastAt?: string
  messageCount?: number
  recruitId?: string | null
}

// ── Drip Campaigns ──────────────────────────────────

export interface DripCampaign {
  id: string
  name: string
  channel: 'whatsapp' | 'sms'
  triggerStage: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface DripStep {
  id: string
  campaignId: string
  stepOrder: number
  delayMinutes: number
  messageTemplate: string
  createdAt: string
}

export interface DripExecution {
  id: string
  campaignId: string
  recruitId: string
  currentStep: number
  status: 'active' | 'completed' | 'cancelled' | 'opted_out'
  nextSendAt: string | null
  startedAt: string
  completedAt: string | null
}

export interface ParsedLead {
  firstName: string
  lastName: string
  phone: string
  email: string
  city: string
  state: string
  source: string
  notes: string
  isDuplicate?: boolean
  existingRecruitId?: string
}

// ── Dashboard Enhanced ──────────────────────────────────

export interface DashboardStats {
  totalAgents: number
  newThisWeek: number
  activeAgents: number
  conversionRate: number
}

export interface RevenueChartPoint {
  month: string
  revenue: number
}

export interface LeaderboardEntry {
  agentId: string
  name: string
  totalCommission: number
  totalPremium: number
  policyCount: number
}

export interface PipelineValueEntry {
  stage: string
  count: number
}

export interface DashboardActivity {
  id: string
  action: string
  description: string
  createdAt: string
  agent?: { firstName: string; lastName: string } | null
  user?: { name: string } | null
}

// ── Servers ──────────────────────────────────────────

export interface Server {
  id: string
  discordGuildId: string
  guildName: string
  ownerDiscordId: string | null
  iconUrl: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Bug Reports
export interface BugReport {
  id: string
  userId: string
  description: string
  severity: string
  pageUrl: string
  userAgent: string
  status: string
  createdAt: string
}

export interface CreateBugReportRequest {
  description: string
  severity: string
  pageUrl?: string
  userAgent?: string
}

// ── Pending Joins (Manager Approval Gate) ─────────────────────────
export interface PendingJoin {
  id: string
  discordId: string
  guildId: string
  username: string
  avatarUrl?: string
  joinedAt: string
  status: 'pending' | 'approved' | 'rejected'
  reviewedBy?: string
  reviewedAt?: string
}

export interface PendingJoinsResponse {
  pendingJoins: PendingJoin[]
  totalPending: number
}

// ── Calendar Integrations ─────────────────────────────────────────
export interface IntegrationStatus {
  connected: boolean
  provider: string
  accountCount?: number
}

export interface GoogleCalendarEvent {
  id: string
  googleEventId: string
  summary: string
  description: string | null
  location: string | null
  startTime: string
  endTime: string
  status: string
  attendees: GoogleEventAttendee[]
  meetingLink: string | null
  recurringEventId: string | null
  colorId: string | null
  htmlLink: string
  accountId?: string
  accountEmail?: string
  accountColor?: string
}

export interface GoogleEventAttendee {
  email: string
  displayName: string | null
  responseStatus: 'needsAction' | 'accepted' | 'declined' | 'tentative'
}

export interface GoogleCalendarEventCreate {
  summary: string
  description?: string
  location?: string
  startTime: string
  endTime: string
  attendeeEmails?: string[]
  addGoogleMeet?: boolean
  recurrence?: string[]
  reminders?: { method: 'email' | 'popup'; minutes: number }[]
}

export interface GCalPreferences {
  autoSyncToGoogle: boolean
  showGoogleEvents: boolean
}

export interface GoogleCalendarAccount {
  id: string
  googleEmail: string
  displayName: string | null
  calendarId: string
  color: string
  isPrimary: boolean
  createdAt: string
}

// ── Chat ──────────────────────────────────────────────────────────
export interface ChatConversation {
  id: string
  userId: string
  title: string
  createdAt: string
}

export interface ChatMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  toolCalls?: AIAction[] | string | null
  createdAt: string
}

export interface AISettings {
  userId?: string
  fullTrustMode: boolean
  categories: Record<string, boolean>
  createdAt?: string
  updatedAt?: string
}

export interface ChatActionResponse {
  action: AIAction
  result?: unknown
  error?: {
    code: string
    category?: string
    message: string
  }
}

// ── Lock-In Planner ──────────────────────────────────────────────

export type LockInStatus = 'planning' | 'booked' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'

export interface LockIn {
  id: string
  name: string
  startDate: string
  endDate: string
  city: string
  state: string
  status: LockInStatus
  createdByOrgId: number
  budgetTarget: number
  salesGoal: number
  estimatedHeadcount: number
  description: string
  partners?: LockInPartner[]
  agentCount?: number
  budgetTotal?: number
  createdAt: string
  updatedAt?: string
}

export interface LockInPartner {
  id: string
  lockInId: string
  orgId: number
  orgName: string
  status: 'pending' | 'approved' | 'declined'
  invitedBy: number
  approvedBy?: number
  approvedAt?: string
  createdAt: string
}

export interface LockInAgent {
  id: string
  lockInId: string
  agentDiscordId: string
  orgId: number
  agentName: string
  flightAirline: string
  flightNumber: string
  arrivalTime?: string
  departureTime?: string
  lodgingAssignment: string
  dietaryPrefs: string
  roommatePref: string
  status: 'invited' | 'confirmed' | 'declined'
  createdAt: string
}

export interface LockInBudgetItem {
  id: string
  lockInId: string
  category: string
  description: string
  amount: number
  paidByOrgId?: number
  splitType: string
  createdAt: string
}

export interface LockInItineraryItem {
  id: string
  lockInId: string
  dayNumber: number
  startTime: string
  endTime: string
  title: string
  description: string
  location: string
  category: string
  createdAt: string
}

export interface BudgetSummary {
  total: number
  byCategory: Record<string, number>
  perOrgSplit: Record<string, number>
  perAgentCost: number
}

export const LOCK_IN_STATUSES: LockInStatus[] = ['planning', 'booked', 'confirmed', 'in_progress', 'completed', 'cancelled']

export const LOCK_IN_STATUS_COLORS: Record<LockInStatus, string> = {
  planning: '#3b82f6',
  booked: '#f59e0b',
  confirmed: '#10b981',
  in_progress: '#8b5cf6',
  completed: '#22c55e',
  cancelled: '#ef4444',
}

export const BUDGET_CATEGORIES = ['lodging', 'flights', 'meals', 'venue', 'transport', 'other'] as const
export const ITINERARY_CATEGORIES = ['training', 'calls', 'meal', 'activity', 'travel', 'general'] as const

// Stage Configs (Pipeline Settings)
export interface StageConfig {
  id: string
  stage: RecruitStage
  smsTemplate: string
  managerDiscordId: string
  managerName: string
  notifyDiscord: boolean
  autoAssign: boolean
  createdAt: string
  updatedAt: string
}

// Expenses
export interface Expense {
  id: string
  orgId: string | null
  category: string
  description: string
  amount: number
  expenseDate: string
  agentDiscordId: string | null
  receiptUrl: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateExpenseRequest {
  category: string
  description: string
  amount: number
  expenseDate?: string
  agentDiscordId?: string
  receiptUrl?: string
}

export interface UpdateExpenseRequest {
  category?: string
  description?: string
  amount?: number
  expenseDate?: string
  agentDiscordId?: string
  receiptUrl?: string
}

export type MailboxProviderType = 'generic_imap' | 'gmail_oauth'
export type MailboxSecurityMode = 'ssl_tls' | 'starttls' | 'none'
export type MailboxConnectionStatus = 'connected' | 'testing' | 'syncing' | 'needs_attention' | 'disabled'
export type ImportedInvoiceStatus = 'pending_review' | 'approved' | 'rejected' | 'duplicate' | 'needs_attention'
export type ImportedInvoiceApprovalTarget = 'lead_spend' | 'receipt'

export interface MailboxConnection {
  id: string
  orgId?: string | null
  userId?: string | null
  providerType: MailboxProviderType
  email: string
  displayName: string
  host?: string | null
  port?: number | null
  securityMode?: MailboxSecurityMode | null
  folders: string[]
  status: MailboxConnectionStatus
  lastUid?: string | null
  lastMessageDate?: string | null
  lastSyncAt?: string | null
  importedCount: number
  failedCount: number
  errorMessage?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateMailboxConnectionRequest {
  providerType: MailboxProviderType
  email: string
  displayName?: string
  host?: string
  port?: number
  securityMode?: MailboxSecurityMode
  username?: string
  password?: string
  folders: string[]
}

export interface UpdateMailboxConnectionRequest {
  displayName?: string
  enabled?: boolean
  folders?: string[]
  status?: MailboxConnectionStatus
}

export interface MailboxTestResult {
  ok: boolean
  message: string
}

export interface MailboxSyncResult {
  importedCount: number
  duplicateCount: number
  failedCount: number
  message: string
}

export interface InvoiceExtractionResult {
  vendorName: string
  invoiceNumber?: string | null
  amount: number
  invoiceDate: string
  billingPeriod?: string | null
  leadCount?: number | null
  agentId?: string | null
  sourceId?: string | null
  category?: string | null
  confidenceScore: number
  extractionNotes: string
}

export interface ImportedInvoice {
  id: string
  orgId?: string | null
  mailboxId: string
  providerType: MailboxProviderType
  folder: string
  messageId: string
  sourceMessageId?: string | null
  fromEmail: string
  subject: string
  receivedAt: string
  attachmentName?: string | null
  attachmentHash?: string | null
  receiptUrl?: string | null
  status: ImportedInvoiceStatus
  duplicateOfId?: string | null
  approvedTarget?: ImportedInvoiceApprovalTarget | null
  approvedRecordId?: string | null
  extraction: InvoiceExtractionResult
  createdAt: string
  updatedAt: string
}

export interface UpdateImportedInvoiceRequest {
  status?: ImportedInvoiceStatus
  extraction?: Partial<InvoiceExtractionResult>
}

export interface ApproveImportedInvoiceRequest {
  target: ImportedInvoiceApprovalTarget
  sourceId?: string
  agentId?: string
  campaignName?: string
  category?: string
  notes?: string
}

export const EXPENSE_CATEGORIES = [
  'leads', 'marketing', 'travel', 'software', 'office',
  'payroll', 'insurance', 'phone', 'licensing', 'training', 'other',
] as const

export interface FinanceSummary {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  byCategory: Record<string, number>
  byMonth: { month: string; revenue: number; expenses: number; net: number }[]
}

export interface AgentPL {
  agentId: string
  totalCommission: number
  totalExpenses: number
  net: number
}

export interface LeadROI {
  source: string
  cost: number
  recruitCount: number
  convertedCount: number
  costPerRecruit: number
  costPerConversion: number
}

// ── Chargebacks ──────────────────────────────────────

export const CHARGEBACK_REASONS = ['lapse', 'cancellation', 'nsf', 'not_taken', 'other'] as const
export const CHARGEBACK_STATUSES = ['pending', 'recovery_in_progress', 'recovered', 'written_off'] as const

export interface Chargeback {
  id: string
  saleId: string
  agentId: string
  clientName: string
  policyNumber: string | null
  originalAP: number
  chargebackAmount: number
  reason: string
  status: string
  chargebackDate: string
  recoveredAmount: number
  recoveryNotes: string | null
  createdAt: string
  updatedAt: string
  sale?: Sale
  agent?: { firstName: string; lastName: string }
}

export interface CreateChargebackRequest {
  saleId: string
  chargebackAmount: number
  reason: string
  chargebackDate?: string
  recoveryNotes?: string
}

export interface UpdateChargebackRequest {
  status?: string
  recoveredAmount?: number
  recoveryNotes?: string
}

export interface ChargebackSummary {
  totalChargebacks: number
  totalAmount: number
  recoveredAmount: number
  outstandingAmount: number
  writtenOffAmount: number
  recoveryRate: number
  byReason: Record<string, { count: number; amount: number }>
}

// ── Lead Programs ────────────────────────────────────

export interface LeadProgram {
  id: string
  name: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface LeadProgramEntry {
  id: string
  leadProgramId: string
  agentId: string
  period: string
  spend: number
  leadsReceived: number
  notes: string | null
  createdAt: string
  updatedAt: string
  leadProgram?: LeadProgram
  agent?: { firstName: string; lastName: string }
}

export interface CreateLeadProgramRequest {
  name: string
  description?: string
}

export interface CreateLeadProgramEntryRequest {
  leadProgramId: string
  agentId: string
  period: string
  spend: number
  leadsReceived: number
  notes?: string
}

export interface LeadProgramProfitability {
  programId: string
  programName: string
  agentId?: string
  totalSpend: number
  totalLeads: number
  cpa: number
  closeRate: number
  submittedAP: number
  approvedAP: number
  issuedAP: number
  netCommPaid: number
  netPL: number
  policiesSubmitted: number
  policiesApproved: number
  policiesIssued: number
  stillOnBooks: number
  persistencyRate: number
}

// ── Sales Pipeline & Analytics ───────────────────────

export interface PipelineSummary {
  submitted: { count: number; totalAP: number }
  approved: { count: number; totalAP: number }
  issued: { count: number; totalAP: number }
  onBooks: { count: number; totalAP: number }
  paid: { count: number; totalAP: number }
  cancelled: { count: number; totalAP: number }
  closeRate: number
  persistencyRate: number
}

export interface SalesAnalytics {
  byPolicyType: { type: string; count: number; premium: number }[]
  byMonth: { month: string; submitted: number; approved: number; issued: number; premiumAP: number }[]
  byLeadSource: { source: string; count: number; closeRate: number; avgPremium: number }[]
  topAgents: { agentId: string; agentName: string; issuedAP: number; commission: number }[]
}

export interface AgentProfitabilityRow {
  agentId: string
  agentName: string
  totalCommission: number
  totalExpenses: number
  leadSpend: number
  netPL: number
  profitMargin: number
  policiesIssued: number
  policiesOnBooks: number
  persistencyRate: number
}

// ── Sale META helpers ────────────────────────────────
// Backend may not support these fields yet, so we store them in the `notes` field
// as a JSON prefix: [META:{"approvedAP":16492,"onBooks":true,"leadSource":"Policy Tech"}]

export interface SaleMeta {
  approvedAP?: number
  issuedAP?: number
  onBooks?: boolean
  leadSource?: string
  leadProgramId?: string
  cancelledAt?: string
  payorName?: string
  payorRelationship?: string
  payorPhone?: string
  payorAddress?: string
  ownerName?: string
  ownerRelationship?: string
  commissionRate?: number
  commissionSplits?: { agentId: string; percentage: number }[]
}

export interface SalesImportRowError {
  row: number
  field: keyof Sale | 'agentId' | 'clientName' | 'policyType' | 'carrier' | 'premium'
  message: string
}

export function parseSaleMeta(sale: Sale): SaleMeta {
  if (!sale.notes) return {}
  const match = sale.notes.match(/^\[META:(.*?)\]/)
  if (!match) return {}
  try {
    return JSON.parse(match[1]) as SaleMeta
  } catch {
    return {}
  }
}

export function getSaleNotesWithoutMeta(sale: Sale): string {
  if (!sale.notes) return ''
  return sale.notes.replace(/^\[META:.*?\]\s*/, '')
}

export function serializeSaleMeta(meta: SaleMeta, existingNotes?: string | null): string {
  const cleanNotes = existingNotes?.replace(/^\[META:.*?\]\s*/, '') ?? ''
  const metaStr = JSON.stringify(meta)
  return `[META:${metaStr}]${cleanNotes ? ` ${cleanNotes}` : ''}`
}

// ── Webhook Types ─────────────────────────────────────────

export interface WebhookConfig {
  id: string
  orgId: string
  apiKeyPrefix: string
  enabled: boolean
  rateLimit: number
  createdAt: string
  updatedAt: string
}

export interface WebhookLog {
  id: string
  orgId: string
  endpoint: string
  method: string
  statusCode: number
  responseStatus: string
  sourceIP: string
  recruitId: string | null
  errorMessage: string | null
  createdAt: string
}

export interface GenerateWebhookKeyResponse {
  config: WebhookConfig
  apiKey: string
}

// ── Agent Analytics ──────────────────────────────────────────────

export interface AgentWavvData {
  today: { dials: number; connections: number; talkMinutes: number }
  thisWeek: { dials: number; connections: number; talkMinutes: number }
  daily: { date: string; dials: number; connections: number }[]
}

export interface AgentAppointmentData {
  thisWeek: { booked: number; run: number; showRate: number }
  avgPerWeek: number
  weekly: { week: string; booked: number; run: number }[]
}

export interface AgentActivityData {
  today: { hoursActive: number }
  thisWeek: { hoursActive: number; avgDaily: number }
  daily: { date: string; hours: number }[]
}

export interface AgentRecruitsData {
  total: number
  active: number
  conversionRate: number
  byStage: { stage: string; count: number; color: string }[]
  recruits: Recruit[]
}

// ── CRM M1: Contacts, Smart Lists, Filters ───────────────────────────

export type LifecycleStage = 'lead' | 'prospect' | 'customer' | 'agent' | 'churned'

export type ContactSource = 'sale' | 'recruit' | 'agent_lead' | 'manual' | 'import' | 'inbound_message'

export type ContactStatus = 'active' | 'archived' | 'do_not_contact'

export const LIFECYCLE_STAGES: LifecycleStage[] = ['lead', 'prospect', 'customer', 'agent', 'churned']

export const LIFECYCLE_STAGE_LABELS: Record<LifecycleStage, string> = {
  lead: 'Lead',
  prospect: 'Prospect',
  customer: 'Customer',
  agent: 'Agent',
  churned: 'Churned',
}

/** Lifecycle chart palette. Maps to --chart-1..--chart-5 so the theme drives color; never hardcode hex. */
export const LIFECYCLE_STAGE_COLORS: Record<LifecycleStage, string> = {
  lead: 'hsl(var(--chart-1))',
  prospect: 'hsl(var(--chart-2))',
  customer: 'hsl(var(--chart-3))',
  agent: 'hsl(var(--chart-4))',
  churned: 'hsl(var(--chart-5))',
}

export interface ContactAddress {
  id: string
  contactId: string
  kind: 'mailing' | 'home' | 'work' | 'prior' | 'policy'
  line1: string | null
  line2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string
  isPrimary: boolean
  verifiedAt: string | null
  source: string | null
}

export interface Contact {
  id: string
  sourceType: ContactSource
  sourceId: string | null
  ownerAgentDiscordId: string | null
  sharedWithAgentDiscordIds: string[]
  firstName: string | null
  lastName: string | null
  fullName: string
  email: string | null
  phone: string | null
  phoneNormalized: string | null
  dob: string | null
  lifecycleStage: LifecycleStage
  status: ContactStatus
  doNotSms: boolean
  doNotEmail: boolean
  doNotCall: boolean
  customFields: Record<string, unknown>
  tags: string[]
  addresses: ContactAddress[]
  createdAt: string
  updatedAt: string
  lastActivityAt: string | null
}

export type FilterOp =
  | 'eq' | 'neq' | 'in' | 'nin'
  | 'contains' | 'startsWith' | 'endsWith' | 'matches'
  | 'exists'
  | 'gt' | 'gte' | 'lt' | 'lte' | 'between'
  | 'hasTag' | 'lacksTag'

export interface FilterRule {
  field: string
  op: FilterOp
  value?: unknown
}

export interface SmartListFilter {
  combinator: 'and' | 'or'
  rules: (FilterRule | SmartListFilter)[]
}

/** Narrow-guard: a SmartListFilter node vs a leaf FilterRule. */
export function isFilterGroup(node: FilterRule | SmartListFilter): node is SmartListFilter {
  return 'combinator' in node && Array.isArray((node as SmartListFilter).rules)
}

export interface SmartList {
  id: string
  name: string
  description: string | null
  ownerAgentDiscordId: string | null
  sharedWithAgentIds: string[]
  filter: SmartListFilter
  isPinned: boolean
  /** Server-computed match count. Optional because the smart-lists index endpoint may omit counts for speed. */
  count?: number
  createdAt: string
  updatedAt: string
}

/** Request body for POST /api/v1/crm/contacts/search. */
export interface ContactSearchRequest {
  filter?: SmartListFilter | null
  sort?: { field: string; dir: 'asc' | 'desc' }[]
  cursor?: string
  limit?: number
}

export interface ContactsPage {
  contacts: Contact[]
  total: number
  nextCursor?: string | null
}

/** Bulk action kinds accepted by POST /api/v1/crm/contacts/bulk. */
export type BulkActionKind =
  | 'tag' | 'untag'
  | 'archive' | 'restore'
  | 'setOwner' | 'setLifecycle' | 'setDNC'
  | 'exportCsv'

/**
 * Bulk action request keyed by SmartListFilter (by-filter semantics).
 * Backend does not support ids-based bulk — all bulk actions operate on
 * the filter that matched the rows, not on a selected set of ids.
 */
export interface BulkByFilterRequest {
  filter: SmartListFilter
  action: BulkActionKind
  payload?: Record<string, unknown>
}

export interface BulkActionReport {
  affected: number
  skipped: { id: string; reason: string }[]
  errors: string[]
}

/** POST /api/v1/crm/contacts body (create manual contact). */
export interface CreateContactRequest {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  dob?: string
  lifecycleStage?: LifecycleStage
  ownerAgentDiscordId?: string
  customFields?: Record<string, unknown>
  addresses?: Partial<ContactAddress>[]
  tags?: string[]
}

/** PATCH /api/v1/crm/contacts/:id body. Closed whitelist — enforced server-side. */
export interface UpdateContactRequest {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  dob?: string | null
  lifecycleStage?: LifecycleStage
  status?: ContactStatus
  ownerAgentDiscordId?: string | null
  doNotSms?: boolean
  doNotEmail?: boolean
  doNotCall?: boolean
  customFields?: Record<string, unknown>
  /** Full address list for the contact. Server treats this as a replace-all
   *  (diff against existing, insert/update/delete accordingly). Optional on
   *  every PATCH — omitted means no change. */
  addresses?: Partial<ContactAddress>[]
}

export interface ContactTagStat {
  tag: string
  count: number
}

// ── CRM M2A: Conversations + Messages + Templates ───────────────────────
//
// Mirrors the backend shapes in internal/repo/conversations.go,
// messages.go, templates.go. All ids are ULIDs (string), timestamps are
// ISO-8601 strings (the api client transforms the backend's
// time.Time JSON output into Date objects on demand).

export type Channel = 'sms' | 'whatsapp' | 'imessage' | 'email' | 'voice'
export type Provider = 'twilio' | 'meta' | 'telnyx' | (string & {})
export type ConversationStatus = 'open' | 'snoozed' | 'closed'
export type MessageDirection = 'inbound' | 'outbound'
export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'delivery_failed' | 'failed'
export type MessageTemplateStatus = 'draft' | 'approved' | 'rejected'

export interface Conversation {
  id: string
  contactId: string
  channel: Channel
  provider: Provider
  externalThreadId?: string
  status: ConversationStatus
  assignedAgentId?: string
  lastInboundAt?: string
  lastOutboundAt?: string
  unreadCount: number
  whatsappWindowExpiresAt?: string
  snoozeUntil?: string
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  conversationId: string
  contactId: string
  direction: MessageDirection
  channel: Channel
  provider: Provider
  externalMessageId?: string
  fromAddr?: string
  toAddr?: string
  body: string
  /** Email subject. Populated by backend in M2B; optimistic-only before. */
  subject?: string
  mediaUrls?: string[]
  templateId?: string
  templateVariables?: Record<string, unknown>
  status: MessageStatus
  errorCode?: string
  errorMessage?: string
  sentByAgentId?: string
  sentByAutomationId?: string
  costCents?: number
  idempotencyKey?: string
  createdAt: string
}

export interface MessageTemplate {
  id: string
  name: string
  channel: Channel
  provider: Provider
  externalId?: string
  category?: string
  language: string
  body: string
  variables: string[]
  status: MessageTemplateStatus
  createdAt: string
  updatedAt: string
}

export interface ConversationListRequest {
  channel?: Channel
  status?: ConversationStatus
  assignedAgentId?: string
  cursor?: string
  limit?: number
}

export interface ConversationListResponse {
  conversations: Conversation[]
  nextCursor?: string
}

export interface ConversationDetailResponse {
  conversation: Conversation
  messages: Message[]
  nextMessageCursor?: string
}

export interface MessageListResponse {
  messages: Message[]
  nextCursor?: string
}

export interface SendMessageRequest {
  body?: string
  /** Email subject. Backend reads in M2B; ignored on earlier revisions. */
  subject?: string
  mediaUrls?: string[]
  templateId?: string
  templateVariables?: Record<string, unknown>
  /** Required client-minted UUID; the backend de-dupes (conversationId, key). */
  idempotencyKey: string
}

export interface CreateMessageTemplateRequest {
  name: string
  channel: Channel
  provider: Provider
  externalId?: string
  category?: string
  language?: string
  body: string
  variables?: string[]
  status?: MessageTemplateStatus
}

export type UpdateMessageTemplateRequest = Partial<CreateMessageTemplateRequest>
