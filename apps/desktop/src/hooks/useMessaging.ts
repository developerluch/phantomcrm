import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'

// SMS
export function useSmsHistory(params?: { agent_id?: string; guild_id?: string; page?: number; perPage?: number }) {
  return useQuery({
    queryKey: ['sms-history', params],
    queryFn: () => api.getSmsHistory(params),
    retry: 1,
  })
}

export function useSendSms() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { agentId: string; message: string }) => api.sendSms(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sms-history'] })
    },
  })
}

export function useSendSmsCampaign() {
  return useMutation({
    mutationFn: (data: { stageId?: string; guildId?: string; message: string }) =>
      api.sendSmsCampaign(data),
  })
}

// WhatsApp
export function useWhatsAppConversations() {
  return useQuery({
    queryKey: ['whatsapp-conversations'],
    queryFn: () => api.getWhatsAppConversations(),
    retry: 1,
  })
}

export function useWhatsAppMessages(phone: string | null) {
  return useQuery({
    queryKey: ['whatsapp-messages', phone],
    queryFn: () => api.getWhatsAppMessages(phone!),
    enabled: !!phone,
    retry: 1,
  })
}

export function useSendWhatsApp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { to: string; body: string; recruitId?: string }) =>
      api.sendWhatsApp({ to: data.to, body: data.body, recruitId: data.recruitId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-all-conversations'] })
    },
  })
}

export function useAllWhatsAppConversations() {
  return useQuery({
    queryKey: ['whatsapp-all-conversations'],
    queryFn: () => api.getAllWhatsAppConversations(),
    retry: 1,
  })
}

export function useLinkConversationToRecruit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, recruitId }: { conversationId: string; recruitId: string }) =>
      api.linkConversationToRecruit(conversationId, recruitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-all-conversations'] })
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] })
    },
  })
}
