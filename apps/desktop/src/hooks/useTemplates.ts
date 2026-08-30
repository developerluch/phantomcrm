import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type {
  CreateMessageTemplateRequest,
  MessageTemplate,
  UpdateMessageTemplateRequest,
} from '../types/portal'

export function useTemplates(opts: { channel?: string; status?: string } = {}) {
  return useQuery<{ templates: MessageTemplate[] }>({
    queryKey: ['crm', 'templates', 'list', opts],
    queryFn: () => api.crmListTemplates(opts),
    retry: 1,
  })
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateMessageTemplateRequest) => api.crmCreateTemplate(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'templates'] }),
  })
}

export function useUpdateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateMessageTemplateRequest }) =>
      api.crmUpdateTemplate(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'templates'] }),
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.crmDeleteTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crm', 'templates'] }),
  })
}
