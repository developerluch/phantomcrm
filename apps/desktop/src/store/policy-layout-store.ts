import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  COLLAPSED_H,
  deriveMdLayout,
  deriveSmLayout,
  type Breakpoint,
  type CollapsedHeights,
  type ResponsiveWidgetLayouts,
  type WidgetInstance,
  type WidgetLayout,
} from './layout-store'

interface PolicyLayoutState {
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
}

let policyWidgetCounter = 200

const DEFAULT_WIDGETS: WidgetInstance[] = [
  { id: 'policy-kpi-cards-1', type: 'policy-kpi-cards' },
  { id: 'premium-over-time-1', type: 'premium-over-time' },
  { id: 'status-breakdown-1', type: 'status-breakdown' },
  { id: 'carrier-distribution-1', type: 'carrier-distribution' },
  { id: 'agent-leaderboard-1', type: 'agent-leaderboard' },
  { id: 'recent-activity-1', type: 'recent-activity' },
  { id: 'policy-pipeline-1', type: 'policy-pipeline' },
  { id: 'top-products-1', type: 'top-products' },
]

const DEFAULT_LAYOUTS_LG: WidgetLayout[] = [
  // Row 1 — Stats (full width)
  { i: 'policy-kpi-cards-1', x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2 },
  // Row 2 — Premium chart + Status donut
  { i: 'premium-over-time-1', x: 0, y: 3, w: 8, h: 5, minW: 6, minH: 4 },
  { i: 'status-breakdown-1', x: 8, y: 3, w: 4, h: 5, minW: 3, minH: 3 },
  // Row 3 — Carrier + Leaderboard + Activity
  { i: 'carrier-distribution-1', x: 0, y: 8, w: 4, h: 5, minW: 3, minH: 3 },
  { i: 'agent-leaderboard-1', x: 4, y: 8, w: 4, h: 5, minW: 3, minH: 3 },
  { i: 'recent-activity-1', x: 8, y: 8, w: 4, h: 5, minW: 3, minH: 3 },
  // Row 4 — Pipeline + Products
  { i: 'policy-pipeline-1', x: 0, y: 13, w: 6, h: 5, minW: 4, minH: 3 },
  { i: 'top-products-1', x: 6, y: 13, w: 6, h: 5, minW: 4, minH: 3 },
]

const DEFAULT_LAYOUTS: ResponsiveWidgetLayouts = {
  lg: DEFAULT_LAYOUTS_LG,
  md: deriveMdLayout(DEFAULT_LAYOUTS_LG),
  sm: deriveSmLayout(DEFAULT_LAYOUTS_LG),
}

const LAYOUT_VERSION = 3

export const usePolicyLayoutStore = create<PolicyLayoutState>()(
  persist(
    (set) => ({
      widgets: DEFAULT_WIDGETS,
      layouts: DEFAULT_LAYOUTS,
      isEditing: false,
      collapsed: {},
      setEditing: (isEditing) => set({ isEditing }),
      updateLayouts: (bp, layouts) =>
        set((s) => {
          const nextCollapsed = { ...s.collapsed }
          let changed = false
          for (const item of layouts) {
            if (item.i in nextCollapsed && item.h > COLLAPSED_H + 1) {
              delete nextCollapsed[item.i]
              changed = true
            }
          }
          return {
            layouts: { ...s.layouts, [bp]: layouts },
            ...(changed ? { collapsed: nextCollapsed } : {}),
          }
        }),
      addWidget: (type) => {
        const id = `${type}-${++policyWidgetCounter}`
        set((s) => ({
          widgets: [...s.widgets, { id, type }],
          layouts: {
            lg: [...s.layouts.lg, { i: id, x: 0, y: Infinity, w: 6, h: 4 }],
            md: [...s.layouts.md, { i: id, x: 0, y: Infinity, w: 4, h: 4 }],
            sm: [...s.layouts.sm, { i: id, x: 0, y: Infinity, w: 4, h: 4 }],
          },
        }))
      },
      removeWidget: (id) =>
        set((s) => {
          const nextCollapsed = { ...s.collapsed }
          delete nextCollapsed[id]
          return {
            widgets: s.widgets.filter((w) => w.id !== id),
            layouts: {
              lg: s.layouts.lg.filter((l) => l.i !== id),
              md: s.layouts.md.filter((l) => l.i !== id),
              sm: s.layouts.sm.filter((l) => l.i !== id),
            },
            collapsed: nextCollapsed,
          }
        }),
      resetToDefault: () =>
        set({ widgets: DEFAULT_WIDGETS, layouts: DEFAULT_LAYOUTS, collapsed: {} }),
      toggleCollapse: (id) =>
        set((s) => {
          if (id in s.collapsed) {
            const original = s.collapsed[id]
            const nextLayouts: ResponsiveWidgetLayouts = {
              lg: s.layouts.lg.map((l) => (l.i === id ? { ...l, h: original.lg } : l)),
              md: s.layouts.md.map((l) => (l.i === id ? { ...l, h: original.md } : l)),
              sm: s.layouts.sm.map((l) => (l.i === id ? { ...l, h: original.sm } : l)),
            }
            const nextCollapsed = { ...s.collapsed }
            delete nextCollapsed[id]
            return { layouts: nextLayouts, collapsed: nextCollapsed }
          }
          const snapshot = {
            lg: s.layouts.lg.find((l) => l.i === id)?.h ?? COLLAPSED_H,
            md: s.layouts.md.find((l) => l.i === id)?.h ?? COLLAPSED_H,
            sm: s.layouts.sm.find((l) => l.i === id)?.h ?? COLLAPSED_H,
          }
          const nextLayouts: ResponsiveWidgetLayouts = {
            lg: s.layouts.lg.map((l) => (l.i === id ? { ...l, h: COLLAPSED_H } : l)),
            md: s.layouts.md.map((l) => (l.i === id ? { ...l, h: COLLAPSED_H } : l)),
            sm: s.layouts.sm.map((l) => (l.i === id ? { ...l, h: COLLAPSED_H } : l)),
          }
          return { layouts: nextLayouts, collapsed: { ...s.collapsed, [id]: snapshot } }
        }),
      collapseAll: () =>
        set((s) => {
          const nextCollapsed: CollapsedHeights = { ...s.collapsed }
          const byBp = {
            lg: new Map(s.layouts.lg.map((l) => [l.i, l.h])),
            md: new Map(s.layouts.md.map((l) => [l.i, l.h])),
            sm: new Map(s.layouts.sm.map((l) => [l.i, l.h])),
          }
          for (const w of s.widgets) {
            if (w.id in nextCollapsed) continue
            nextCollapsed[w.id] = {
              lg: byBp.lg.get(w.id) ?? COLLAPSED_H,
              md: byBp.md.get(w.id) ?? COLLAPSED_H,
              sm: byBp.sm.get(w.id) ?? COLLAPSED_H,
            }
          }
          const collapseItem = (l: WidgetLayout) =>
            l.i in nextCollapsed ? { ...l, h: COLLAPSED_H } : l
          return {
            collapsed: nextCollapsed,
            layouts: {
              lg: s.layouts.lg.map(collapseItem),
              md: s.layouts.md.map(collapseItem),
              sm: s.layouts.sm.map(collapseItem),
            },
          }
        }),
      expandAll: () =>
        set((s) => {
          const restore = (bp: Breakpoint) => (l: WidgetLayout) => {
            const entry = s.collapsed[l.i]
            return entry ? { ...l, h: entry[bp] } : l
          }
          return {
            collapsed: {},
            layouts: {
              lg: s.layouts.lg.map(restore('lg')),
              md: s.layouts.md.map(restore('md')),
              sm: s.layouts.sm.map(restore('sm')),
            },
          }
        }),
    }),
    {
      name: 'vipa-policy-layout',
      version: LAYOUT_VERSION,
      partialize: (state) => ({
        widgets: state.widgets,
        layouts: state.layouts,
        collapsed: state.collapsed,
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (version < 2 || !persistedState || typeof persistedState !== 'object') {
          return {
            widgets: DEFAULT_WIDGETS,
            layouts: DEFAULT_LAYOUTS,
            isEditing: false,
            collapsed: {},
          }
        }
        const state = persistedState as Partial<PolicyLayoutState>
        return {
          ...state,
          collapsed: state.collapsed ?? {},
        }
      },
    }
  )
)
