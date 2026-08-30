import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'

export function useServers() {
  return useQuery({
    queryKey: ['servers'],
    queryFn: () => api.getServers(),
    retry: 1,
  })
}

export function useCreateServer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { discordGuildId: string; guildName: string; ownerDiscordId: string; iconUrl?: string }) =>
      api.createServer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] })
    },
  })
}

export function useDeleteServer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteServer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['servers'] })
    },
  })
}

export function useServerInviteLink() {
  return useMutation({
    mutationFn: (guildId?: string) => api.getServerInviteLink(guildId),
  })
}
