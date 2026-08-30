import type { FilterRule, SmartListFilter } from '../types/portal'

/**
 * Canonical, order-insensitive string hash of a filter tree.
 *
 * Motivation: naïve JSON.stringify(filter) cache-misses on equivalent filters
 * whose keys happen to serialize in different orders — e.g. {field, op, value}
 * vs {op, field, value}. Every React Query key that embeds a filter MUST use
 * this helper so shared filters share cache entries.
 *
 * Arrays preserve order (semantic — a group's rule order may matter for
 * short-circuit behaviour), objects sort keys.
 */
export function hashFilter(node: SmartListFilter | FilterRule | null | undefined): string {
  if (node == null) return ''
  return stableStringify(node)
}

function stableStringify(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v !== 'object') return JSON.stringify(v)
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']'
  const obj = v as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') +
    '}'
  )
}
