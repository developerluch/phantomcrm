import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'

export function useOrgChart() {
  return useQuery({
    queryKey: ['org-chart'],
    queryFn: () => api.getOrgChart(),
    retry: 1,
  })
}

export function useMyTeam() {
  return useQuery({
    queryKey: ['org-chart', 'my-team'],
    queryFn: () => api.getMyTeam(),
    retry: 1,
  })
}

export function useAssignManager() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, managerId }: { agentId: string; managerId: string }) =>
      api.assignManager(agentId, managerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-chart'] })
    },
  })
}

export function useSavePositions() {
  return useMutation({
    mutationFn: (positions: { agentId: string; x: number; y: number }[]) =>
      api.saveOrgChartPositions(positions),
  })
}

export function useResetPositions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.resetOrgChartPositions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-chart'] })
    },
  })
}
