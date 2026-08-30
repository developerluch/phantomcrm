import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'

export function useCalcomStatus() {
  return useQuery({
    queryKey: ['calcom', 'status'],
    queryFn: () => api.getCalcomV2Status(),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 min
  })
}

export function useCalcomEventTypes(enabled = true) {
  return useQuery({
    queryKey: ['calcom', 'event-types'],
    queryFn: () => api.getCalcomEventTypes(),
    enabled,
    retry: 1,
    staleTime: 10 * 60 * 1000, // 10 min
  })
}

export function useCalcomBookings(
  params?: { status?: string; afterStart?: string; beforeEnd?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: ['calcom', 'bookings', params],
    queryFn: () => api.getCalcomBookings(params),
    enabled,
    retry: 1,
    refetchInterval: 60 * 1000, // refresh every 60s
  })
}
