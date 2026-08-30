import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { ContactsPage, SmartList, SmartListFilter } from '../types/portal'

export function useSmartLists() {
  return useQuery<{ smartlists: SmartList[]; total: number }>({
    queryKey: ['crm', 'smart-lists', 'list'],
    queryFn: () => api.crmListSmartLists(),
    retry: 1,
  })
}

export function useSmartList(id: string | null | undefined) {
  return useQuery<SmartList>({
    queryKey: ['crm', 'smart-lists', 'detail', id ?? ''],
    queryFn: () => api.crmGetSmartList(id as string),
    enabled: !!id,
    retry: 1,
  })
}

export function useCreateSmartList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      name: string
      description?: string | null
      sharedWithAgentIds?: string[]
      filter: SmartListFilter
      isPinned?: boolean
    }) => api.crmCreateSmartList(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'smart-lists'] })
    },
  })
}

export function useUpdateSmartList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: Parameters<typeof api.crmUpdateSmartList>[1]
    }) => api.crmUpdateSmartList(id, patch),
    onSuccess: (updated) => {
      qc.setQueryData<SmartList>(['crm', 'smart-lists', 'detail', updated.id], updated)
      qc.invalidateQueries({ queryKey: ['crm', 'smart-lists', 'list'] })
    },
  })
}

export function useDeleteSmartList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.crmDeleteSmartList(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'smart-lists'] })
    },
  })
}

export function usePinSmartList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      api.crmPinSmartList(id, pinned),
    onMutate: async ({ id, pinned }) => {
      await qc.cancelQueries({ queryKey: ['crm', 'smart-lists', 'list'] })
      const prev = qc.getQueryData<{ smartlists: SmartList[]; total: number }>([
        'crm', 'smart-lists', 'list',
      ])
      if (prev) {
        qc.setQueryData(['crm', 'smart-lists', 'list'], {
          ...prev,
          smartlists: prev.smartlists.map((s) =>
            s.id === id ? { ...s, isPinned: pinned } : s,
          ),
        })
      }
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['crm', 'smart-lists', 'list'], ctx.prev)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'smart-lists'] })
    },
  })
}

/** Run a saved smart list server-side; same shape as useContacts. */
export function useExecuteSmartList(id: string | null | undefined) {
  return useQuery<ContactsPage>({
    queryKey: ['crm', 'smart-lists', 'execute', id ?? ''],
    queryFn: () => api.crmExecuteSmartList(id as string),
    enabled: !!id,
    retry: 1,
  })
}
