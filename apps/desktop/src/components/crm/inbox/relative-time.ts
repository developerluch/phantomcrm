/** Compact relative-time formatter for message attribution rows.
 *  Returns 'now' / 'Nm ago' / 'Nh ago' / 'Nd ago' / a locale date for older
 *  timestamps. No date-fns dependency — the surface is small enough that
 *  rolling our own keeps the bundle lean. */
export function formatRelativeShort(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  const delta = Date.now() - t
  if (delta < 60_000) return 'now'
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`
  if (delta < 7 * 86_400_000) return `${Math.floor(delta / 86_400_000)}d ago`
  return new Date(t).toLocaleDateString()
}
