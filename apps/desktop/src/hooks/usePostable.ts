import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { UpdatePostableSettingsRequest } from '../types/portal'

export function usePostableSettings() {
  return useQuery({
    queryKey: ['postable-settings'],
    queryFn: () => api.getPostableSettings(),
    retry: 1,
  })
}

export function useUpdatePostableSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdatePostableSettingsRequest) => api.updatePostableSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['postable-settings'] })
    },
  })
}

export function usePostableCards(occasionId?: string) {
  return useQuery({
    queryKey: ['postable-cards', occasionId],
    queryFn: () => api.listPostableCards(occasionId),
    enabled: false, // only fetch on demand via refetch
    retry: 1,
  })
}

export function useTestPostableConnection() {
  return useMutation({
    mutationFn: () => api.testPostableConnection(),
  })
}

export function useSendPostcard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (saleId: string) => api.sendPostcard(saleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
    },
  })
}
