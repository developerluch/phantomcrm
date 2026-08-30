import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '../services/api'
import { isMockMode } from '../components/crm/inbox/inbox-mock-mode'
import type {
  ConversationDetailResponse,
  Message,
  SendMessageRequest,
} from '../types/portal'

type SendInput = {
  conversationId: string
  contactId: string
  channel: Message['channel']
  provider: Message['provider']
  request: Omit<SendMessageRequest, 'idempotencyKey'> & { idempotencyKey?: string }
}

type SendCtx = {
  conversationId: string
  optimisticId: string
  previousDetail: ConversationDetailResponse | undefined
}

/** Mint a UUID per attempt. Two rapid clicks therefore look like two
 *  attempts to the server — but each attempt is itself idempotent (the
 *  hook reuses the optimisticId only inside one in-flight mutation). */
function mintIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Optimistic insert: the message bubble appears with status='queued' before
 *  the network round-trip resolves. On success we swap the optimistic record
 *  for the server's authoritative one (same id key); on error we mark the
 *  bubble as 'failed' so the user can retry without losing their text. */
export function useSendMessage() {
  const qc = useQueryClient()
  return useMutation<Message, Error, SendInput, SendCtx>({
    mutationFn: ({ conversationId, contactId, channel, provider, request }) => {
      const idempotencyKey = request.idempotencyKey ?? mintIdempotencyKey()
      // Mock mode: short-circuit any 'mock-' thread to a synthetic 'sent'
      // message instead of POST /messages — keeps the optimistic insert in
      // place and avoids "API 404: conversation not found" toasts.
      if (isMockMode() && conversationId.startsWith('mock-')) {
        const synthetic: Message = {
          id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          conversationId,
          contactId,
          direction: 'outbound',
          channel,
          provider,
          body: request.body ?? '',
          subject: request.subject,
          mediaUrls: request.mediaUrls,
          templateId: request.templateId,
          templateVariables: request.templateVariables,
          status: 'sent',
          idempotencyKey,
          createdAt: new Date().toISOString(),
        }
        return Promise.resolve(synthetic)
      }
      const body: SendMessageRequest = { ...request, idempotencyKey }
      return api.crmSendMessage(conversationId, body)
    },
    onMutate: async ({ conversationId, contactId, channel, provider, request }) => {
      await qc.cancelQueries({
        queryKey: ['crm', 'conversations', 'detail', conversationId],
      })
      const previousDetail = qc.getQueryData<ConversationDetailResponse>([
        'crm', 'conversations', 'detail', conversationId,
      ])
      const optimisticId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      const optimistic: Message = {
        id: optimisticId,
        conversationId,
        contactId,
        direction: 'outbound',
        channel,
        provider,
        body: request.body ?? '',
        subject: request.subject,
        mediaUrls: request.mediaUrls,
        templateId: request.templateId,
        templateVariables: request.templateVariables,
        status: 'queued',
        idempotencyKey: request.idempotencyKey,
        createdAt: new Date().toISOString(),
      }
      if (previousDetail) {
        qc.setQueryData<ConversationDetailResponse>(
          ['crm', 'conversations', 'detail', conversationId],
          {
            ...previousDetail,
            messages: [optimistic, ...previousDetail.messages],
          },
        )
      }
      return { conversationId, optimisticId, previousDetail }
    },
    onSuccess: (saved, _vars, ctx) => {
      // Swap the optimistic record for the server one. Match on
      // optimisticId so concurrent sends (different optimisticIds) all
      // resolve cleanly.
      qc.setQueryData<ConversationDetailResponse>(
        ['crm', 'conversations', 'detail', ctx.conversationId],
        (old) =>
          old
            ? {
                ...old,
                messages: old.messages.map((m) =>
                  m.id === ctx.optimisticId ? saved : m,
                ),
              }
            : old,
      )
      // Bump the conversation list so the thread sorts to the top.
      qc.invalidateQueries({ queryKey: ['crm', 'conversations', 'list'] })
    },
    onError: (err, _vars, ctx) => {
      if (!ctx) return
      // Mark the optimistic message as 'failed' so the user can retry
      // — DON'T remove it (would lose their text).
      qc.setQueryData<ConversationDetailResponse>(
        ['crm', 'conversations', 'detail', ctx.conversationId],
        (old) =>
          old
            ? {
                ...old,
                messages: old.messages.map((m) =>
                  m.id === ctx.optimisticId
                    ? { ...m, status: 'failed', errorMessage: err.message }
                    : m,
                ),
              }
            : old,
      )
    },
  })
}

/** Resend a previously-failed message. Backend wiring (a dedicated retry
 *  endpoint that re-publishes by message id) lands in M2B; until then this
 *  surface only flips the cached bubble to 'queued' and toasts the user so
 *  the intent is visible. The optimistic flip is durable — when the real
 *  retry endpoint arrives, this hook will gain a network round-trip but
 *  the cache update stays. */
export function useResendMessage() {
  const qc = useQueryClient()
  return useMutation<void, Error, { conversationId: string; messageId: string }>({
    mutationFn: async () => {
      toast.message('Retry queued — backend wire lands in M2B')
    },
    onMutate: ({ conversationId, messageId }) => {
      qc.setQueryData<ConversationDetailResponse>(
        ['crm', 'conversations', 'detail', conversationId],
        (old) =>
          old
            ? {
                ...old,
                messages: old.messages.map((m) =>
                  m.id === messageId
                    ? { ...m, status: 'queued', errorMessage: undefined }
                    : m,
                ),
              }
            : old,
      )
    },
  })
}
