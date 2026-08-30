import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { CreateRecruitRequest } from '../types/portal'

export function useAIImportParse() {
  return useMutation({
    mutationFn: (text: string) => api.aiImportParse(text),
  })
}

export function useAIImportConfirm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateRecruitRequest) => api.createRecruit(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recruits'] })
      qc.invalidateQueries({ queryKey: ['recruit-stats'] })
      qc.invalidateQueries({ queryKey: ['recruit-funnel'] })
    },
  })
}
