import { z } from 'zod'

export const createRecruitSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  phone: z.string().regex(/^\+?[\d\s()-]{7,}$/, 'Invalid phone number').or(z.literal('')).optional(),
  city: z.string().optional(),
  source: z.string().optional(),
})

export type CreateRecruitFormData = z.infer<typeof createRecruitSchema>

export const createSaleSchema = z.object({
  agentId: z.string().trim().optional(),
  clientName: z.string().min(1, 'Client name is required'),
  policyType: z.string().min(1, 'Policy type is required'),
  carrier: z.string().min(1, 'Carrier is required'),
  premium: z.coerce.number().positive('Premium must be positive'),
  commissionRate: z.coerce.number().min(0, 'Commission rate must be 0 or higher').max(200, 'Commission rate must be 200% or lower').optional(),
  status: z.string().optional(),
  policyNumber: z.string().optional(),
  notes: z.string().optional(),
  clientDOB: z.string().optional(),
  clientAddress: z.string().optional(),
  clientPhone: z.string().optional(),
  clientEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  faceAmount: z.coerce.number().positive().optional().or(z.literal(0)),
  paymentMode: z.string().optional(),
  transcript: z.string().optional(),
  productName: z.string().optional(),
  leadSource: z.string().optional(),
  payorName: z.string().optional(),
  payorRelationship: z.string().optional(),
  payorPhone: z.string().optional(),
  payorAddress: z.string().optional(),
  ownerName: z.string().optional(),
  ownerRelationship: z.string().optional(),
  commissionSplits: z.array(z.object({
    agentId: z.string().trim().optional(),
    percentage: z.coerce.number().min(0, 'Split must be 0% or higher').max(100, 'Split cannot exceed 100%'),
  })).optional(),
}).superRefine((data, ctx) => {
  if (!data.commissionSplits?.length) return
  const total = data.commissionSplits.reduce((sum, split) => sum + Number(split.percentage || 0), 0)
  if (Math.abs(total - 100) > 0.001) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Commission splits must total exactly 100%',
      path: ['commissionSplits'],
    })
  }
  data.commissionSplits.forEach((split, index) => {
    if (index === 0) return
    if (Number(split.percentage || 0) > 0 && !split.agentId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Agent ID is required for additional split agents',
        path: ['commissionSplits', index, 'agentId'],
      })
    }
  })
})

export type CreateSaleFormData = z.infer<typeof createSaleSchema>

export const SALE_WIZARD_FIELDS: Record<number, (keyof CreateSaleFormData)[]> = {
  1: ['clientName'],
  2: ['clientAddress', 'clientEmail'],
  3: ['policyType', 'carrier', 'premium'],
  4: ['commissionRate', 'commissionSplits', 'leadSource', 'notes'],
}

export const createLicenseSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
  state: z.string().length(2, 'State must be a 2-letter code'),
  licenseNumber: z.string().min(1, 'License number is required'),
  npn: z.string().optional(),
  licenseType: z.string().optional(),
  isResident: z.boolean().optional(),
  issueDate: z.string().optional(),
  expirationDate: z.string().optional(),
  ceRequired: z.coerce.number().int().min(0).optional(),
  ceDueDate: z.string().optional(),
  notes: z.string().optional(),
  linesOfAuthority: z.array(z.string()).optional(),
})

export type CreateLicenseFormData = z.infer<typeof createLicenseSchema>

export const createAppointmentSchema = z.object({
  carrier: z.string().min(1, 'Carrier is required'),
  writingNumber: z.string().optional(),
  appointedOn: z.string().optional(),
  terminatedOn: z.string().optional(),
})

export type CreateAppointmentFormData = z.infer<typeof createAppointmentSchema>

export const registerSchema = z.object({
  displayName: z.string().min(1, 'Display name is required'),
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).superRefine((data, ctx) => {
  if (data.password !== data.confirmPassword) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Passwords do not match',
      path: ['confirmPassword'],
    })
  }
})

export type RegisterFormData = z.infer<typeof registerSchema>

export const bugReportSchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters'),
  severity: z.enum(['low', 'medium', 'high', 'critical'], { required_error: 'Severity is required' }),
})

export type BugReportFormData = z.infer<typeof bugReportSchema>

export const createExpenseSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  description: z.string().min(1, 'Description is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  expenseDate: z.string().optional(),
  agentDiscordId: z.string().optional(),
  receiptUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
})

export type CreateExpenseFormData = z.infer<typeof createExpenseSchema>
