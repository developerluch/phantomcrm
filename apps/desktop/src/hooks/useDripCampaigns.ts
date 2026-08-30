import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { DripCampaign, DripStep } from '../types/portal'

export function useDripCampaigns() {
  return useQuery({
    queryKey: ['drip-campaigns'],
    queryFn: () => api.getDripCampaigns(),
  })
}

export function useDripCampaign(id: string) {
  return useQuery({
    queryKey: ['drip-campaigns', id],
    queryFn: () => api.getDripCampaign(id),
    enabled: !!id,
  })
}

export function useCreateDripCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; channel: string; triggerStage: string }) =>
      api.createDripCampaign(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drip-campaigns'] }),
  })
}

export function useUpdateDripCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DripCampaign> }) =>
      api.updateDripCampaign(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drip-campaigns'] }),
  })
}

export function useDeleteDripCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteDripCampaign(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drip-campaigns'] }),
  })
}

export function useDripExecutions(campaignId: string) {
  return useQuery({
    queryKey: ['drip-campaigns', campaignId, 'executions'],
    queryFn: () => api.getDripExecutions(campaignId),
    enabled: !!campaignId,
  })
}

export function useCreateDripStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ campaignId, data }: { campaignId: string; data: { stepOrder: number; delayMinutes: number; messageTemplate: string } }) =>
      api.createDripStep(campaignId, data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['drip-campaigns', vars.campaignId] }),
  })
}

export function useUpdateDripStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ campaignId, stepId, data }: { campaignId: string; stepId: string; data: Partial<DripStep> }) =>
      api.updateDripStep(campaignId, stepId, data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['drip-campaigns', vars.campaignId] }),
  })
}

export function useDeleteDripStep() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ campaignId, stepId }: { campaignId: string; stepId: string }) =>
      api.deleteDripStep(campaignId, stepId),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['drip-campaigns', vars.campaignId] }),
  })
}
