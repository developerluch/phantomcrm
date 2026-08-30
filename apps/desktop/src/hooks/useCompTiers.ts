import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'

export function useCompTiers() {
  return useQuery({
    queryKey: ['comp-tiers'],
    queryFn: () => api.getCompTiers(),
    retry: 1,
  })
}

export function useCreateCompTier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; percentage: number }) =>
      api.createCompTier(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comp-tiers'] })
    },
  })
}

export function useUpdateCompTier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; percentage?: number } }) =>
      api.updateCompTier(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comp-tiers'] })
    },
  })
}

export function useDeleteCompTier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteCompTier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comp-tiers'] })
    },
  })
}

export function useReorderCompTiers() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => api.reorderCompTiers(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comp-tiers'] })
    },
  })
}
