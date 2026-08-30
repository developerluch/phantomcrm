import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { AgentProfile } from '../types/portal'

export function useProfile(agentId: string | null) {
  return useQuery({
    queryKey: ['profile', agentId],
    queryFn: () => api.getProfile(agentId!),
    enabled: !!agentId,
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, data }: { agentId: string; data: Partial<AgentProfile> }) =>
      api.updateProfile(agentId, data),
    onSuccess: (_data, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', agentId] })
    },
  })
}

export function useSetManager() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, managerId }: { agentId: string; managerId: string | null }) =>
      api.setManager(agentId, managerId),
    onSuccess: (_data, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', agentId] })
      queryClient.invalidateQueries({ queryKey: ['org-chart'] })
    },
  })
}

export function useSetCompTier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, compTierId }: { agentId: string; compTierId: string | null }) =>
      api.setCompTier(agentId, compTierId),
    onSuccess: (_data, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: ['profile', agentId] })
      queryClient.invalidateQueries({ queryKey: ['comp-tiers'] })
    },
  })
}
