import type { Sale } from '../../types/portal'

export const KNOWN_CARRIERS: readonly string[] = [
  'Mutual of Omaha',
  'Americo',
  'Foresters Financial',
  'Ameritas',
  'AIG',
  'Transamerica',
  'Aetna',
  'Gerber Life',
  'Liberty Bankers',
  'Prosperity Life',
  'Royal Neighbors',
  'Sentinel Security Life',
  'Trinity Life',
] as const

export const MOCK_SALES: Sale[] = [
  {
    id: 'sale-mock-001',
    agentId: 'agent-mock-1',
    clientName: 'Eleanor Whitaker',
    policyType: 'Final Expense',
    carrier: 'Mutual of Omaha',
    premium: 49.5,
    commission: 425.0,
    status: 'issued',
    submittedAt: '2025-11-18T14:22:00Z',
    approvedAt: '2025-11-20T09:15:00Z',
    issuedAt: '2025-11-22T16:40:00Z',
    paidAt: null,
    policyNumber: 'POL-A18345',
    notes: 'Spouse may convert in Q2.',
    clientDOB: '1955-03-14',
    clientAddress: '128 Oakridge Ln, Tulsa, OK 74104',
    clientPhone: '(555) 123-4567',
    clientEmail: 'eleanor.w@example.com',
    faceAmount: 15000,
    paymentMode: 'monthly',
    transcript: null,
    productName: 'Living Promise',
    insuredName: 'Eleanor Whitaker',
    postcardSentAt: null,
    createdAt: '2025-11-18T14:22:00Z',
    updatedAt: '2025-11-22T16:40:00Z',
    agentFirstName: 'Dana',
    agentLastName: 'Reyes',
  },
  {
    id: 'sale-mock-002',
    agentId: 'agent-mock-2',
    clientName: 'Marcus Holloway',
    policyType: 'Term Life',
    carrier: 'Americo',
    premium: 72.0,
    commission: 540.0,
    status: 'issued',
    submittedAt: '2025-12-03T11:05:00Z',
    approvedAt: '2025-12-05T10:00:00Z',
    issuedAt: '2025-12-08T13:30:00Z',
    paidAt: null,
    policyNumber: 'POL-B22901',
    notes: '20-year term, smoker rate.',
    clientDOB: '1978-08-22',
    clientAddress: '4502 Birch St, Phoenix, AZ 85013',
    clientPhone: '(555) 234-5678',
    clientEmail: 'marcus.h@example.com',
    faceAmount: 250000,
    paymentMode: 'monthly',
    transcript: null,
    productName: 'Continuous Term',
    insuredName: 'Marcus Holloway',
    postcardSentAt: null,
    createdAt: '2025-12-03T11:05:00Z',
    updatedAt: '2025-12-08T13:30:00Z',
    agentFirstName: 'Sam',
    agentLastName: 'Park',
  },
  {
    id: 'sale-mock-003',
    agentId: 'agent-mock-1',
    clientName: 'Priya Ramachandran',
    policyType: 'Indexed Universal Life',
    carrier: 'Foresters Financial',
    premium: 285.0,
    commission: 1820.0,
    status: 'approved',
    submittedAt: '2026-01-09T15:48:00Z',
    approvedAt: '2026-01-14T11:20:00Z',
    issuedAt: null,
    paidAt: null,
    policyNumber: 'POL-C30188',
    notes: 'Waiting on first premium ACH.',
    clientDOB: '1981-04-19',
    clientAddress: '7100 Spring Park Dr, Plano, TX 75024',
    clientPhone: '(555) 345-6789',
    clientEmail: 'priya.r@example.com',
    faceAmount: 500000,
    paymentMode: 'monthly',
    transcript: null,
    productName: 'Advantage Plus IUL',
    insuredName: 'Priya Ramachandran',
    postcardSentAt: null,
    createdAt: '2026-01-09T15:48:00Z',
    updatedAt: '2026-01-14T11:20:00Z',
    agentFirstName: 'Dana',
    agentLastName: 'Reyes',
  },
  {
    id: 'sale-mock-004',
    agentId: 'agent-mock-2',
    clientName: 'Helena Cortez',
    policyType: 'Whole Life',
    carrier: 'Ameritas',
    premium: 145.0,
    commission: 980.0,
    status: 'paid',
    submittedAt: '2025-12-22T09:10:00Z',
    approvedAt: '2025-12-27T14:00:00Z',
    issuedAt: '2026-01-04T12:00:00Z',
    paidAt: '2026-02-02T17:35:00Z',
    policyNumber: 'POL-D41702',
    notes: 'Paid in full first month.',
    clientDOB: '1963-11-09',
    clientAddress: '15 Marina Vista, Long Beach, CA 90803',
    clientPhone: '(555) 456-7890',
    clientEmail: 'helena.c@example.com',
    faceAmount: 100000,
    paymentMode: 'monthly',
    transcript: null,
    productName: 'Heritage Whole Life',
    insuredName: 'Helena Cortez',
    postcardSentAt: null,
    createdAt: '2025-12-22T09:10:00Z',
    updatedAt: '2026-02-02T17:35:00Z',
    agentFirstName: 'Sam',
    agentLastName: 'Park',
  },
  {
    id: 'sale-mock-005',
    agentId: 'agent-mock-1',
    clientName: 'Theodore Fenwick',
    policyType: 'Final Expense',
    carrier: 'AIG',
    premium: 35.75,
    commission: 290.0,
    status: 'submitted',
    submittedAt: '2026-04-11T13:18:00Z',
    approvedAt: null,
    issuedAt: null,
    paidAt: null,
    policyNumber: 'POL-E55013',
    notes: null,
    clientDOB: '1949-06-30',
    clientAddress: '88 Lakeshore Cir, Akron, OH 44312',
    clientPhone: '(555) 567-8901',
    clientEmail: 'ted.fenwick@example.com',
    faceAmount: 10000,
    paymentMode: 'monthly',
    transcript: null,
    productName: 'Guaranteed Issue',
    insuredName: 'Theodore Fenwick',
    postcardSentAt: null,
    createdAt: '2026-04-11T13:18:00Z',
    updatedAt: '2026-04-11T13:18:00Z',
    agentFirstName: 'Dana',
    agentLastName: 'Reyes',
  },
  {
    id: 'sale-mock-006',
    agentId: 'agent-mock-2',
    clientName: 'Imani Brooks',
    policyType: 'Term Life',
    carrier: 'Transamerica',
    premium: 88.0,
    commission: 720.0,
    status: 'issued',
    submittedAt: '2026-02-14T10:30:00Z',
    approvedAt: '2026-02-17T15:00:00Z',
    issuedAt: '2026-02-21T11:45:00Z',
    paidAt: null,
    policyNumber: 'POL-F60284',
    notes: '15-year term, preferred plus.',
    clientDOB: '1985-09-02',
    clientAddress: '233 Northgate Ave, Atlanta, GA 30309',
    clientPhone: '(555) 678-9012',
    clientEmail: 'imani.b@example.com',
    faceAmount: 350000,
    paymentMode: 'monthly',
    transcript: null,
    productName: 'Trendsetter Super',
    insuredName: 'Imani Brooks',
    postcardSentAt: null,
    createdAt: '2026-02-14T10:30:00Z',
    updatedAt: '2026-02-21T11:45:00Z',
    agentFirstName: 'Sam',
    agentLastName: 'Park',
  },
  {
    id: 'sale-mock-007',
    agentId: 'agent-mock-1',
    clientName: 'Roland Pham',
    policyType: 'Indexed Universal Life',
    carrier: 'Aetna',
    premium: 420.0,
    commission: 2640.0,
    status: 'approved',
    submittedAt: '2026-03-05T08:42:00Z',
    approvedAt: '2026-03-12T16:10:00Z',
    issuedAt: null,
    paidAt: null,
    policyNumber: 'POL-G71495',
    notes: 'Pending med exam follow-up.',
    clientDOB: '1976-12-12',
    clientAddress: '910 Sunset Blvd, Boulder, CO 80302',
    clientPhone: '(555) 789-0123',
    clientEmail: 'roland.p@example.com',
    faceAmount: 500000,
    paymentMode: 'monthly',
    transcript: null,
    productName: 'Stratos IUL',
    insuredName: 'Roland Pham',
    postcardSentAt: null,
    createdAt: '2026-03-05T08:42:00Z',
    updatedAt: '2026-03-12T16:10:00Z',
    agentFirstName: 'Dana',
    agentLastName: 'Reyes',
  },
  {
    id: 'sale-mock-008',
    agentId: 'agent-mock-2',
    clientName: 'Gretchen Albright',
    policyType: 'Whole Life',
    carrier: 'Gerber Life',
    premium: 56.25,
    commission: 410.0,
    status: 'issued',
    submittedAt: '2025-12-30T14:00:00Z',
    approvedAt: '2026-01-06T10:25:00Z',
    issuedAt: '2026-01-13T09:55:00Z',
    paidAt: null,
    policyNumber: 'POL-H88126',
    notes: null,
    clientDOB: '1957-02-26',
    clientAddress: '40 Maple Ridge Rd, Burlington, VT 05401',
    clientPhone: '(555) 890-1234',
    clientEmail: 'gretchen.a@example.com',
    faceAmount: 25000,
    paymentMode: 'monthly',
    transcript: null,
    productName: 'Grow-Up Plan',
    insuredName: 'Gretchen Albright',
    postcardSentAt: null,
    createdAt: '2025-12-30T14:00:00Z',
    updatedAt: '2026-01-13T09:55:00Z',
    agentFirstName: 'Sam',
    agentLastName: 'Park',
  },
  {
    id: 'sale-mock-009',
    agentId: 'agent-mock-1',
    clientName: 'Devon Castellano',
    policyType: 'Final Expense',
    carrier: 'Mutual of Omaha',
    premium: 64.0,
    commission: 480.0,
    status: 'submitted',
    submittedAt: '2026-04-28T16:55:00Z',
    approvedAt: null,
    issuedAt: null,
    paidAt: null,
    policyNumber: 'POL-I91044',
    notes: 'Recruit referral.',
    clientDOB: '1962-07-17',
    clientAddress: '212 Cedar Hill, Asheville, NC 28803',
    clientPhone: '(555) 901-2345',
    clientEmail: 'devon.c@example.com',
    faceAmount: 20000,
    paymentMode: 'monthly',
    transcript: null,
    productName: 'Living Promise',
    insuredName: 'Devon Castellano',
    postcardSentAt: null,
    createdAt: '2026-04-28T16:55:00Z',
    updatedAt: '2026-04-28T16:55:00Z',
    agentFirstName: 'Dana',
    agentLastName: 'Reyes',
  },
  {
    id: 'sale-mock-010',
    agentId: 'agent-mock-2',
    clientName: 'Sofia Lindqvist',
    policyType: 'Term Life',
    carrier: 'Americo',
    premium: 102.5,
    commission: 815.0,
    status: 'active',
    submittedAt: '2026-01-22T12:14:00Z',
    approvedAt: '2026-01-25T15:00:00Z',
    issuedAt: '2026-02-01T10:00:00Z',
    paidAt: '2026-03-01T10:00:00Z',
    policyNumber: 'POL-J10256',
    notes: null,
    clientDOB: '1972-10-08',
    clientAddress: '67 Pine Hollow Dr, Madison, WI 53703',
    clientPhone: '(555) 012-3456',
    clientEmail: 'sofia.l@example.com',
    faceAmount: 400000,
    paymentMode: 'monthly',
    transcript: null,
    productName: 'Continuous Term',
    insuredName: 'Sofia Lindqvist',
    postcardSentAt: null,
    createdAt: '2026-01-22T12:14:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
    agentFirstName: 'Sam',
    agentLastName: 'Park',
  },
  {
    id: 'sale-mock-011',
    agentId: 'agent-mock-1',
    clientName: 'Bertram Okafor',
    policyType: 'Whole Life',
    carrier: 'Ameritas',
    premium: 198.0,
    commission: 1320.0,
    status: 'cancelled',
    submittedAt: '2026-02-09T11:00:00Z',
    approvedAt: '2026-02-14T13:00:00Z',
    issuedAt: null,
    paidAt: null,
    policyNumber: 'POL-K12877',
    notes: 'Client cancelled before first draft.',
    clientDOB: '1969-05-21',
    clientAddress: '506 Greenway Ct, Charleston, SC 29403',
    clientPhone: '(555) 321-7654',
    clientEmail: 'bertram.o@example.com',
    faceAmount: 150000,
    paymentMode: 'monthly',
    transcript: null,
    productName: 'Heritage Whole Life',
    insuredName: 'Bertram Okafor',
    postcardSentAt: null,
    createdAt: '2026-02-09T11:00:00Z',
    updatedAt: '2026-02-20T08:45:00Z',
    agentFirstName: 'Dana',
    agentLastName: 'Reyes',
  },
  {
    id: 'sale-mock-012',
    agentId: 'agent-mock-2',
    clientName: 'Yvonne Beaumont',
    policyType: 'Final Expense',
    carrier: 'Foresters Financial',
    premium: 41.75,
    commission: 335.0,
    status: 'issued',
    submittedAt: '2026-03-19T15:25:00Z',
    approvedAt: '2026-03-22T14:00:00Z',
    issuedAt: '2026-03-28T11:30:00Z',
    paidAt: null,
    policyNumber: 'POL-L13990',
    notes: null,
    clientDOB: '1953-01-04',
    clientAddress: '19 Elmwood Pl, Providence, RI 02906',
    clientPhone: '(555) 654-3210',
    clientEmail: 'yvonne.b@example.com',
    faceAmount: 12500,
    paymentMode: 'monthly',
    transcript: null,
    productName: 'PlanRight FE',
    insuredName: 'Yvonne Beaumont',
    postcardSentAt: null,
    createdAt: '2026-03-19T15:25:00Z',
    updatedAt: '2026-03-28T11:30:00Z',
    agentFirstName: 'Sam',
    agentLastName: 'Park',
  },
]

const ACTIVE_ISH_STATUSES = new Set(['issued', 'paid', 'placed', 'active'])

export const MOCK_SALES_RESPONSE: {
  sales: Sale[]
  total: number
  totalPremium: number
  activeCount: number
} = {
  sales: MOCK_SALES,
  total: MOCK_SALES.length,
  totalPremium: MOCK_SALES.filter((s) => ACTIVE_ISH_STATUSES.has(s.status)).reduce(
    (sum, s) => sum + s.premium * 12,
    0,
  ),
  activeCount: MOCK_SALES.filter((s) => ACTIVE_ISH_STATUSES.has(s.status)).length,
}

// Module-level dedup ledger: tracks (policyNumber|clientName) keys already
// "imported" so repeat calls surface duplicates rather than silently growing
// the mock dataset.
const submittedKeys = new Set<string>()

function dedupKey(policyNumber: string, clientName: string): string {
  return `${policyNumber}|${clientName.toLowerCase()}`
}

export function mockBulkImportSales(sales: Array<Partial<Sale>>): {
  created: number
  skipped: number
  duplicates: Array<{ policyNumber: string; clientName: string }>
} {
  let created = 0
  let skipped = 0
  const duplicates: Array<{ policyNumber: string; clientName: string }> = []

  for (const sale of sales) {
    const policyNumber = (sale.policyNumber ?? '').trim()
    const clientName = (sale.clientName ?? '').trim()

    if (!policyNumber && !clientName) {
      created += 1
      continue
    }

    const key = dedupKey(policyNumber, clientName)
    if (submittedKeys.has(key)) {
      skipped += 1
      duplicates.push({ policyNumber, clientName })
      continue
    }

    submittedKeys.add(key)
    created += 1
  }

  return { created, skipped, duplicates }
}

export function resetMockBulkImportState(): void {
  submittedKeys.clear()
}

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function fuzzyMatchCarrier(raw: string): { value: string; confidence: number } {
  const rawNorm = normalizeForMatch(raw)
  if (!rawNorm) return { value: raw, confidence: 0.45 }

  for (const known of KNOWN_CARRIERS) {
    if (normalizeForMatch(known) === rawNorm) {
      return { value: known, confidence: 0.95 }
    }
  }

  if (rawNorm.length >= 4) {
    for (const known of KNOWN_CARRIERS) {
      const knownNorm = normalizeForMatch(known)
      if (knownNorm.startsWith(rawNorm)) {
        return { value: known, confidence: 0.78 }
      }
    }
    for (const known of KNOWN_CARRIERS) {
      const knownNorm = normalizeForMatch(known)
      if (knownNorm.includes(rawNorm)) {
        return { value: known, confidence: 0.78 }
      }
    }
  }

  return { value: raw, confidence: 0.45 }
}

function normalizePolicyType(raw: string): { value: string; normalized: boolean } {
  const trimmed = raw.trim()
  const upper = trimmed.toUpperCase()
  switch (upper) {
    case 'FE':
      return { value: 'Final Expense', normalized: true }
    case 'TERM':
      return { value: 'Term Life', normalized: true }
    case 'IUL':
      return { value: 'Indexed Universal Life', normalized: true }
    case 'WL':
      return { value: 'Whole Life', normalized: true }
    default:
      return { value: trimmed, normalized: false }
  }
}

function normalizeDate(raw: string): { value: string; parsed: boolean } {
  const trimmed = raw.trim()
  if (!trimmed) return { value: trimmed, parsed: false }

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed)
  if (iso) {
    const y = iso[1]
    const m = iso[2].padStart(2, '0')
    const d = iso[3].padStart(2, '0')
    return { value: `${y}-${m}-${d}`, parsed: true }
  }

  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(trimmed)
  if (slash) {
    let y = slash[3]
    const m = slash[1].padStart(2, '0')
    const d = slash[2].padStart(2, '0')
    if (y.length === 2) {
      const n = Number(y)
      y = n >= 30 ? `19${y}` : `20${y}`
    }
    return { value: `${y}-${m}-${d}`, parsed: true }
  }

  const dash = /^(\d{1,2})-(\d{1,2})-(\d{2,4})$/.exec(trimmed)
  if (dash) {
    let y = dash[3]
    const m = dash[1].padStart(2, '0')
    const d = dash[2].padStart(2, '0')
    if (y.length === 2) {
      const n = Number(y)
      y = n >= 30 ? `19${y}` : `20${y}`
    }
    return { value: `${y}-${m}-${d}`, parsed: true }
  }

  const monthNames: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  }
  const named = /^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})$/.exec(trimmed)
  if (named) {
    const monKey = named[1].slice(0, 3).toLowerCase()
    const mm = monthNames[monKey]
    if (mm) {
      let y = named[3]
      const d = named[2].padStart(2, '0')
      if (y.length === 2) {
        const n = Number(y)
        y = n >= 30 ? `19${y}` : `20${y}`
      }
      return { value: `${y}-${mm}-${d}`, parsed: true }
    }
  }

  const ts = Date.parse(trimmed)
  if (!Number.isNaN(ts)) {
    const dt = new Date(ts)
    const y = dt.getUTCFullYear().toString()
    const m = (dt.getUTCMonth() + 1).toString().padStart(2, '0')
    const d = dt.getUTCDate().toString().padStart(2, '0')
    return { value: `${y}-${m}-${d}`, parsed: true }
  }

  return { value: trimmed, parsed: false }
}

function normalizeMoney(raw: string): { value: number | null; parsed: boolean } {
  const trimmed = raw.trim()
  if (!trimmed) return { value: null, parsed: false }
  const stripped = trimmed.replace(/[$,]/g, '')
  const n = Number(stripped)
  if (Number.isNaN(n)) return { value: null, parsed: false }
  return { value: n, parsed: true }
}

function fieldKeyFor(header: string): keyof Sale | 'unknown' {
  const h = header.toLowerCase().trim()
  if (h.includes('client') && h.includes('name')) return 'clientName'
  if (h.includes('insured')) return 'insuredName'
  if (h.includes('policy') && (h.includes('#') || h.includes('num'))) return 'policyNumber'
  if (h.includes('carrier')) return 'carrier'
  if (h.includes('policy') && h.includes('type')) return 'policyType'
  if (h === 'product' || h.includes('product')) return 'productName'
  if (h.includes('dob') || h.includes('birth')) return 'clientDOB'
  if (h.includes('premium')) return 'premium'
  if (h.includes('face')) return 'faceAmount'
  if (h.includes('commission')) return 'commission'
  if (h.includes('phone')) return 'clientPhone'
  if (h.includes('email')) return 'clientEmail'
  if (h.includes('address')) return 'clientAddress'
  if (h.includes('status')) return 'status'
  if (h.includes('submit')) return 'submittedAt'
  if (h.includes('issue')) return 'issuedAt'
  if (h.includes('approve')) return 'approvedAt'
  if (h.includes('paid')) return 'paidAt'
  if (h.includes('payment') && h.includes('mode')) return 'paymentMode'
  if (h.includes('note')) return 'notes'
  return 'unknown'
}

export function mockParseCsvRows(rows: Array<Record<string, string>>): {
  rows: Array<Partial<Sale>>
  confidence: Array<Record<string, number>>
} {
  const parsedRows: Array<Partial<Sale>> = []
  const confidences: Array<Record<string, number>> = []

  for (const row of rows) {
    const out: Partial<Sale> = {}
    const conf: Record<string, number> = {}

    for (const [header, rawValue] of Object.entries(row)) {
      const field = fieldKeyFor(header)
      if (field === 'unknown') continue

      const value = (rawValue ?? '').trim()

      if (!value) {
        conf[field] = 0.45
        continue
      }

      switch (field) {
        case 'carrier': {
          const m = fuzzyMatchCarrier(value)
          out.carrier = m.value
          conf.carrier = m.confidence
          break
        }
        case 'policyType': {
          const n = normalizePolicyType(value)
          out.policyType = n.value
          conf.policyType = n.normalized ? 0.78 : 0.92
          break
        }
        case 'clientDOB': {
          const n = normalizeDate(value)
          out.clientDOB = n.value
          conf.clientDOB = n.parsed ? 0.92 : 0.45
          break
        }
        case 'submittedAt': {
          const n = normalizeDate(value)
          out.submittedAt = n.value
          conf.submittedAt = n.parsed ? 0.92 : 0.45
          break
        }
        case 'issuedAt': {
          const n = normalizeDate(value)
          out.issuedAt = n.value
          conf.issuedAt = n.parsed ? 0.92 : 0.45
          break
        }
        case 'approvedAt': {
          const n = normalizeDate(value)
          out.approvedAt = n.value
          conf.approvedAt = n.parsed ? 0.92 : 0.45
          break
        }
        case 'paidAt': {
          const n = normalizeDate(value)
          out.paidAt = n.value
          conf.paidAt = n.parsed ? 0.92 : 0.45
          break
        }
        case 'premium': {
          const n = normalizeMoney(value)
          if (n.value !== null) out.premium = n.value
          conf.premium = n.parsed ? 0.92 : 0.45
          break
        }
        case 'faceAmount': {
          const n = normalizeMoney(value)
          out.faceAmount = n.value
          conf.faceAmount = n.parsed ? 0.92 : 0.45
          break
        }
        case 'commission': {
          const n = normalizeMoney(value)
          out.commission = n.value
          conf.commission = n.parsed ? 0.92 : 0.45
          break
        }
        case 'clientName':
          out.clientName = value
          conf.clientName = 0.92
          break
        case 'insuredName':
          out.insuredName = value
          conf.insuredName = 0.92
          break
        case 'policyNumber':
          out.policyNumber = value
          conf.policyNumber = 0.92
          break
        case 'productName':
          out.productName = value
          conf.productName = 0.92
          break
        case 'clientPhone':
          out.clientPhone = value
          conf.clientPhone = 0.92
          break
        case 'clientEmail':
          out.clientEmail = value
          conf.clientEmail = 0.92
          break
        case 'clientAddress':
          out.clientAddress = value
          conf.clientAddress = 0.92
          break
        case 'status':
          out.status = value.toLowerCase()
          conf.status = 0.92
          break
        case 'paymentMode':
          out.paymentMode = value
          conf.paymentMode = 0.92
          break
        case 'notes':
          out.notes = value
          conf.notes = 0.92
          break
        default:
          break
      }
    }

    parsedRows.push(out)
    confidences.push(conf)
  }

  return { rows: parsedRows, confidence: confidences }
}

const MOCK_DOC_FIRST_NAMES = [
  'Henry', 'Margaret', 'Calvin', 'Rosalind', 'Antonio', 'Beatrice',
  'Desmond', 'Lillian', 'Otis', 'Florence', 'Walter', 'Cordelia',
]
const MOCK_DOC_LAST_NAMES = [
  'Ashford', 'Klein', 'Vasquez', 'Mbeki', 'Larsson', 'Nakamura',
  'Petrov', 'Goldberg', 'Quinones', 'Sutton', 'Halverson', 'Iqbal',
]
const MOCK_DOC_POLICY_TYPES = [
  'Final Expense',
  'Term Life',
  'Whole Life',
  'Indexed Universal Life',
]

function seedFromFilename(filename: string): number {
  const stem = filename.replace(/\.[^.]+$/, '')
  let seed = 0
  for (let i = 0; i < stem.length; i += 1) {
    seed = (seed * 31 + stem.charCodeAt(i)) >>> 0
  }
  return seed
}

export function mockParseDocument(filename: string): {
  fields: Partial<Sale>
  confidence: Record<string, number>
  raw_text_excerpt: string
} {
  const seed = seedFromFilename(filename || 'untitled.pdf')
  const first = MOCK_DOC_FIRST_NAMES[seed % MOCK_DOC_FIRST_NAMES.length]
  const last = MOCK_DOC_LAST_NAMES[(seed >>> 3) % MOCK_DOC_LAST_NAMES.length]
  const carrier = KNOWN_CARRIERS[(seed >>> 5) % KNOWN_CARRIERS.length]
  const policyType = MOCK_DOC_POLICY_TYPES[(seed >>> 7) % MOCK_DOC_POLICY_TYPES.length]

  const premium = 40 + ((seed >>> 2) % 360) + ((seed >>> 11) % 100) / 100
  const face = 10000 + (((seed >>> 4) % 50) * 10000)
  const birthYear = 1945 + ((seed >>> 6) % 45)
  const birthMonth = 1 + ((seed >>> 9) % 12)
  const birthDay = 1 + ((seed >>> 12) % 28)
  const submitYear = 2025 + ((seed >>> 13) % 2)
  const submitMonth = 1 + ((seed >>> 14) % 12)
  const submitDay = 1 + ((seed >>> 15) % 28)

  const policyNumber = `POL-DOC-${(seed % 1000000).toString().padStart(6, '0')}`
  const clientName = `${first} ${last}`
  const dob = `${birthYear}-${birthMonth.toString().padStart(2, '0')}-${birthDay.toString().padStart(2, '0')}`
  const submittedAt = `${submitYear}-${submitMonth.toString().padStart(2, '0')}-${submitDay.toString().padStart(2, '0')}`

  const fields: Partial<Sale> = {
    clientName,
    insuredName: clientName,
    policyNumber,
    carrier,
    policyType,
    premium: Math.round(premium * 100) / 100,
    faceAmount: face,
    clientDOB: dob,
    submittedAt,
    paymentMode: 'monthly',
    status: 'submitted',
  }

  const confidence: Record<string, number> = {
    clientName: 0.92,
    insuredName: 0.92,
    policyNumber: 0.92,
    carrier: 0.95,
    policyType: 0.78,
    premium: 0.92,
    faceAmount: 0.92,
    clientDOB: 0.92,
    submittedAt: 0.78,
    paymentMode: 0.45,
    status: 0.78,
  }

  const raw_text_excerpt =
    `APPLICATION FOR LIFE INSURANCE\n` +
    `Carrier: ${carrier}\n` +
    `Product: ${policyType}\n` +
    `Insured: ${clientName}     DOB: ${dob}\n` +
    `Policy #: ${policyNumber}\n` +
    `Face Amount: $${face.toLocaleString()}\n` +
    `Monthly Premium: $${fields.premium}\n` +
    `Application Date: ${submittedAt}\n` +
    `…(source: ${filename})`

  return { fields, confidence, raw_text_excerpt }
}
