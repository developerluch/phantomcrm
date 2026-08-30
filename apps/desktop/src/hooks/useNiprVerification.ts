import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { useAuthStore } from '../store'
import type { VerificationState } from '../types/portal'

export function useNiprVerificationStatus(enabled: boolean) {
  const setVerification = useAuthStore((s) => s.setVerification)
  return useQuery({
    queryKey: ['verification-status'],
    queryFn: async (): Promise<VerificationState> => {
      const data = await api.getVerificationStatus()
      setVerification(data)
      return data
    },
    enabled,
    staleTime: 60_000,
  })
}

export function useStartNiprVerification() {
  const qc = useQueryClient()
  const setVerification = useAuthStore((s) => s.setVerification)

  return useMutation({
    mutationFn: async (): Promise<VerificationState> => {
      if (!window.nipr) {
        throw new Error('NIPR bridge unavailable — relaunch the desktop app.')
      }
      const result = await window.nipr.openVerification()
      if ('cancelled' in result) throw new Error('Verification cancelled.')
      if ('error' in result) throw new Error(result.error)
      const updated = await api.verifyNpn(result)
      setVerification(updated)
      return updated
    },
    onSuccess: (data) => {
      qc.setQueryData(['verification-status'], data)
    },
  })
}
