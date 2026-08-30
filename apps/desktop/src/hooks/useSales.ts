import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { CreateSaleRequest, UpdateSaleRequest, Sale, SalesAgentDirectoryEntry } from '../types/portal'
import { isMockMode } from '../components/sales/sales-mock-mode'
import { MOCK_SALES_RESPONSE } from '../components/sales/mock-policies'

export const AGENT_PROFITABILITY_BACKEND_ENABLED = import.meta.env.VITE_AGENT_PROFITABILITY_BACKEND === 'true'

export function useSales(params?: { page?: number; status?: string; agentId?: string; policyType?: string; carrier?: string; dateFrom?: string; dateTo?: string }) {
  const mock = isMockMode()
  return useQuery({
    queryKey: ['sales', params, mock],
    queryFn: async () => {
      if (mock) return MOCK_SALES_RESPONSE
      return api.getAllSales(params)
    },
    retry: 1,
  })
}

export function useCreateSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateSaleRequest) => {
      if (isMockMode()) {
        return { id: `mock-${Date.now()}`, ...data } as unknown as Sale
      }
      return api.createSale(data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
    },
  })
}

export function useSalesAgentDirectory(params?: { search?: string; includeInactive?: boolean }) {
  const mock = isMockMode()
  return useQuery<SalesAgentDirectoryEntry[]>({
    queryKey: ['sales-agent-directory', params, mock],
    queryFn: async () => {
      if (mock) {
        const seen = new Map<string, SalesAgentDirectoryEntry>()
        for (const sale of MOCK_SALES_RESPONSE.sales) {
          if (!sale.agentId || seen.has(sale.agentId)) continue
          const displayName = [sale.agentFirstName, sale.agentLastName].filter(Boolean).join(' ').trim()
          seen.set(sale.agentId, {
            agentId: sale.agentId,
            displayName: displayName || `Agent ${sale.agentId.slice(0, 8)}`,
            firstName: sale.agentFirstName ?? null,
            lastName: sale.agentLastName ?? null,
            isActive: true,
          })
        }
        return Array.from(seen.values())
      }
      return api.getSalesAgentDirectory(params)
    },
    retry: 1,
    staleTime: 60_000,
  })
}

export function useUpdateSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateSaleRequest }) => {
      if (isMockMode()) {
        return { id, ...data } as unknown as Sale
      }
      return api.updateSale(id, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
    },
  })
}

export function useDeleteSale() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (isMockMode()) return
      return api.deleteSale(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
    },
  })
}

export function useSalesPipeline(params?: { agentId?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['sales-pipeline', params],
    queryFn: () => api.getSalesPipeline(params),
    retry: 1,
  })
}

export function useSalesAnalytics(params?: { agentId?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['sales-analytics', params],
    queryFn: () => api.getSalesAnalytics(params),
    retry: 1,
  })
}

export function useAgentProfitability(params?: { dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['agent-profitability', params],
    queryFn: () => {
      if (!AGENT_PROFITABILITY_BACKEND_ENABLED) return []
      return api.getAgentProfitability(params)
    },
    retry: 1,
  })
}
