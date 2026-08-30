import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  IconReceipt,
  IconFileDollar,
  IconAlertTriangle,
  IconTargetArrow,
  IconChartBar,
  IconCircleCheck,
  IconCircleX,
  IconLoader2,
  IconMessage,
  IconBrandWhatsapp,
  IconMessageForward,
  IconSpeakerphone,
  IconMessageChatbot,
  IconUserPlus,
  IconUserEdit,
  IconUsers,
  IconUserSearch,
  IconSchool,
  IconCalendarEvent,
  IconCurrencyDollar,
  IconLicense,
  IconCertificate,
  IconCalendarStats,
  IconCalendarPlus,
  IconUserHeart,
  IconUsersGroup,
  IconReportMoney,
  IconListDetails,
  IconCalendar,
  IconCalendarCheck,
  IconRocket,
} from '@tabler/icons-react'
import type { AIAction, AIActionType } from '../../types/ai-actions'

interface AIActionCardProps {
  action: AIAction
  onConfirm: (action: AIAction) => void
  onDismiss: (action: AIAction) => void
}

const ACTION_ICONS: Record<AIActionType, typeof IconReceipt> = {
  // Finance
  create_expense: IconReceipt,
  create_sale: IconFileDollar,
  create_chargeback: IconAlertTriangle,
  log_lead_spend: IconTargetArrow,
  query_analytics: IconChartBar,
  // Messaging
  send_sms: IconMessage,
  send_whatsapp: IconBrandWhatsapp,
  send_recruit_sms: IconMessageForward,
  send_announcement: IconSpeakerphone,
  send_lock_in_message: IconMessageChatbot,
  // Agent & Recruit
  create_recruit: IconUserPlus,
  update_recruit: IconUserEdit,
  create_agent_lead: IconUsers,
  update_agent_lead: IconUserSearch,
  create_training_item: IconSchool,
  create_schedule_event: IconCalendarEvent,
  // Sales & Licensing
  update_sale: IconCurrencyDollar,
  create_license: IconLicense,
  update_license: IconCertificate,
  // Lock-In
  create_lock_in: IconCalendarStats,
  update_lock_in: IconCalendarPlus,
  invite_lock_in_partner: IconUserHeart,
  add_lock_in_agent: IconUsersGroup,
  add_lock_in_budget_item: IconReportMoney,
  add_lock_in_itinerary_item: IconListDetails,
  // Appointments & Campaigns
  create_appointment: IconCalendar,
  update_appointment: IconCalendarCheck,
  create_campaign: IconRocket,
}

const ACTION_COLORS: Record<AIActionType, string> = {
  // Finance
  create_expense: '#f59e0b',
  create_sale: '#22c55e',
  create_chargeback: '#ef4444',
  log_lead_spend: '#3b82f6',
  query_analytics: '#a855f7',
  // Messaging — blue
  send_sms: '#3b82f6',
  send_whatsapp: '#25d366',
  send_recruit_sms: '#3b82f6',
  send_announcement: '#3b82f6',
  send_lock_in_message: '#3b82f6',
  // Agent & Recruit — purple/indigo
  create_recruit: '#8b5cf6',
  update_recruit: '#8b5cf6',
  create_agent_lead: '#6366f1',
  update_agent_lead: '#6366f1',
  create_training_item: '#6366f1',
  create_schedule_event: '#6366f1',
  // Sales & Licensing — green
  update_sale: '#10b981',
  create_license: '#10b981',
  update_license: '#10b981',
  // Lock-In — amber
  create_lock_in: '#f59e0b',
  update_lock_in: '#f59e0b',
  invite_lock_in_partner: '#f59e0b',
  add_lock_in_agent: '#f59e0b',
  add_lock_in_budget_item: '#f59e0b',
  add_lock_in_itinerary_item: '#f59e0b',
  // Appointments — cyan, Campaigns — pink
  create_appointment: '#06b6d4',
  update_appointment: '#06b6d4',
  create_campaign: '#ec4899',
}

const ACTION_FEATURE_FLAGS: Partial<Record<AIActionType, boolean>> = {
  create_chargeback: import.meta.env.VITE_CHARGEBACKS_BACKEND === 'true',
  log_lead_spend: import.meta.env.VITE_LEAD_PROGRAMS_BACKEND === 'true',
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') {
    if (key.includes('amount') || key.includes('spend') || key.includes('premium') || key.includes('commission') || key.includes('cost')) {
      return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }
    return value.toLocaleString()
  }
  return String(value)
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

export default function AIActionCard({ action, onConfirm, onDismiss }: AIActionCardProps) {
  const Icon = ACTION_ICONS[action.type] ?? IconChartBar
  const accentColor = ACTION_COLORS[action.type] ?? '#3b82f6'
  const displayName = formatKey(action.type)
  const isFeatureEnabled = ACTION_FEATURE_FLAGS[action.type] ?? true
  const isExecuting = action.status === 'executing'
  const isSuccess = action.status === 'succeeded'
  const isError = action.status === 'failed'
  const isPending = action.status === 'pending'

  // Filter out internal/empty fields from display
  const displayFields = Object.entries(action.data).filter(
    ([, v]) => v !== null && v !== undefined && v !== '',
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-2"
    >
      <Card
        className="bg-card/60 backdrop-blur border-white/10 overflow-hidden"
        style={{ borderTopColor: `${accentColor}40` }}
      >
        <div
          className="h-px w-full opacity-60"
          style={{ background: `linear-gradient(90deg, transparent 10%, ${accentColor}, transparent 90%)` }}
        />
        <CardContent className="p-3">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `${accentColor}15`, color: accentColor }}
            >
              <Icon size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">{displayName}</p>
              {action.description && (
                <p className="text-[10px] text-muted-foreground truncate">{action.description}</p>
              )}
            </div>
            {!isFeatureEnabled && isPending && (
              <Badge className="text-[9px] bg-amber-500/15 text-amber-300 border-amber-500/30">
                Deferred
              </Badge>
            )}
            {isSuccess && (
              <Badge className="text-[9px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                <IconCircleCheck size={10} className="mr-0.5" />
                Done
              </Badge>
            )}
            {isError && (
              <Badge className="text-[9px] bg-red-500/15 text-red-400 border-red-500/30">
                <IconCircleX size={10} className="mr-0.5" />
                Failed
              </Badge>
            )}
            {isExecuting && (
              <Badge className="text-[9px] bg-blue-500/15 text-blue-400 border-blue-500/30">
                <IconLoader2 size={10} className="mr-0.5 animate-spin" />
                Running
              </Badge>
            )}
          </div>

          {/* Payload Summary */}
          {displayFields.length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-2.5 pl-9">
              {displayFields.slice(0, 8).map(([key, val]) => (
                <div key={key} className="flex items-baseline gap-1 text-[10px]">
                  <span className="text-muted-foreground/60 shrink-0">{formatKey(key)}:</span>
                  <span className="text-foreground font-medium truncate">{formatValue(key, val)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Error message */}
          {isError && action.error && (
            <p className="text-[10px] text-red-400 mb-2 pl-9">{action.error}</p>
          )}

          {/* Actions */}
          {isPending && isFeatureEnabled && (
            <div className="flex items-center gap-2 pl-9">
              <Button
                variant="gradient"
                size="sm"
                className="h-6 text-[10px] px-3"
                onClick={() => onConfirm(action)}
              >
                Confirm & Execute
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-3"
                onClick={() => onDismiss(action)}
              >
                Dismiss
              </Button>
            </div>
          )}
          {isPending && !isFeatureEnabled && (
            <div className="flex items-center gap-2 pl-9">
              <p className="text-[10px] text-muted-foreground">
                This AI action is gated until backend support is enabled.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-3"
                onClick={() => onDismiss(action)}
              >
                Dismiss
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
