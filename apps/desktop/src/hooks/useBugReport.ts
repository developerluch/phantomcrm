import { useMutation } from '@tanstack/react-query'
import { api } from '../services/api'
import type { CreateBugReportRequest } from '../types/portal'

export function useSubmitBugReport() {
  return useMutation({
    mutationFn: (data: CreateBugReportRequest) => api.submitBugReport(data),
  })
}
