import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../services/api'

export function usePendingJoins(guildId?: string) {
  return useQuery({
    queryKey: ['pending-joins', guildId],
    queryFn: () => api.getPendingJoins(guildId),
    refetchInterval: (query) =>
      query.state.error instanceof ApiError && query.state.error.status === 429
        ? false
        : 60000,
  })
}

export function usePendingJoinCount(guildId?: string) {
  const { data } = usePendingJoins(guildId)
  return data?.totalPending ?? 0
}

export function useApprovePendingJoin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.approvePendingJoin(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-joins'] }),
  })
}

export function useRejectPendingJoin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, kick }: { id: string; kick?: boolean }) => api.rejectPendingJoin(id, kick),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-joins'] }),
  })
}

export function useBulkPendingJoins() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { ids: string[]; action: 'approve' | 'reject'; kick?: boolean }) =>
      api.bulkPendingJoins(params.ids, params.action, params.kick),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-joins'] }),
  })
}
