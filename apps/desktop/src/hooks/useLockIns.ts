import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type { LockIn, LockInAgent, LockInBudgetItem, LockInItineraryItem } from '../types/portal'

// ── Queries ──────────────────────────────────────────────────────

export function useLockIns(orgId?: number) {
  return useQuery({
    queryKey: ['lock-ins', orgId],
    queryFn: () => api.getLockIns(orgId),
  })
}

export function useLockIn(id?: string) {
  return useQuery({
    queryKey: ['lock-ins', id],
    queryFn: () => api.getLockIn(id!),
    enabled: !!id,
  })
}

export function useLockInAgents(lockInId?: string) {
  return useQuery({
    queryKey: ['lock-in-agents', lockInId],
    queryFn: () => api.getLockInAgents(lockInId!),
    enabled: !!lockInId,
  })
}

export function useLockInBudget(lockInId?: string) {
  return useQuery({
    queryKey: ['lock-in-budget', lockInId],
    queryFn: () => api.getLockInBudget(lockInId!),
    enabled: !!lockInId,
  })
}

export function useLockInItinerary(lockInId?: string) {
  return useQuery({
    queryKey: ['lock-in-itinerary', lockInId],
    queryFn: () => api.getLockInItinerary(lockInId!),
    enabled: !!lockInId,
  })
}

// ── Mutations ────────────────────────────────────────────────────

export function useCreateLockIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<LockIn>) => api.createLockIn(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lock-ins'] }),
  })
}

export function useUpdateLockIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LockIn> }) => api.updateLockIn(id, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['lock-ins'] })
      qc.invalidateQueries({ queryKey: ['lock-ins', vars.id] })
    },
  })
}

export function useDeleteLockIn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteLockIn(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lock-ins'] }),
  })
}

export function useInvitePartner() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ lockInId, data }: { lockInId: string; data: { orgId: number; orgName: string } }) =>
      api.invitePartner(lockInId, data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['lock-ins', vars.lockInId] }),
  })
}

export function useRespondPartnerInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ lockInId, partnerId, status }: { lockInId: string; partnerId: string; status: string }) =>
      api.respondPartnerInvite(lockInId, partnerId, status),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['lock-ins', vars.lockInId] }),
  })
}

export function useAddLockInAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ lockInId, data }: { lockInId: string; data: Partial<LockInAgent> }) =>
      api.addLockInAgent(lockInId, data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['lock-in-agents', vars.lockInId] }),
  })
}

export function useUpdateLockInAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ lockInId, agentId, data }: { lockInId: string; agentId: string; data: Partial<LockInAgent> }) =>
      api.updateLockInAgent(lockInId, agentId, data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['lock-in-agents', vars.lockInId] }),
  })
}

export function useAddBudgetItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ lockInId, data }: { lockInId: string; data: Partial<LockInBudgetItem> }) =>
      api.addBudgetItem(lockInId, data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['lock-in-budget', vars.lockInId] }),
  })
}

export function useAddItineraryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ lockInId, data }: { lockInId: string; data: Partial<LockInItineraryItem> }) =>
      api.addItineraryItem(lockInId, data),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['lock-in-itinerary', vars.lockInId] }),
  })
}

export function useSendLockInChat() {
  return useMutation({
    mutationFn: ({ lockInId, message }: { lockInId: string; message: string }) =>
      api.sendLockInChat(lockInId, message),
  })
}
