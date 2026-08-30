import { createContext, useContext, type ReactNode } from 'react'
import type { Breakpoint, CollapsedHeights, ResponsiveWidgetLayouts, WidgetInstance, WidgetLayout } from '@/store/layout-store'
import type { WidgetDefinition } from '@/lib/widget-registry'

export interface WidgetContextValue {
  widgets: WidgetInstance[]
  layouts: ResponsiveWidgetLayouts
  isEditing: boolean
  collapsed: CollapsedHeights
  setEditing: (editing: boolean) => void
  updateLayouts: (bp: Breakpoint, layouts: WidgetLayout[]) => void
  addWidget: (type: string) => void
  removeWidget: (id: string) => void
  resetToDefault: () => void
  toggleCollapse: (id: string) => void
  collapseAll: () => void
  expandAll: () => void
  registry: Record<string, WidgetDefinition>
}

const WidgetContext = createContext<WidgetContextValue | null>(null)

export function useWidgetContext(): WidgetContextValue {
  const ctx = useContext(WidgetContext)
  if (!ctx) throw new Error('useWidgetContext must be used inside <WidgetProvider>')
  return ctx
}

export function WidgetProvider({ value, children }: { value: WidgetContextValue; children: ReactNode }) {
  return <WidgetContext.Provider value={value}>{children}</WidgetContext.Provider>
}
