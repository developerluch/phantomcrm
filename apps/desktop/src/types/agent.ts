// Agent types matching the API response schemas

export interface AgentSummary {
  discord_id: string
  full_name: string | null
  agency: string | null
  current_stage: number
  license_status: string | null
  upline_manager: string | null
  experience_level: string | null
  joined_at: string | null
  last_active: string | null
  kicked_at: string | null
}

export interface ActivityEvent {
  event_type: string
  details: string | null
  created_at: string
}

export interface CheckinRecord {
  week_start: string
  sent_at: string | null
  response: string | null
  responded_at: string | null
}

export interface SetupItem {
  item_key: string
  completed: boolean
  completed_at: string | null
}

export interface AgentDetail extends AgentSummary {
  guild_id: string
  production_written: string | null
  lead_source: string | null
  vision_goals: string | null
  npn: string | null
  license_number: string | null
  resident_state: string | null
  verified_at: string | null
  notification_pref: string | null
  contracting_booked: number
  contracting_completed: number
  setup_completed: number
  form_completed_at: string | null
  sorted_at: string | null
  activated_at: string | null
  kick_reason: string | null
  activity: ActivityEvent[]
  checkins: CheckinRecord[]
  setup_items: SetupItem[]
}

export interface FunnelStage {
  stage: number
  name: string
  count: number
}

export interface FunnelResponse {
  stages: FunnelStage[]
  total: number
}

export interface DashboardSummary {
  total_agents: number
  active_agents: number
  students: number
  at_risk_count: number
  licensed_count: number
  kicked_count: number
  avg_days_to_activation: number | null
}

export interface AtRiskAgent {
  discord_id: string
  full_name: string | null
  agency: string | null
  current_stage: number
  last_active: string | null
  days_inactive: number
  risk_reason: string
}

export interface AgentsListResponse {
  agents: AgentSummary[]
  total: number
}

export const STAGE_NAMES: Record<number, string> = {
  1: 'Joined',
  2: 'Form Started',
  3: 'Sorted',
  4: 'Student',
  5: 'Licensed',
  6: 'Contracting',
  7: 'Setup',
  8: 'Active',
}

export const STAGE_COLORS: Record<number, string> = {
  1: '#95a5a6',
  2: '#3498db',
  3: '#2980b9',
  4: '#f39c12',
  5: '#27ae60',
  6: '#9b59b6',
  7: '#e67e22',
  8: '#2ecc71',
}
