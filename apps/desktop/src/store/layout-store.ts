import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// react-grid-layout fires updateLayouts on every drag/resize frame; writing to
// localStorage per-frame causes jank. This wrapper coalesces setItem calls on a
// 150ms trailing-edge debounce (latest value wins) and flushes on beforeunload
// so nothing is lost. Reads and removals stay synchronous.
const debouncedLocalStorage: Storage = (() => {
  let pendingKey: string | null = null
  let pendingValue: string | null = null
  let timer: ReturnType<typeof setTimeout> | null = null

  const flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (pendingKey !== null && pendingValue !== null) {
      localStorage.setItem(pendingKey, pendingValue)
      pendingKey = null
      pendingValue = null
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', flush)
  }

  return {
    getItem: (key) => {
      if (pendingKey === key && pendingValue !== null) return pendingValue
      return localStorage.getItem(key)
    },
    setItem: (key, value) => {
      pendingKey = key
      pendingValue = value
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, 150)
    },
    removeItem: (key) => {
      if (pendingKey === key) {
        pendingKey = null
        pendingValue = null
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
      }
      localStorage.removeItem(key)
    },
    clear: () => {
      pendingKey = null
      pendingValue = null
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      localStorage.clear()
    },
    key: (index) => localStorage.key(index),
    get length() {
      return localStorage.length
    },
  } as Storage
})()

export interface WidgetInstance {
  id: string
  type: string
}

export interface WidgetLayout {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

export type Breakpoint = 'lg' | 'md' | 'sm'

export interface ResponsiveWidgetLayouts {
  lg: WidgetLayout[]
  md: WidgetLayout[]
  sm: WidgetLayout[]
}

export const COLLAPSED_H = 1

export type CollapsedHeights = Record<string, { lg: number; md: number; sm: number }>

interface LayoutState {
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

let widgetCounter = 100

const DEFAULT_WIDGETS: WidgetInstance[] = [
  // Row 1 — Key Metrics (full width)
  { id: 'stat-cards-1', type: 'stat-cards' },
  // Row 2 — Revenue hero + Recruit summary
  { id: 'revenue-trend-1', type: 'revenue-trend' },
  { id: 'recruit-stats-1', type: 'recruit-stats' },
  { id: 'conversion-rate-1', type: 'conversion-rate' },
  // Row 3 — Pipeline + Activity + Risk
  { id: 'pipeline-overview-1', type: 'pipeline-overview' },
  { id: 'activity-feed-1', type: 'activity-feed' },
  { id: 'at-risk-1', type: 'at-risk' },
  // Row 4 — Leaderboard + Distribution + Quick Actions
  { id: 'leaderboard-1', type: 'leaderboard' },
  { id: 'agent-distribution-1', type: 'agent-distribution' },
  { id: 'quick-actions-1', type: 'quick-actions' },
]

const DEFAULT_LAYOUTS_LG: WidgetLayout[] = [
  // Row 1
  { i: 'stat-cards-1', x: 0, y: 0, w: 12, h: 3, minW: 6, minH: 2 },
  // Row 2
  { i: 'revenue-trend-1', x: 0, y: 3, w: 8, h: 5, minW: 6, minH: 4 },
  { i: 'recruit-stats-1', x: 8, y: 3, w: 4, h: 3, minW: 3, minH: 2 },
  { i: 'conversion-rate-1', x: 8, y: 6, w: 4, h: 3, minW: 3, minH: 2 },
  // Row 3
  { i: 'pipeline-overview-1', x: 0, y: 8, w: 4, h: 5, minW: 4, minH: 3 },
  { i: 'activity-feed-1', x: 4, y: 8, w: 4, h: 5, minW: 3, minH: 3 },
  { i: 'at-risk-1', x: 8, y: 8, w: 4, h: 4, minW: 3, minH: 2 },
  // Row 4
  { i: 'leaderboard-1', x: 0, y: 13, w: 6, h: 4, minW: 4, minH: 3 },
  { i: 'agent-distribution-1', x: 6, y: 13, w: 3, h: 4, minW: 3, minH: 3 },
  { i: 'quick-actions-1', x: 9, y: 13, w: 3, h: 3, minW: 3, minH: 2 },
]

export function deriveMdLayout(lg: WidgetLayout[], cols = 8): WidgetLayout[] {
  return lg.map((l) => {
    const halved = l.w > 4 ? Math.ceil(l.w / 2) : l.w
    const w = Math.min(cols, halved)
    const proposedX = l.x > 4 ? Math.floor(l.x / 2) : l.x
    const x = Math.max(0, Math.min(proposedX, cols - w))
    const minW = l.minW != null ? Math.min(l.minW, w) : undefined
    return { ...l, w, x, minW }
  })
}

export function deriveSmLayout(lg: WidgetLayout[], cols = 4): WidgetLayout[] {
  let y = 0
  return lg.map((l) => {
    const item: WidgetLayout = {
      i: l.i,
      x: 0,
      y,
      w: cols,
      h: l.h,
      minW: l.minW != null ? Math.min(l.minW, cols) : undefined,
      minH: l.minH,
    }
    y += l.h
    return item
  })
}

const DEFAULT_LAYOUTS_MD = deriveMdLayout(DEFAULT_LAYOUTS_LG)
const DEFAULT_LAYOUTS_SM = deriveSmLayout(DEFAULT_LAYOUTS_LG)

const DEFAULT_LAYOUTS: ResponsiveWidgetLayouts = {
  lg: DEFAULT_LAYOUTS_LG,
  md: DEFAULT_LAYOUTS_MD,
  sm: DEFAULT_LAYOUTS_SM,
}

const LAYOUT_VERSION = 4

export const useLayoutStore = create<LayoutState>()(
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
        const id = `${type}-${++widgetCounter}`
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
          const byBp: Record<Breakpoint, Map<string, number>> = {
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
      name: 'vipa-dashboard-layout',
      version: LAYOUT_VERSION,
      storage: createJSONStorage(() => debouncedLocalStorage),
      partialize: (state) => ({
        widgets: state.widgets,
        layouts: state.layouts,
        collapsed: state.collapsed,
      }),
      migrate: (persistedState: unknown, version: number) => {
        if (version < 3 || !persistedState || typeof persistedState !== 'object') {
          return {
            widgets: DEFAULT_WIDGETS,
            layouts: DEFAULT_LAYOUTS,
            isEditing: false,
            collapsed: {},
          }
        }
        const state = persistedState as Partial<LayoutState>
        return {
          ...state,
          collapsed: state.collapsed ?? {},
        }
      },
    }
  )
)
