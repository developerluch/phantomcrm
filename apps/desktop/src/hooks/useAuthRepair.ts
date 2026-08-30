import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { useAuthStore, type AuthUser } from '@/store'

export function useRepairAuthIdentity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.repairAuthIdentity(),
    onSuccess: (repaired) => {
      const { accessToken, refreshToken, ...repairedUser } = repaired
      const state = useAuthStore.getState()
      const nextUser: AuthUser = {
        ...(state.user ?? {
          id: '',
          agentId: '',
          email: '',
          discordId: '',
          displayName: '',
          avatarUrl: '',
          orgId: '',
          roleId: '',
          permissions: [],
        }),
        ...repairedUser,
      }

      state.setAuth(
        nextUser,
        accessToken ?? state.accessToken ?? '',
        refreshToken ?? state.refreshToken ?? '',
      )
      queryClient.invalidateQueries({ queryKey: ['sales-agent-directory'] })
    },
  })
}
