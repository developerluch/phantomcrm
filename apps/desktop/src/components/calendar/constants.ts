import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  addDays,
} from 'date-fns'
import type { CalcomBooking, Appointment, AgentScheduleEvent, GoogleCalendarEvent } from '../../types/portal'

// ── View & Mode Types ────────────────────────────────

export type CalendarViewType = 'month' | 'week' | 'day' | 'team'
export type RightPanelMode = 'agenda' | 'analytics'
export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'monthly'

// ── Event Category ───────────────────────────────────

export type EventCategory =
  | 'recruiting_call'
  | 'manager_call'
  | 'sales_appointment'
  | 'client_meeting'
  | 'admin_work'
  | 'training'
  | 'team_meeting'
  | 'interview'
  | 'lock_in'
  | 'personal'
  | 'other'

export const DEFAULT_EVENT_CATEGORY_COLORS: Record<EventCategory, string> = {
  recruiting_call: '#3b82f6',
  manager_call: '#8b5cf6',
  sales_appointment: '#7DD3FC',
  client_meeting: '#10b981',
  admin_work: '#6b7280',
  training: '#ec4899',
  team_meeting: '#f59e0b',
  interview: '#06b6d4',
  lock_in: '#f97316',
  personal: '#a855f7',
  other: '#64748b',
}

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  recruiting_call: 'Recruiting Call',
  manager_call: 'Manager Call',
  sales_appointment: 'Sales Appointment',
  client_meeting: 'Client Meeting',
  admin_work: 'Admin Work',
  training: 'Training',
  team_meeting: 'Team Meeting',
  interview: 'Interview',
  lock_in: 'Lock-In',
  personal: 'Personal',
  other: 'Other',
}

export const EVENT_CATEGORIES: { value: EventCategory; label: string; color: string }[] =
  (Object.keys(DEFAULT_EVENT_CATEGORY_COLORS) as EventCategory[]).map((key) => ({
    value: key,
    label: EVENT_CATEGORY_LABELS[key],
    color: DEFAULT_EVENT_CATEGORY_COLORS[key],
  }))

/** @deprecated Use DEFAULT_EVENT_CATEGORY_COLORS instead */
export const EVENT_CATEGORY_COLORS = DEFAULT_EVENT_CATEGORY_COLORS

// ── Status Colors ────────────────────────────────────

export const STATUS_COLORS: Record<string, string> = {
  accepted: '#22c55e',
  completed: '#22c55e',
  confirmed: '#22c55e',
  scheduled: '#3b82f6',
  pending: '#3b82f6',
  cancelled: '#ef4444',
  rejected: '#ef4444',
  no_show: '#f59e0b',
  rescheduled: '#8b5cf6',
}

// ── Grid Constants ───────────────────────────────────

export const HOUR_HEIGHT_PX = 64
export const HOURS = Array.from({ length: 24 }, (_, i) => i)
export const WORK_START_HOUR = 8
export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

// ── Quick Duration & Reminder Options ────────────────

export const QUICK_DURATIONS = [15, 30, 45, 60] as const

export const REMINDER_OPTIONS = [
  { value: 5, label: '5 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
] as const

// ── Outcome Options ──────────────────────────────────

export const OUTCOME_OPTIONS = [
  { value: 'completed', label: 'Completed', color: '#22c55e' },
  { value: 'no_show', label: 'No-Show', color: '#f59e0b' },
  { value: 'rescheduled', label: 'Rescheduled', color: '#8b5cf6' },
] as const

export const GOOGLE_ACCOUNT_COLORS = ['#ea4335', '#4285f4', '#fbbc04', '#34a853', '#ff6d01'] as const

// ── Unified Calendar Event ───────────────────────────

export interface CalendarEvent {
  id: string
  title: string
  startTime: string
  endTime: string
  status: string
  category: EventCategory
  source: 'calcom' | 'manual' | 'schedule' | 'google'
  meetingLink: string | null
  attendee: string
  agentId: string | null
  agentName: string | null
  eventType: string | null
  color: string
  description: string | null
  recurrence: RecurrenceType
  reminder: number | null
  googleEventId?: string
  accountId?: string
  accountEmail?: string
}

// ── Create Dialog Defaults ───────────────────────────

export interface CreateDialogDefaults {
  date?: Date
  startHour?: number
}

// ── Transformer Functions ────────────────────────────

export function inferCategory(title: string, eventType?: string | null): EventCategory {
  const t = (title + ' ' + (eventType || '')).toLowerCase()

  if (/recruit|prospect|lead\b/.test(t)) return 'recruiting_call'
  if (/manager|upline|director|supervisor/.test(t)) return 'manager_call'
  if (/sale|sell|close|presentation|pitch/.test(t)) return 'sales_appointment'
  if (/client|customer|policyholder|review/.test(t)) return 'client_meeting'
  if (/admin|paperwork|compliance|filing/.test(t)) return 'admin_work'
  if (/train|onboard|course|certif/.test(t)) return 'training'
  if (/team|standup|huddle|staff/.test(t)) return 'team_meeting'
  if (/interview|screen/.test(t)) return 'interview'
  if (/lock.?in|lockin/.test(t)) return 'lock_in'
  if (/personal|doctor|lunch|break|gym/.test(t)) return 'personal'
  return 'other'
}

export function resolveColor(
  status: string,
  category: EventCategory,
  userColors?: Record<EventCategory, string>
): string {
  if (status === 'cancelled' || status === 'rejected') return '#ef4444'
  if (status === 'no_show') return '#f59e0b'

  const categoryColors = userColors ?? DEFAULT_EVENT_CATEGORY_COLORS
  return categoryColors[category] ?? DEFAULT_EVENT_CATEGORY_COLORS.other
}

export function calcomBookingToEvent(booking: CalcomBooking, userColors?: Record<EventCategory, string>): CalendarEvent {
  const category = inferCategory(booking.title, booking.eventType?.title)
  return {
    id: booking.uid,
    title: booking.title,
    startTime: booking.start,
    endTime: booking.end,
    status: booking.status,
    category,
    source: 'calcom',
    meetingLink: booking.location,
    attendee: booking.attendees?.[0]?.name ?? '',
    agentId: null,
    agentName: null,
    eventType: booking.eventType?.title ?? null,
    color: resolveColor(booking.status, category, userColors),
    description: booking.description,
    recurrence: 'none',
    reminder: null,
  }
}

export function appointmentToEvent(apt: Appointment, userColors?: Record<EventCategory, string>): CalendarEvent {
  const category = inferCategory(apt.title)
  return {
    id: apt.id,
    title: apt.title,
    startTime: apt.startTime,
    endTime: apt.endTime,
    status: apt.status,
    category,
    source: 'manual',
    meetingLink: apt.meetingLink,
    attendee: apt.agent ? `${apt.agent.firstName} ${apt.agent.lastName}` : '',
    agentId: apt.agentId,
    agentName: apt.agent ? `${apt.agent.firstName} ${apt.agent.lastName}` : null,
    eventType: null,
    color: resolveColor(apt.status, category, userColors),
    description: apt.description,
    recurrence: 'none',
    reminder: null,
  }
}

export function scheduleEventToCalendarEvent(event: AgentScheduleEvent, userColors?: Record<EventCategory, string>): CalendarEvent {
  const category = inferCategory(event.title, event.type)
  return {
    id: event.id,
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime,
    status: 'scheduled',
    category,
    source: 'schedule',
    meetingLink: null,
    attendee: '',
    agentId: event.agentId,
    agentName: null,
    eventType: event.type || null,
    color: resolveColor('scheduled', category, userColors),
    description: event.description,
    recurrence: 'none',
    reminder: null,
  }
}

export function googleEventToCalendarEvent(ge: GoogleCalendarEvent, userColors?: Record<EventCategory, string>): CalendarEvent {
  const category = inferCategory(ge.summary)
  return {
    id: `google-${ge.googleEventId}`,
    title: ge.summary,
    startTime: ge.startTime,
    endTime: ge.endTime,
    status: ge.status === 'confirmed' ? 'accepted' : ge.status,
    category,
    source: 'google',
    meetingLink: ge.meetingLink,
    attendee: ge.attendees?.[0]?.email ?? '',
    agentId: null,
    agentName: null,
    eventType: null,
    color: ge.accountColor ?? resolveColor('accepted', category, userColors),
    description: ge.description,
    recurrence: ge.recurringEventId ? 'weekly' : 'none',
    reminder: null,
    googleEventId: ge.googleEventId,
    accountId: ge.accountId,
    accountEmail: ge.accountEmail,
  }
}

// ── Position Helpers ─────────────────────────────────

export function getEventPosition(startTime: string, endTime: string): { top: number; height: number } {
  const start = new Date(startTime)
  const end = new Date(endTime)
  const startMinutes = start.getHours() * 60 + start.getMinutes()
  const endMinutes = end.getHours() * 60 + end.getMinutes()
  const durationMinutes = Math.max(endMinutes - startMinutes, 15) // min 15 min height
  return {
    top: (startMinutes / 60) * HOUR_HEIGHT_PX,
    height: (durationMinutes / 60) * HOUR_HEIGHT_PX,
  }
}

export function doTimesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const a0 = new Date(aStart).getTime()
  const a1 = new Date(aEnd).getTime()
  const b0 = new Date(bStart).getTime()
  const b1 = new Date(bEnd).getTime()
  return a0 < b1 && b0 < a1
}

// ── Visible Range Computation ────────────────────────

export function computeVisibleRange(
  view: CalendarViewType,
  selectedDate: Date,
): { start: Date; end: Date } {
  switch (view) {
    case 'month': {
      const ms = startOfMonth(selectedDate)
      const me = endOfMonth(selectedDate)
      return {
        start: startOfWeek(ms, { weekStartsOn: 0 }),
        end: endOfWeek(me, { weekStartsOn: 0 }),
      }
    }
    case 'week': {
      const ws = startOfWeek(selectedDate, { weekStartsOn: 0 })
      return { start: ws, end: endOfDay(addDays(ws, 6)) }
    }
    case 'day':
      return { start: startOfDay(selectedDate), end: endOfDay(selectedDate) }
    case 'team':
      return { start: startOfDay(selectedDate), end: endOfDay(selectedDate) }
  }
}

// ── Overlap Groups ───────────────────────────────────

export interface OverlapInfo {
  index: number
  total: number
}

export function computeOverlapGroups(events: CalendarEvent[]): Map<string, OverlapInfo> {
  const sorted = [...events].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  )
  const result = new Map<string, OverlapInfo>()
  const groups: CalendarEvent[][] = []

  for (const event of sorted) {
    let placed = false
    for (const group of groups) {
      if (group.some((e) => doTimesOverlap(e.startTime, e.endTime, event.startTime, event.endTime))) {
        group.push(event)
        placed = true
        break
      }
    }
    if (!placed) {
      groups.push([event])
    }
  }

  for (const group of groups) {
    group.forEach((event, idx) => {
      result.set(event.id, { index: idx, total: group.length })
    })
  }

  return result
}
