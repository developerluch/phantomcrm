import { useSidebarStore } from '../store/sidebar-store'

export function useAgentSidebar() {
  const { isOpen, activeDiscordId, activeTab, open, close, setTab } = useSidebarStore()
  return { isOpen, activeDiscordId, activeTab, open, close, setTab }
}
