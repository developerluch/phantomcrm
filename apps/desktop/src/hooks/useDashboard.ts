import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { api, ApiError } from '../services/api'

/** Returns false (pause polling) when the last fetch hit a 429 or when offline */
function refetchUnless429OrOffline(interval: number) {
  return (query: { state: { error: unknown } }) => {
    if (!navigator.onLine) return false
    if (query.state.error instanceof ApiError && query.state.error.status === 429) return false
    return interval
  }
}

export function useFunnel(params?: { dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['funnel', params?.dateFrom, params?.dateTo],
    queryFn: () => api.getFunnel(params),
    refetchInterval: refetchUnless429OrOffline(60000),
    placeholderData: keepPreviousData,
  })
}

export function useSummary(params?: { dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['summary', params?.dateFrom, params?.dateTo],
    queryFn: () => api.getSummary(params),
    refetchInterval: refetchUnless429OrOffline(60000),
    placeholderData: keepPreviousData,
  })
}

export function useAtRisk(params?: { dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['at-risk', params?.dateFrom, params?.dateTo],
    queryFn: () => api.getAtRisk(params),
    refetchInterval: refetchUnless429OrOffline(120000),
    placeholderData: keepPreviousData,
  })
}

export function useDashboardStats(params?: { guildId?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['dashboard-stats', params?.guildId, params?.dateFrom, params?.dateTo],
    queryFn: () => api.getDashboardStats(params),
    refetchInterval: refetchUnless429OrOffline(60000),
    placeholderData: keepPreviousData,
  })
}

export function useRevenueChart(params?: { dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['revenue-chart', params?.dateFrom, params?.dateTo],
    queryFn: () => api.getRevenueChart(params),
    retry: 1,
    placeholderData: keepPreviousData,
  })
}

export function useLeaderboard(params?: { dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['leaderboard', params?.dateFrom, params?.dateTo],
    queryFn: () => api.getLeaderboard(params),
    retry: 1,
    placeholderData: keepPreviousData,
  })
}

export function usePipelineValue(params?: { dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['pipeline-value', params?.dateFrom, params?.dateTo],
    queryFn: () => api.getPipelineValue(params),
    retry: 1,
    placeholderData: keepPreviousData,
  })
}
