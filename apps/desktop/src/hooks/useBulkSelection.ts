import { useCallback, useMemo, useState } from 'react'

/**
 * Reusable bulk-selection hook. Tracks a Set of selected ids and exposes
 * toggle / select-all / clear helpers.
 *
 * Reused by Contacts, Inbox (M2), and Tasks (M3) — pull it up if any of
 * those grow divergent selection semantics.
 */
export function useBulkSelection<T extends { id: string }>(items: T[] | undefined) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    if (!items) return
    setSelected(new Set(items.map((i) => i.id)))
  }, [items])

  const clear = useCallback(() => setSelected(new Set()), [])

  const setMany = useCallback((ids: string[]) => {
    setSelected(new Set(ids))
  }, [])

  const isSelected = useCallback((id: string) => selected.has(id), [selected])

  const count = selected.size

  const allSelected = useMemo(() => {
    if (!items || items.length === 0) return false
    return items.every((i) => selected.has(i.id))
  }, [items, selected])

  const someSelected = count > 0 && !allSelected

  return {
    selected,
    selectedIds: useMemo(() => Array.from(selected), [selected]),
    isSelected,
    toggle,
    selectAll,
    clear,
    setMany,
    count,
    allSelected,
    someSelected,
  }
}
