import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../services/api'
import type { CreateRecruitRequest, UpdateRecruitRequest, OnboardingChecklist } from '../types/portal'

export function useRecruits(params?: { search?: string; stage?: string; page?: number; perPage?: number }) {
  return useQuery({
    queryKey: ['recruits', params],
    queryFn: () => api.getRecruits(params),
    retry: 1,
  })
}

export function useRecruitStats(params?: { dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['recruit-stats', params?.dateFrom, params?.dateTo],
    queryFn: () => api.getRecruitStats(params),
    retry: 1,
  })
}

export function useRecruit(id: string | null) {
  return useQuery({
    queryKey: ['recruit', id],
    queryFn: () => api.getRecruit(id!),
    enabled: !!id,
    retry: 1,
  })
}

export function useCreateRecruit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateRecruitRequest) => api.createRecruit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruits'] })
      queryClient.invalidateQueries({ queryKey: ['recruit-stats'] })
    },
  })
}

export function useUpdateRecruit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRecruitRequest }) =>
      api.updateRecruit(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruits'] })
      queryClient.invalidateQueries({ queryKey: ['recruit-stats'] })
      queryClient.invalidateQueries({ queryKey: ['recruit'] })
    },
  })
}

export function useDeleteRecruit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteRecruit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruits'] })
      queryClient.invalidateQueries({ queryKey: ['recruit-stats'] })
    },
  })
}

export function useRecruitMessages(recruitId: string | null) {
  return useQuery({
    queryKey: ['recruit-messages', recruitId],
    queryFn: () => api.getRecruitMessages(recruitId!),
    enabled: !!recruitId,
    refetchInterval: (query) =>
      query.state.error instanceof ApiError && query.state.error.status === 429
        ? false
        : 30000,
    retry: 1,
  })
}

export function useSendRecruitSms() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body, toNumber }: { id: string; body: string; toNumber: string }) =>
      api.sendRecruitSms(id, { body, toNumber }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['recruit', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['recruit-messages', vars.id] })
    },
  })
}

export function useScheduleInterview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, interviewType, date }: { id: string; interviewType: string; date: string }) =>
      api.scheduleRecruitInterview(id, { interviewType, date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruits'] })
      queryClient.invalidateQueries({ queryKey: ['recruit'] })
    },
  })
}

export function useOnboardRecruit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.onboardRecruit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruits'] })
      queryClient.invalidateQueries({ queryKey: ['recruit-stats'] })
      queryClient.invalidateQueries({ queryKey: ['recruit'] })
    },
  })
}

export function useBulkImportRecruits() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { recruits: Array<{ firstName: string; lastName: string; phone?: string; tags?: string; smsMessage?: string; source?: string }> }) =>
      api.bulkImportRecruits(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruits'] })
      queryClient.invalidateQueries({ queryKey: ['recruit-stats'] })
    },
  })
}

export function useRecruitFunnel(params?: { leadSource?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['recruit-funnel', params],
    queryFn: () => api.getRecruitFunnel(params),
    retry: 1,
  })
}

export function useUpdateOnboardingChecklist() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<OnboardingChecklist> }) =>
      api.updateOnboardingChecklist(id, updates),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['recruit', vars.id] })
      queryClient.invalidateQueries({ queryKey: ['recruits'] })
      queryClient.invalidateQueries({ queryKey: ['recruit-stats'] })
    },
  })
}
