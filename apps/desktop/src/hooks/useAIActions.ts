import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '../services/api'
import type { AIAction } from '../types/ai-actions'

const INVALIDATION_MAP: Record<string, string[][]> = {
  agent_action: [['agents'], ['dashboard-summary']],
  manage_team: [['agents'], ['org-chart']],
  create_recruit: [['recruits'], ['recruit-stats']],
  update_recruit: [['recruits'], ['recruit-stats']],
  delete_recruit: [['recruits'], ['recruit-stats']],
  schedule_recruit_interview: [['recruits'], ['appointments']],
  create_expense: [['expenses'], ['finance-summary']],
  create_sale: [['sales'], ['sales-pipeline'], ['sales-analytics']],
  update_sale: [['sales'], ['sales-pipeline'], ['sales-analytics']],
  delete_sale: [['sales'], ['sales-pipeline'], ['sales-analytics']],
  create_chargeback: [['chargebacks'], ['chargeback-summary'], ['sales']],
  log_lead_spend: [['lead-program-entries'], ['lead-program-profitability'], ['finance-summary']],
  query_analytics: [['dashboard-summary'], ['sales-analytics'], ['finance-summary']],
  create_appointment: [['appointments']],
  update_appointment: [['appointments']],
  delete_appointment: [['appointments']],
  manage_expense: [['expenses'], ['finance-summary']],
  manage_license: [['licenses']],
  send_message: [['messages'], ['conversations']],
  manage_lock_in: [['lock-ins']],
  manage_drip_campaign: [['campaigns'], ['drip-campaigns']],
  mark_notifications_read: [['notifications']],
  manage_documents: [['documents']],
  manage_pending_join: [['pending-joins']],
}

function formatActionType(type: string): string {
  return type
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

export function useExecuteAIAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (action: AIAction) => api.confirmChatAction(action.id),
    onSuccess: (data, action) => {
      if (data.action.status === 'failed') {
        toast.error(`Action failed: ${data.action.error || 'Unknown error'}`)
        return
      }
      const keys = INVALIDATION_MAP[action.type] ?? []
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key })
      }
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] })
      toast.success(`${formatActionType(data.action.type || action.type)} completed`)
    },
    onError: (error) => {
      toast.error(`Action failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    },
  })
}

export function useDismissAIAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (action: AIAction) => api.dismissChatAction(action.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] })
    },
    onError: (error) => {
      toast.error(`Dismiss failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    },
  })
}
