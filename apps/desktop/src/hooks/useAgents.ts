import { useQuery } from '@tanstack/react-query'
import { api, ApiError } from '../services/api'

export function useAgents(params?: {
  stage?: number
  agency?: string
  search?: string
}) {
  return useQuery({
    queryKey: ['agents', params],
    queryFn: () => api.getAgents(params),
    refetchInterval: (query) =>
      query.state.error instanceof ApiError && query.state.error.status === 429
        ? false
        : 60000,
  })
}

export function useAgent(discordId: string | null) {
  return useQuery({
    queryKey: ['agent', discordId],
    queryFn: () => api.getAgent(discordId!),
    enabled: !!discordId && discordId.trim().length > 0,
    retry: 1,
    staleTime: 30_000,
  })
}
