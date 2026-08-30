import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { CreateLeadProgramRequest, CreateLeadProgramEntryRequest } from '../types/portal'

export const LEAD_PROGRAMS_BACKEND_ENABLED = import.meta.env.VITE_LEAD_PROGRAMS_BACKEND === 'true'

export function useLeadPrograms() {
  return useQuery({
    queryKey: ['lead-programs'],
    queryFn: async () => {
      if (!LEAD_PROGRAMS_BACKEND_ENABLED) return []
      try { return await api.getLeadPrograms() } catch { return [] }
    },
    retry: false,
  })
}

export function useCreateLeadProgram() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateLeadProgramRequest) => {
      if (!LEAD_PROGRAMS_BACKEND_ENABLED) return Promise.reject(new Error('Lead programs are not available yet.'))
      return api.createLeadProgram(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-programs'] })
    },
  })
}

export function useUpdateLeadProgram() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateLeadProgramRequest> }) => {
      if (!LEAD_PROGRAMS_BACKEND_ENABLED) return Promise.reject(new Error('Lead programs are not available yet.'))
      return api.updateLeadProgram(id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-programs'] })
    },
  })
}

export function useDeleteLeadProgram() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!LEAD_PROGRAMS_BACKEND_ENABLED) return Promise.reject(new Error('Lead programs are not available yet.'))
      return api.deleteLeadProgram(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-programs'] })
    },
  })
}

export function useLeadProgramEntries(params?: { programId?: string; agentId?: string; periodFrom?: string; periodTo?: string }) {
  return useQuery({
    queryKey: ['lead-program-entries', params],
    queryFn: async () => {
      if (!LEAD_PROGRAMS_BACKEND_ENABLED) return []
      try { return await api.getLeadProgramEntries(params) } catch { return [] }
    },
    retry: false,
  })
}

export function useCreateLeadProgramEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateLeadProgramEntryRequest) => {
      if (!LEAD_PROGRAMS_BACKEND_ENABLED) return Promise.reject(new Error('Lead program entries are not available yet.'))
      return api.createLeadProgramEntry(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-program-entries'] })
      queryClient.invalidateQueries({ queryKey: ['lead-program-profitability'] })
    },
  })
}

export function useUpdateLeadProgramEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateLeadProgramEntryRequest> }) => {
      if (!LEAD_PROGRAMS_BACKEND_ENABLED) return Promise.reject(new Error('Lead program entries are not available yet.'))
      return api.updateLeadProgramEntry(id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-program-entries'] })
      queryClient.invalidateQueries({ queryKey: ['lead-program-profitability'] })
    },
  })
}

export function useDeleteLeadProgramEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!LEAD_PROGRAMS_BACKEND_ENABLED) return Promise.reject(new Error('Lead program entries are not available yet.'))
      return api.deleteLeadProgramEntry(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-program-entries'] })
      queryClient.invalidateQueries({ queryKey: ['lead-program-profitability'] })
    },
  })
}

export function useLeadProgramProfitability(params?: { agentId?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['lead-program-profitability', params],
    queryFn: async () => {
      if (!LEAD_PROGRAMS_BACKEND_ENABLED) return []
      try { return await api.getLeadProgramProfitability(params) } catch { return [] }
    },
    retry: false,
  })
}
