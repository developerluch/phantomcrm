import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

export function useConversionAnalytics(params?: { guildId?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['analytics-conversion', params?.guildId, params?.dateFrom, params?.dateTo],
    queryFn: () => api.getConversionAnalytics(params),
    retry: 1,
  })
}

export function useSourceAnalytics(params?: { guildId?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['analytics-sources', params?.guildId, params?.dateFrom, params?.dateTo],
    queryFn: () => api.getSourceAnalytics(params),
    retry: 1,
  })
}

export function useTrendsAnalytics(params?: { guildId?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['analytics-trends', params?.guildId, params?.dateFrom, params?.dateTo],
    queryFn: () => api.getTrendsAnalytics(params),
    retry: 1,
  })
}

export function useStageDurationAnalytics(params?: { guildId?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['analytics-stage-duration', params?.guildId, params?.dateFrom, params?.dateTo],
    queryFn: () => api.getStageDurationAnalytics(params),
    retry: 1,
  })
}
