import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { GoogleCalendarEventCreate } from '../types/portal'

export function useGoogleCalendarStatus() {
  return useQuery({
    queryKey: ['google-calendar', 'status'],
    queryFn: () => api.getGoogleStatus(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

export function useGoogleCalendarEvents(
  params: { timeMin: string; timeMax: string },
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['google-calendar', 'events', params],
    queryFn: () => api.getGoogleCalendarEvents(params),
    enabled,
    retry: 1,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useCreateGoogleEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (event: GoogleCalendarEventCreate) => api.createGoogleCalendarEvent(event),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['google-calendar', 'events'] })
    },
  })
}

export function useUpdateGoogleEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ accountId, eventId, updates }: { accountId?: string; eventId: string; updates: Partial<GoogleCalendarEventCreate> }) =>
      accountId
        ? api.updateGoogleAccountEvent(accountId, eventId, updates)
        : api.updateGoogleCalendarEvent(eventId, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['google-calendar', 'events'] })
    },
  })
}

export function useDeleteGoogleEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ accountId, eventId }: { accountId?: string; eventId: string }) =>
      accountId
        ? api.deleteGoogleAccountEvent(accountId, eventId)
        : api.deleteGoogleCalendarEvent(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['google-calendar', 'events'] })
    },
  })
}

export function useGoogleCalendarAccounts() {
  return useQuery({
    queryKey: ['google-calendar', 'accounts'],
    queryFn: () => api.getGoogleCalendarAccounts(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}

export function useAddGoogleAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.addGoogleCalendarAccount(),
    onSuccess: (data) => {
      const url = data.url
      if (window.electronAPI?.openExternal) {
        window.electronAPI.openExternal(url)
      } else {
        window.open(url, '_blank')
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar', 'accounts'] })
      queryClient.invalidateQueries({ queryKey: ['google-calendar', 'status'] })
    },
  })
}

export function useRemoveGoogleAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (accountId: string) => api.removeGoogleCalendarAccount(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar', 'accounts'] })
      queryClient.invalidateQueries({ queryKey: ['google-calendar', 'status'] })
      queryClient.invalidateQueries({ queryKey: ['google-calendar', 'events'] })
    },
  })
}
