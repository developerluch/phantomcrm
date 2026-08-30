import { useQuery } from '@tanstack/react-query'
import { api } from '../services/api'
import type { ConversationDetailResponse, MessageListResponse } from '../types/portal'
import { isMockMode } from '../components/crm/inbox/inbox-mock-mode'
import { getMockConversationDetail } from '../components/crm/inbox/mock-conversations'

/** Conversation + its most recent page of messages. The InboxPage hits this
 *  every time the user clicks a thread; older history is paginated via
 *  useConversationMessages below.
 *  DEV-only: when localStorage `inbox.mockMode === 'true'` and the id matches
 *  a fixture in MOCK_CONVERSATIONS, the queryFn returns a synthesized detail
 *  payload instead of hitting the API. Real-API path is unchanged for live
 *  ids and when mock mode is off. */
export function useConversation(id: string | null | undefined) {
  return useQuery<ConversationDetailResponse>({
    queryKey: ['crm', 'conversations', 'detail', id ?? ''],
    queryFn: async () => {
      if (isMockMode() && id) {
        const mock = getMockConversationDetail(id)
        if (mock) return mock
      }
      return api.crmGetConversation(id as string)
    },
    enabled: !!id,
    retry: 1,
  })
}

/** Older-history paginator for a conversation. Caller passes the cursor
 *  returned from the previous page; key includes the cursor so each page is
 *  cached independently. */
export function useConversationMessages(
  conversationId: string | null | undefined,
  opts: { cursor?: string; limit?: number } = {},
) {
  return useQuery<MessageListResponse>({
    queryKey: ['crm', 'conversations', 'messages', conversationId ?? '', opts],
    queryFn: () =>
      api.crmListConversationMessages(conversationId as string, opts),
    enabled: !!conversationId && !!opts.cursor, // only paginate when a cursor is provided
    retry: 1,
  })
}
