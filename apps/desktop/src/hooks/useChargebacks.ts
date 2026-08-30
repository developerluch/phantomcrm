import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { CreateChargebackRequest, UpdateChargebackRequest } from '../types/portal'

export const CHARGEBACKS_BACKEND_ENABLED = import.meta.env.VITE_CHARGEBACKS_BACKEND === 'true'

export function useChargebacks(params?: { agentId?: string; status?: string; page?: number }) {
  return useQuery({
    queryKey: ['chargebacks', params],
    queryFn: () => {
      if (!CHARGEBACKS_BACKEND_ENABLED) return { chargebacks: [], total: 0 }
      return api.getChargebacks(params)
    },
    retry: 1,
  })
}

export function useChargeback(id: string) {
  return useQuery({
    queryKey: ['chargebacks', id],
    queryFn: () => {
      if (!CHARGEBACKS_BACKEND_ENABLED) return Promise.reject(new Error('Chargebacks are not available yet.'))
      return api.getChargeback(id)
    },
    retry: 1,
    enabled: !!id,
  })
}

export function useCreateChargeback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateChargebackRequest) => {
      if (!CHARGEBACKS_BACKEND_ENABLED) return Promise.reject(new Error('Chargebacks are not available yet.'))
      return api.createChargeback(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chargebacks'] })
      queryClient.invalidateQueries({ queryKey: ['chargeback-summary'] })
    },
  })
}

export function useUpdateChargeback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateChargebackRequest }) => {
      if (!CHARGEBACKS_BACKEND_ENABLED) return Promise.reject(new Error('Chargebacks are not available yet.'))
      return api.updateChargeback(id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chargebacks'] })
      queryClient.invalidateQueries({ queryKey: ['chargeback-summary'] })
    },
  })
}

export function useDeleteChargeback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (!CHARGEBACKS_BACKEND_ENABLED) return Promise.reject(new Error('Chargebacks are not available yet.'))
      return api.deleteChargeback(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chargebacks'] })
      queryClient.invalidateQueries({ queryKey: ['chargeback-summary'] })
    },
  })
}

export function useChargebackSummary(params?: { agentId?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['chargeback-summary', params?.agentId, params?.dateFrom, params?.dateTo],
    queryFn: () => {
      if (!CHARGEBACKS_BACKEND_ENABLED) {
        return {
          totalChargebacks: 0,
          totalAmount: 0,
          recoveredAmount: 0,
          outstandingAmount: 0,
          writtenOffAmount: 0,
          recoveryRate: 0,
          byReason: {},
        }
      }
      return api.getChargebackSummary(params)
    },
    retry: 1,
  })
}
