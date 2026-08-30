import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { CreateExpenseRequest, UpdateExpenseRequest } from '../types/portal'

export function useExpenses(params?: { page?: number; category?: string; agentId?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['expenses', params],
    queryFn: () => api.getExpenses(params),
    retry: 1,
  })
}

export function useCreateExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateExpenseRequest) => api.createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] })
    },
  })
}

export function useUpdateExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateExpenseRequest }) => api.updateExpense(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] })
    },
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] })
    },
  })
}

export function useFinanceSummary(params?: { dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['finance-summary', params],
    queryFn: () => api.getFinanceSummary(params),
    retry: 1,
  })
}

export function useLeadROI(params?: { dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['lead-roi', params?.dateFrom, params?.dateTo],
    queryFn: () => api.getLeadROI(params),
    retry: 1,
  })
}
