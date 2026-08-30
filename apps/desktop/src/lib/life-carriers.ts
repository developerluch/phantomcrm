export const LIFE_LEAD_SOURCES = [
  'Go Leads',
  'Hall of Fame',
  'Self-Generated',
  'Facebook',
  'HDFB',
  'Call X',
  'Other',
] as const

export const LIFE_CARRIER_PRODUCTS: Record<string, string[]> = {
  'Americo': [
    'Eagle Select I NS',
    'Eagle Select I SM',
    'Eagle Select II NS',
    'Eagle Select II SM',
    'Instant Decision IUL NS',
    'Term 100 15yr FG',
    'Term 100 30yr FG',
    'Term 125 15yr FG',
    'Term 125 20yr FG',
  ],
  'Transamerica': [
    'Trendsetter LB - Term Life',
    'FE Express Solution',
  ],
  'Mutual of Omaha': [
    'Income Advantage IUL',
    'Living Promise (Guaranteed Issue Whole Life)',
  ],
  'National Life Group': [
    'Life + Living Benefits IUL',
    'LSW FlexLife',
  ],
  'Protective Life': [
    'Classic Choice Term',
    'Classic Choice Whole Life',
  ],
  'North American (Sammons)': [
    'Builder Plus IUL 3',
    'Custom Guarantee UL',
  ],
  'Lincoln Financial': [
    'WealthAccumulate 2 IUL',
    'TermAccel Term Life',
  ],
  'Globe Life': [
    'Final Expense Whole Life',
  ],
  'Gerber Life': [
    'Gerber Grow-Up Plan',
    'Gerber Guaranteed Life',
  ],
  'Columbian Financial': [
    'Column 10',
    'Column 20',
  ],
}

export const LIFE_CARRIERS = Object.keys(LIFE_CARRIER_PRODUCTS)
