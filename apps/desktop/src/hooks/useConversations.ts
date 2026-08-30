import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type {
  Conversation,
  ConversationListRequest,
  ConversationListResponse,
} from '../types/portal'
import { isMockMode } from '../components/crm/inbox/inbox-mock-mode'
import { MOCK_CONVERSATIONS } from '../components/crm/inbox/mock-conversations'

const isMockConversationId = (id: string): boolean => id.startsWith('mock-')

/** List conversations w/ filters. Cursor + filters are part of the cache key
 *  so flipping channel/status doesn't blow away the previous page.
 *  DEV-only: when localStorage `inbox.mockMode === 'true'`, the queryFn
 *  returns a synthetic dataset instead of hitting the API. Mock flag is
 *  part of the cache key so live and mock results don't bleed together. */
export function useConversations(req: ConversationListRequest = {}) {
  const mock = isMockMode()
  return useQuery<ConversationListResponse>({
    queryKey: ['crm', 'conversations', 'list', req, mock],
    queryFn: mock
      ? async () => ({ conversations: MOCK_CONVERSATIONS })
      : () => api.crmListConversations(req),
    placeholderData: (prev) => prev,
    retry: 1,
  })
}

/** Per-contact thread list — used by the ContactDetailDrawer "Conversations"
 *  tab. */
export function useContactConversations(contactId: string | null | undefined) {
  return useQuery<{ conversations: Conversation[] }>({
    queryKey: ['crm', 'conversations', 'byContact', contactId ?? ''],
    queryFn: () => api.crmContactConversations(contactId as string),
    enabled: !!contactId,
    retry: 1,
  })
}

// ── Conversation-state mutations (snooze / close / read / assign) ──
//
// All four follow the same optimistic-update template as useAddContactTag:
// snapshot the cached list + detail, mutate locally, roll back on error,
// re-fetch on settled. Rolling back is cheap because conversations have
// stable shape — no nested arrays to splice.

type ConvMutationCtx = { lists: Map<readonly unknown[], unknown> }

function snapshotConversationLists(qc: ReturnType<typeof useQueryClient>): ConvMutationCtx {
  const lists = new Map<readonly unknown[], unknown>()
  for (const cache of qc.getQueriesData({ queryKey: ['crm', 'conversations'] })) {
    lists.set(cache[0], cache[1])
  }
  return { lists }
}

function restoreConversationLists(
  qc: ReturnType<typeof useQueryClient>,
  ctx: ConvMutationCtx | undefined,
) {
  if (!ctx) return
  for (const [key, value] of ctx.lists) {
    qc.setQueryData(key, value)
  }
}

function patchConversationEverywhere(
  qc: ReturnType<typeof useQueryClient>,
  id: string,
  patch: Partial<Conversation>,
) {
  // 1) per-conversation detail cache (shape: ConversationDetailResponse)
  qc.setQueriesData<{ conversation: Conversation } & Record<string, unknown>>(
    { queryKey: ['crm', 'conversations', 'detail', id] },
    (old) => (old ? { ...old, conversation: { ...old.conversation, ...patch } } : old),
  )
  // 2) every list query — rewrite the matching item in-place
  qc.setQueriesData<ConversationListResponse>(
    { queryKey: ['crm', 'conversations', 'list'] },
    (old) =>
      old
        ? {
            ...old,
            conversations: old.conversations.map((c) =>
              c.id === id ? { ...c, ...patch } : c,
            ),
          }
        : old,
  )
  // 3) per-contact list (different shape: { conversations: [...] })
  qc.setQueriesData<{ conversations: Conversation[] }>(
    { queryKey: ['crm', 'conversations', 'byContact'] },
    (old) =>
      old
        ? {
            conversations: old.conversations.map((c) =>
              c.id === id ? { ...c, ...patch } : c,
            ),
          }
        : old,
  )
}

export function useSnoozeConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, snoozeUntil }: { id: string; snoozeUntil: string }) => {
      if (isMockMode() && isMockConversationId(id)) return Promise.resolve()
      return api.crmSnoozeConversation(id, snoozeUntil)
    },
    onMutate: async ({ id, snoozeUntil }) => {
      await qc.cancelQueries({ queryKey: ['crm', 'conversations'] })
      const ctx = snapshotConversationLists(qc)
      patchConversationEverywhere(qc, id, { status: 'snoozed', snoozeUntil })
      return ctx
    },
    onError: (_e, _v, ctx) => restoreConversationLists(qc, ctx),
    onSettled: (_d, _e, { id }) => {
      if (isMockMode() && isMockConversationId(id)) return
      qc.invalidateQueries({ queryKey: ['crm', 'conversations'] })
    },
  })
}

export function useCloseConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (isMockMode() && isMockConversationId(id)) return Promise.resolve()
      return api.crmCloseConversation(id)
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['crm', 'conversations'] })
      const ctx = snapshotConversationLists(qc)
      patchConversationEverywhere(qc, id, { status: 'closed' })
      return ctx
    },
    onError: (_e, _v, ctx) => restoreConversationLists(qc, ctx),
    onSettled: (_d, _e, id) => {
      if (isMockMode() && isMockConversationId(id)) return
      qc.invalidateQueries({ queryKey: ['crm', 'conversations'] })
    },
  })
}

export function useReadConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => {
      if (isMockMode() && isMockConversationId(id)) return Promise.resolve()
      return api.crmReadConversation(id)
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['crm', 'conversations'] })
      const ctx = snapshotConversationLists(qc)
      patchConversationEverywhere(qc, id, { unreadCount: 0 })
      return ctx
    },
    onError: (_e, _v, ctx) => restoreConversationLists(qc, ctx),
    onSettled: (_d, _e, id) => {
      // Skip the refetch for mock threads — there's no list to invalidate
      // back from the API and the optimistic patch is already correct.
      if (isMockMode() && isMockConversationId(id)) return
      qc.invalidateQueries({ queryKey: ['crm', 'conversations'] })
    },
  })
}

export function useAssignConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, agentId }: { id: string; agentId: string }) => {
      if (isMockMode() && isMockConversationId(id)) return Promise.resolve()
      return api.crmAssignConversation(id, agentId)
    },
    onMutate: async ({ id, agentId }) => {
      await qc.cancelQueries({ queryKey: ['crm', 'conversations'] })
      const ctx = snapshotConversationLists(qc)
      patchConversationEverywhere(qc, id, { assignedAgentId: agentId || undefined })
      return ctx
    },
    onError: (_e, _v, ctx) => restoreConversationLists(qc, ctx),
    onSettled: (_d, _e, { id }) => {
      if (isMockMode() && isMockConversationId(id)) return
      qc.invalidateQueries({ queryKey: ['crm', 'conversations'] })
    },
  })
}

/** STUB — star/unstar a conversation. Backend wire-up lands in M2B.
 *  No-op mutation that resolves immediately so callers can `await` it.
 *  ToolbarStrip additionally toasts to set user expectation. */
export function useStarConversation() {
  return useMutation({
    mutationFn: (_id: string) => Promise.resolve(),
  })
}
