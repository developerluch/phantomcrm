import type { ChartConfig } from '@/components/ui/chart'

export function getStatusGroup(status: string): string {
  const s = status.toLowerCase()
  if (['issued'].includes(s)) return 'issued'
  if (['paid', 'placed', 'active'].includes(s)) return 'active'
  if (['submitted', 'approved', 'applied', 'pending'].includes(s)) return 'pending'
  return 'cancelled'
}

export const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  issued: '#3b82f6',
  pending: '#f59e0b',
  cancelled: '#ef4444',
}

export const apTimeConfig = {
  premium: { label: 'Annual Premium', color: '#7DD3FC' },
} satisfies ChartConfig

export const statusConfig = {
  active: { label: 'Active/Placed', color: '#22c55e' },
  pending: { label: 'Pending', color: '#f59e0b' },
  cancelled: { label: 'Cancelled', color: '#ef4444' },
  issued: { label: 'Issued', color: '#3b82f6' },
} satisfies ChartConfig

export const carrierConfig = {
  premium: { label: 'Annual Premium', color: '#7DD3FC' },
} satisfies ChartConfig
