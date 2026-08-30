import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiError } from '../services/api'
import type { ChatMessage } from '../types/portal'

export function useChatConversations() {
  return useQuery({
    queryKey: ['chat-conversations'],
    queryFn: () => api.getChatConversations(),
    refetchOnWindowFocus: false,
    retry: false,
  })
}

export function useChatMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['chat-messages', conversationId],
    queryFn: () => api.getChatMessages(conversationId!),
    enabled: !!conversationId,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

export function useSendMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ message, conversationId }: { message: string; conversationId?: string }) =>
      api.sendChatMessage(message, conversationId),
    onSuccess: (data, variables) => {
      // Optimistically inject both user + assistant messages into the cache
      // so they display immediately without waiting for GET refetch
      qc.setQueryData<{ messages: ChatMessage[] }>(
        ['chat-messages', data.conversationId],
        (old) => {
          const existing = old?.messages ?? []
          const userMsg: ChatMessage = {
            id: `optimistic-user-${Date.now()}`,
            conversationId: data.conversationId,
            role: 'user',
            content: variables.message,
            createdAt: new Date().toISOString(),
          }
          const aiMsg: ChatMessage = {
            id: `optimistic-${Date.now()}`,
            conversationId: data.conversationId,
            role: data.role as ChatMessage['role'],
            content: data.message,
            toolCalls: data.actions,
            createdAt: new Date().toISOString(),
          }
          return { messages: [...existing, userMsg, aiMsg] }
        }
      )
      qc.invalidateQueries({ queryKey: ['chat-messages', data.conversationId] })
      qc.invalidateQueries({ queryKey: ['chat-conversations'] })
    },
    onError: (error) => {
      const msg = error instanceof ApiError && error.status >= 500
        ? 'AI service is temporarily unavailable. Please try again in a moment.'
        : 'Failed to send message'
      toast.error(msg)
    },
  })
}

export function useDeleteConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteChatConversation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-conversations'] }),
  })
}

export function useRenameConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.renameChatConversation(id, title),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat-conversations'] }),
  })
}
