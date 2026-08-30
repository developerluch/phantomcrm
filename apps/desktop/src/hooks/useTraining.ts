import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { CreateTrainingItemRequest, UpdateTrainingItemRequest } from '../types/portal'

export function useTrainingItems(agentId: string | null) {
  return useQuery({
    queryKey: ['training', agentId],
    queryFn: () => api.getTrainingItems(agentId!),
    enabled: !!agentId,
  })
}

export function useCreateTrainingItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, data }: { agentId: string; data: CreateTrainingItemRequest }) =>
      api.createTrainingItem(agentId, data),
    onSuccess: (_data, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: ['training', agentId] })
    },
  })
}

export function useUpdateTrainingItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, itemId, data }: { agentId: string; itemId: string; data: UpdateTrainingItemRequest }) =>
      api.updateTrainingItem(agentId, itemId, data),
    onSuccess: (_data, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: ['training', agentId] })
    },
  })
}

export function useDeleteTrainingItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, itemId }: { agentId: string; itemId: string }) =>
      api.deleteTrainingItem(agentId, itemId),
    onSuccess: (_data, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: ['training', agentId] })
    },
  })
}
