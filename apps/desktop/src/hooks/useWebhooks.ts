import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'

export function useWebhookConfig() {
  return useQuery({
    queryKey: ['webhook-config'],
    queryFn: () => api.getWebhookConfig(),
    retry: 1,
  })
}

export function useGenerateWebhookKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.generateWebhookKey(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-config'] })
    },
  })
}

export function useUpdateWebhookConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { enabled?: boolean }) => api.updateWebhookConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-config'] })
    },
  })
}

export function useRevokeWebhookKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.revokeWebhookKey(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-config'] })
      queryClient.invalidateQueries({ queryKey: ['webhook-logs'] })
    },
  })
}

export function useWebhookLogs(params?: { page?: number; perPage?: number }) {
  return useQuery({
    queryKey: ['webhook-logs', params],
    queryFn: () => api.getWebhookLogs(params),
    retry: 1,
  })
}

export function useTestWebhook() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.testWebhook(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhook-logs'] })
    },
  })
}
