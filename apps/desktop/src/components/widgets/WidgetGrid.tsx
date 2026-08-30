import { useCallback, useEffect, useMemo, useRef, type Ref } from 'react'
import {
  ResponsiveGridLayout,
  type Layout,
  type ResizeHandleAxis,
  type ResponsiveLayouts,
  useContainerWidth,
  verticalCompactor,
} from 'react-grid-layout'
import { useWidgetContext } from '@/contexts/WidgetContext'
import type { Breakpoint, WidgetLayout } from '@/store/layout-store'
import { WidgetShell } from './WidgetShell'
import { ResizeHandle } from './ResizeHandle'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const BREAKPOINTS = { lg: 1280, md: 960, sm: 640 } as const
const COLS = { lg: 12, md: 8, sm: 4 } as const
const BP_KEYS: Breakpoint[] = ['lg', 'md', 'sm']
const LAYOUT_UPDATE_DEBOUNCE_MS = 120

function shallowEqualLayout(a: WidgetLayout[], b: Layout): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]
    const bi = b[i]
    if (ai.i !== bi.i || ai.x !== bi.x || ai.y !== bi.y || ai.w !== bi.w || ai.h !== bi.h) {
      return false
    }
  }
  return true
}

export function WidgetGrid() {
  const { widgets, layouts, isEditing, updateLayouts } = useWidgetContext()
  const { width: containerWidth, containerRef } = useContainerWidth()
  const pendingLayoutsRef = useRef<Partial<Record<Breakpoint, WidgetLayout[]>>>({})
  const layoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const dragConfig = useMemo(() => ({
    enabled: isEditing,
    handle: '.widget-drag-handle',
  }), [isEditing])

  const resizeConfig = useMemo(() => ({
    enabled: isEditing,
    handles: ['se'] as readonly ResizeHandleAxis[],
    handleComponent: (axis: ResizeHandleAxis, ref: Ref<HTMLElement>) => (
      <ResizeHandle
        ref={ref as Ref<HTMLDivElement>}
        handleAxis={axis}
      />
    ),
  }), [isEditing])

  const flushLayoutUpdates = useCallback(() => {
    if (layoutTimerRef.current) {
      clearTimeout(layoutTimerRef.current)
      layoutTimerRef.current = null
    }

    const pending = pendingLayoutsRef.current
    pendingLayoutsRef.current = {}

    for (const bp of BP_KEYS) {
      const next = pending[bp]
      if (next) updateLayouts(bp, next)
    }
  }, [updateLayouts])

  const queueLayoutUpdates = useCallback((updates: Partial<Record<Breakpoint, WidgetLayout[]>>) => {
    pendingLayoutsRef.current = {
      ...pendingLayoutsRef.current,
      ...updates,
    }

    if (layoutTimerRef.current) clearTimeout(layoutTimerRef.current)
    layoutTimerRef.current = setTimeout(flushLayoutUpdates, LAYOUT_UPDATE_DEBOUNCE_MS)
  }, [flushLayoutUpdates])

  useEffect(() => {
    return () => flushLayoutUpdates()
  }, [flushLayoutUpdates])

  const handleLayoutChange = useCallback((_current: Layout, allLayouts: ResponsiveLayouts) => {
    if (!isEditing) return
    const updates: Partial<Record<Breakpoint, WidgetLayout[]>> = {}

    for (const bp of BP_KEYS) {
      const next = allLayouts[bp]
      if (!next) continue
      const prev = pendingLayoutsRef.current[bp] ?? layouts[bp]
      if (shallowEqualLayout(prev, next)) continue
      const merged: WidgetLayout[] = next.map((l) => {
        const original = prev.find((o) => o.i === l.i)
        return {
          i: l.i,
          x: l.x,
          y: l.y,
          w: l.w,
          h: l.h,
          minW: original?.minW,
          minH: original?.minH,
        }
      })
      updates[bp] = merged
    }

    if (Object.keys(updates).length > 0) queueLayoutUpdates(updates)
  }, [isEditing, layouts, queueLayoutUpdates])

  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>}>
      <ResponsiveGridLayout
        className={isEditing ? 'layout editing-grid' : 'layout'}
        width={containerWidth || 1200}
        breakpoints={BREAKPOINTS}
        cols={COLS}
        layouts={layouts as unknown as ResponsiveLayouts}
        rowHeight={60}
        margin={[16, 16] as const}
        containerPadding={[0, 0] as const}
        dragConfig={dragConfig}
        resizeConfig={resizeConfig}
        compactor={verticalCompactor}
        onLayoutChange={handleLayoutChange}
      >
        {widgets.map((widget) => (
          <div key={widget.id} className="h-full">
            <WidgetShell id={widget.id} type={widget.type} />
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  )
}
