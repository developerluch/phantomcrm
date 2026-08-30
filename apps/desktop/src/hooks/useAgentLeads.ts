import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { CreateAgentLeadRequest, UpdateAgentLeadRequest } from '../types/portal'

export function useAgentLeads(agentId: string | null, params?: { status?: string }) {
  return useQuery({
    queryKey: ['agent-leads', agentId, params],
    queryFn: () => api.getAgentLeads(agentId!, params),
    enabled: !!agentId,
  })
}

export function useCreateAgentLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, data }: { agentId: string; data: CreateAgentLeadRequest }) =>
      api.createAgentLead(agentId, data),
    onSuccess: (_data, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: ['agent-leads', agentId] })
    },
  })
}

export function useUpdateAgentLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, leadId, data }: { agentId: string; leadId: string; data: UpdateAgentLeadRequest }) =>
      api.updateAgentLead(agentId, leadId, data),
    onSuccess: (_data, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: ['agent-leads', agentId] })
    },
  })
}

export function useDeleteAgentLead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, leadId }: { agentId: string; leadId: string }) =>
      api.deleteAgentLead(agentId, leadId),
    onSuccess: (_data, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: ['agent-leads', agentId] })
    },
  })
}
