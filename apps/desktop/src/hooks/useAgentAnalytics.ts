import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

export function useAgentSalesAnalytics(discordId: string | null) {
  return useQuery({
    queryKey: ['agent-analytics-sales', discordId],
    queryFn: async () => {
      const [sales, stats] = await Promise.all([
        api.getAgentSales(discordId!),
        api.getAgentSalesStats(discordId!),
      ])
      return { sales, stats }
    },
    enabled: !!discordId,
    retry: 1,
  })
}

export function useAgentWavvMetrics(discordId: string | null) {
  return useQuery({
    queryKey: ['agent-analytics-wavv', discordId],
    queryFn: () => api.getAgentWavvMetrics(discordId!),
    enabled: !!discordId,
    retry: 1,
  })
}

export function useAgentRecruitsAnalytics(discordId: string | null) {
  return useQuery({
    queryKey: ['agent-analytics-recruits', discordId],
    queryFn: () => api.getAgentRecruitsData(discordId!),
    enabled: !!discordId,
    retry: 1,
  })
}

export function useAgentAppointments(discordId: string | null) {
  return useQuery({
    queryKey: ['agent-analytics-appointments', discordId],
    queryFn: () => api.getAgentAppointments(discordId!),
    enabled: !!discordId,
    retry: 1,
  })
}

export function useAgentActivityStats(discordId: string | null) {
  return useQuery({
    queryKey: ['agent-analytics-activity', discordId],
    queryFn: () => api.getAgentActivity(discordId!),
    enabled: !!discordId,
    retry: 1,
  })
}
