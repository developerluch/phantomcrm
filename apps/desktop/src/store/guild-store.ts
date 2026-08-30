import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Server } from '../types/portal'

interface GuildState {
  servers: Server[]
  selectedGuildId: string | null
  setServers: (servers: Server[]) => void
  selectGuild: (guildId: string | null) => void
  addServer: (server: Server) => void
  removeServer: (serverId: string) => void
  clearGuilds: () => void
}

export const useGuildStore = create<GuildState>()(
  persist(
    (set, get) => ({
      servers: [],
      selectedGuildId: null,
      setServers: (servers) => set({
        servers,
        selectedGuildId: get().selectedGuildId ?? servers[0]?.id ?? null,
      }),
      selectGuild: (guildId) => set({ selectedGuildId: guildId }),
      addServer: (server) => set((s) => ({ servers: [...s.servers, server] })),
      removeServer: (serverId) => set((s) => ({
        servers: s.servers.filter((g) => g.id !== serverId),
        selectedGuildId: s.selectedGuildId === serverId
          ? s.servers.find((g) => g.id !== serverId)?.id ?? null
          : s.selectedGuildId,
      })),
      clearGuilds: () => set({ servers: [], selectedGuildId: null }),
    }),
    { name: 'vipa-guild' }
  )
)
