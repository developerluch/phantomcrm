import { create } from 'zustand'

type SidebarTab = 'production' | 'sales' | 'recruits' | 'details'

interface SidebarState {
  isOpen: boolean
  activeDiscordId: string | null
  activeTab: SidebarTab
  open: (discordId: string) => void
  close: () => void
  setTab: (tab: SidebarTab) => void
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: false,
  activeDiscordId: null,
  activeTab: 'production',
  open: (discordId) => set({ isOpen: true, activeDiscordId: discordId, activeTab: 'production' }),
  close: () => set({ isOpen: false, activeDiscordId: null }),
  setTab: (activeTab) => set({ activeTab }),
}))
