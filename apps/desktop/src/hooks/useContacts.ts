import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { hashFilter } from '../lib/filter-hash'
import { isMockMode } from '../components/crm/inbox/inbox-mock-mode'
import { getMockContact } from '../components/crm/inbox/mock-conversations'
import type {
  Contact,
  ContactsPage,
  ContactTagStat,
  CreateContactRequest,
  SmartListFilter,
  UpdateContactRequest,
  BulkActionKind,
} from '../types/portal'

type ListOpts = {
  filter?: SmartListFilter | null
  smartListId?: string
  cursor?: string
  limit?: number
  sort?: { field: string; dir: 'asc' | 'desc' }[]
}

/** List contacts. Filter objects are hashed with `hashFilter` so equivalent
 *  trees share cache entries. */
export function useContacts(opts: ListOpts = {}) {
  const filterHash = opts.filter ? hashFilter(opts.filter) : ''
  return useQuery<ContactsPage>({
    queryKey: [
      'crm', 'contacts', 'search',
      {
        filterHash,
        smartListId: opts.smartListId ?? null,
        cursor: opts.cursor ?? '',
        limit: opts.limit ?? 50,
        sort: opts.sort ?? [],
      },
    ],
    queryFn: () => api.crmListContacts(opts),
    retry: 1,
  })
}

export function useContact(id: string | null | undefined) {
  return useQuery<Contact>({
    queryKey: ['crm', 'contacts', 'detail', id ?? ''],
    queryFn: () => {
      // Mock mode: synthesize a Contact from MOCK_CONVERSATIONS when the id
      // matches a seeded mock thread's contactId (display name). Avoids the
      // GET /contacts/:id 404 toast in dev. Falls through to the API for
      // ids that don't match any mock thread.
      if (isMockMode()) {
        const mock = getMockContact(id as string)
        if (mock) return Promise.resolve(mock)
      }
      return api.crmGetContact(id as string)
    },
    enabled: !!id,
    retry: 1,
  })
}

export function useContactTags() {
  return useQuery<ContactTagStat[]>({
    queryKey: ['crm', 'tags'],
    queryFn: () => api.crmListContactTags(),
    retry: 1,
  })
}

export function useCreateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateContactRequest) => api.crmCreateContact(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'contacts'] })
    },
  })
}

export function useUpdateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateContactRequest }) =>
      api.crmUpdateContact(id, patch),
    onSuccess: (updated) => {
      qc.setQueryData<Contact>(['crm', 'contacts', 'detail', updated.id], updated)
      qc.invalidateQueries({ queryKey: ['crm', 'contacts', 'search'] })
    },
  })
}

export function useArchiveContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.crmArchiveContact(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'contacts'] })
    },
  })
}

export function useRestoreContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.crmRestoreContact(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'contacts'] })
    },
  })
}

/** Optimistic tag add — cheap, reversible. Rolls back on error. */
export function useAddContactTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, tag }: { id: string; tag: string }) => api.crmAddContactTag(id, tag),
    onMutate: async ({ id, tag }) => {
      await qc.cancelQueries({ queryKey: ['crm', 'contacts', 'detail', id] })
      const previous = qc.getQueryData<Contact>(['crm', 'contacts', 'detail', id])
      if (previous && !previous.tags.includes(tag)) {
        qc.setQueryData<Contact>(['crm', 'contacts', 'detail', id], {
          ...previous,
          tags: [...previous.tags, tag],
        })
      }
      return { previous, id }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(['crm', 'contacts', 'detail', ctx.id], ctx.previous)
      }
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: ['crm', 'contacts', 'detail', id] })
      qc.invalidateQueries({ queryKey: ['crm', 'tags'] })
    },
  })
}

export function useRemoveContactTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, tag }: { id: string; tag: string }) => api.crmRemoveContactTag(id, tag),
    onMutate: async ({ id, tag }) => {
      await qc.cancelQueries({ queryKey: ['crm', 'contacts', 'detail', id] })
      const previous = qc.getQueryData<Contact>(['crm', 'contacts', 'detail', id])
      if (previous) {
        qc.setQueryData<Contact>(['crm', 'contacts', 'detail', id], {
          ...previous,
          tags: previous.tags.filter((t) => t !== tag),
        })
      }
      return { previous, id }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(['crm', 'contacts', 'detail', ctx.id], ctx.previous)
      }
    },
    onSettled: (_d, _e, { id }) => {
      qc.invalidateQueries({ queryKey: ['crm', 'contacts', 'detail', id] })
      qc.invalidateQueries({ queryKey: ['crm', 'tags'] })
    },
  })
}

export function useBulkContacts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      filter: SmartListFilter
      action: BulkActionKind
      payload?: Record<string, unknown>
    }) => api.crmBulkContacts(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'contacts'] })
      qc.invalidateQueries({ queryKey: ['crm', 'tags'] })
    },
  })
}

export function useExportContactsCsv() {
  return useMutation({
    mutationFn: (filter: SmartListFilter | null) => api.crmExportContactsCsv(filter),
  })
}

/** Admin-only. Triggers M0 contact backfill. Invalidates the contacts list on
 *  success so new rows show up without a manual refresh. */
export function useRunBackfill() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { dryRun?: boolean } = {}) => api.crmRunBackfill(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'contacts'] })
    },
  })
}
