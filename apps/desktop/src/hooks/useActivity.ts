import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../services/api'

export function useActivityLog(params?: { guild_id?: string; action_type?: string; limit?: number; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['activity-log', params],
    queryFn: () => api.getActivityLog(params),
    retry: 1,
  })
}

export function useSendAnnouncement() {
  return useMutation({
    mutationFn: (data: { guildId: string; channelId: string; message: string }) =>
      api.sendAnnouncement(data),
  })
}
