import type { Sale } from '@/types/portal'

const PAYMENT_MULTIPLIERS: Record<string, number> = {
  monthly: 12,
  quarterly: 4,
  'semi-annual': 2,
  annual: 1,
}

function getPaymentMultiplier(mode: string | null | undefined): number {
  return PAYMENT_MULTIPLIERS[mode ?? ''] ?? 12
}

export function getAnnualizedPremium(sale: Sale): number {
  return sale.premium * getPaymentMultiplier(sale.paymentMode)
}

export function getMonthlyPremium(sale: Sale): number {
  return getAnnualizedPremium(sale) / 12
}
