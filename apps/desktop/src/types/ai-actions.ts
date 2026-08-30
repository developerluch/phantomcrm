// ── AI Action Types ──────────────────────────────────

export type AIActionType = string

export type AIActionStatus =
  | 'pending'
  | 'executing'
  | 'succeeded'
  | 'failed'
  | 'dismissed'

export interface AIAction {
  id: string
  type: AIActionType
  label: string
  description: string
  category?: string
  data: Record<string, unknown>
  status: AIActionStatus
  error?: string
  result?: unknown
  requiresConfirmation?: boolean
}

// ── Action Labels ────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  agent_action: 'Agent Action',
  create_recruit: 'Create Recruit',
  update_recruit: 'Update Recruit',
  delete_recruit: 'Delete Recruit',
  schedule_recruit_interview: 'Schedule Recruit Interview',
  create_expense: 'Create Expense',
  create_sale: 'Create Sale',
  update_sale: 'Update Sale',
  delete_sale: 'Delete Sale',
  create_chargeback: 'Create Chargeback',
  log_lead_spend: 'Log Lead Spend',
  query_analytics: 'Query Analytics',
  create_appointment: 'Create Appointment',
  update_appointment: 'Update Appointment',
  delete_appointment: 'Delete Appointment',
  manage_expense: 'Expense Action',
  manage_license: 'License Action',
  manage_team: 'Team Action',
  send_message: 'Send Message',
  manage_lock_in: 'Lock-In Action',
  manage_drip_campaign: 'Drip Campaign Action',
  mark_notifications_read: 'Mark Notifications Read',
  manage_documents: 'Document Action',
  manage_pending_join: 'Pending Join Action',
}

// ── Parser ───────────────────────────────────────────

interface ToolCall {
  id?: string
  type?: string
  actionType?: string
  action_type?: string
  category?: string
  label?: string
  description?: string
  data?: unknown
  inputJson?: unknown
  input_json?: unknown
  resultJson?: unknown
  result_json?: unknown
  error?: string
  status?: string
  requiresConfirmation?: boolean
  function?: {
    name?: string
    arguments?: string
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeData(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value
  return {}
}

function normalizeStatus(status: unknown): AIActionStatus {
  switch (status) {
    case 'executing':
      return 'executing'
    case 'succeeded':
    case 'success':
    case 'confirmed':
      return 'succeeded'
    case 'failed':
    case 'error':
      return 'failed'
    case 'dismissed':
      return 'dismissed'
    default:
      return 'pending'
  }
}

function humanizeActionType(type: string): string {
  const label = ACTION_LABELS[type]
  if (label) return label
  return type
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

function parseFunctionArguments(value?: string): Record<string, unknown> {
  if (!value) return {}
  try {
    return normalizeData(JSON.parse(value))
  } catch {
    return {}
  }
}

function toolCallToAction(tc: ToolCall): AIAction | null {
  const actionType = tc.actionType ?? tc.action_type ?? tc.function?.name ?? tc.type
  if (!actionType) return null
  if (!tc.id && !ACTION_LABELS[actionType]) return null

  const data = normalizeData(tc.data ?? tc.inputJson ?? tc.input_json ?? parseFunctionArguments(tc.function?.arguments))
  const label = tc.label || humanizeActionType(actionType)
  const result = tc.resultJson ?? tc.result_json
  return {
    id: tc.id || generateId(),
    type: actionType,
    label,
    description: tc.description || `${label} via AI`,
    category: tc.category,
    data,
    status: normalizeStatus(tc.status),
    error: tc.error,
    result,
    requiresConfirmation: tc.requiresConfirmation,
  }
}

/**
 * Parse AI actions from message content and/or toolCalls.
 * Returns cleaned text and extracted actions.
 */
export function parseAIActions(
  content: string,
  toolCalls?: unknown,
): { text: string; actions: AIAction[] } {
  const actions: AIAction[] = []

  // 1. Parse server action summaries from toolCalls.
  if (Array.isArray(toolCalls)) {
    for (const tc of toolCalls) {
      const action = toolCallToAction(tc as ToolCall)
      if (action) actions.push(action)
    }
  } else if (typeof toolCalls === 'string' && toolCalls.trim()) {
    try {
      const parsed = JSON.parse(toolCalls)
      if (Array.isArray(parsed)) {
        for (const tc of parsed) {
          const action = toolCallToAction(tc as ToolCall)
          if (action) actions.push(action)
        }
      }
    } catch {
      // Not valid JSON
    }
  }

  // 2. Keep legacy inline [ACTION:{json}] blocks readable, but server action
  // summaries are authoritative when present.
  const actionRegex = /\[ACTION:(.*?)\]/gs
  const cleanText = content.replace(actionRegex, (_, json: string) => {
    if (actions.length > 0) return ''
    try {
      const parsed = JSON.parse(json) as ToolCall
      const action = toolCallToAction(parsed)
      if (action) actions.push(action)
    } catch {
      // Malformed action block
    }
    return ''
  }).trim()

  return { text: cleanText, actions }
}
