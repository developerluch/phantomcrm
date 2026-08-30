import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { CreateScheduleEventRequest, UpdateScheduleEventRequest } from '../types/portal'

export function useScheduleEvents(agentId: string | null, params?: { start?: string; end?: string }) {
  return useQuery({
    queryKey: ['schedule', agentId, params],
    queryFn: () => api.getScheduleEvents(agentId!, params),
    enabled: !!agentId,
  })
}

export function useCreateScheduleEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, data }: { agentId: string; data: CreateScheduleEventRequest }) =>
      api.createScheduleEvent(agentId, data),
    onSuccess: (_data, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: ['schedule', agentId] })
    },
  })
}

export function useUpdateScheduleEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, eventId, data }: { agentId: string; eventId: string; data: UpdateScheduleEventRequest }) =>
      api.updateScheduleEvent(agentId, eventId, data),
    onSuccess: (_data, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: ['schedule', agentId] })
    },
  })
}

export function useDeleteScheduleEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ agentId, eventId }: { agentId: string; eventId: string }) =>
      api.deleteScheduleEvent(agentId, eventId),
    onSuccess: (_data, { agentId }) => {
      queryClient.invalidateQueries({ queryKey: ['schedule', agentId] })
    },
  })
}
