import { IconLoader2 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Sale, SalesAgentDirectoryEntry, SalesImportRowError } from '../../../types/portal'
import { POLICY_TYPES, SALE_STATUSES } from '../../../types/portal'

export interface PoliciesReviewTableProps {
  rows: Array<Partial<Sale>>
  confidence: Array<Record<string, number>>
  onRowChange: (rowIndex: number, field: keyof Sale, value: string | number | null) => void
  onConfirm: () => void
  onBack: () => void
  errors?: SalesImportRowError[]
  agents?: SalesAgentDirectoryEntry[]
  agentsLoading?: boolean
  isSubmitting?: boolean
  primaryActionLabel?: string
}

type EditableField =
  | 'agentId'
  | 'clientName'
  | 'policyNumber'
  | 'carrier'
  | 'policyType'
  | 'premium'
  | 'faceAmount'
  | 'status'

const COLUMNS: Array<{ field: EditableField; label: string }> = [
  { field: 'agentId', label: 'Writing Agent' },
  { field: 'clientName', label: 'Client Name' },
  { field: 'policyNumber', label: 'Policy #' },
  { field: 'carrier', label: 'Carrier' },
  { field: 'policyType', label: 'Policy Type' },
  { field: 'premium', label: 'Premium' },
  { field: 'faceAmount', label: 'Face Amount' },
  { field: 'status', label: 'Status' },
]

// Map a 0–1 score to a badge variant. Returns null below 0 (treat as missing).
function confidenceVariant(score: number): 'success' | 'warning' | 'destructive' | null {
  if (score >= 0.85) return 'success'
  if (score >= 0.6) return 'warning'
  if (score >= 0) return 'destructive'
  return null
}

function validateRows(
  rows: Array<Partial<Sale>>,
  agents: SalesAgentDirectoryEntry[],
): SalesImportRowError[] {
  const errors: SalesImportRowError[] = []
  const directoryAgentIds = new Set(agents.map((agent) => agent.agentId))
  rows.forEach((row, index) => {
    const rowNumber = index + 1
    const agentId = String(row.agentId ?? '').trim()
    if (!agentId) {
      errors.push({ row: rowNumber, field: 'agentId', message: 'Agent ID is required' })
    } else if (directoryAgentIds.size > 0 && !directoryAgentIds.has(agentId)) {
      errors.push({ row: rowNumber, field: 'agentId', message: 'Choose an agent from the sales directory' })
    }
    if (!String(row.clientName ?? '').trim()) {
      errors.push({ row: rowNumber, field: 'clientName', message: 'Client name is required' })
    }
    if (!String(row.policyType ?? '').trim()) {
      errors.push({ row: rowNumber, field: 'policyType', message: 'Policy type is required' })
    }
    if (!String(row.carrier ?? '').trim()) {
      errors.push({ row: rowNumber, field: 'carrier', message: 'Carrier is required' })
    }
    if (typeof row.premium !== 'number' || row.premium <= 0) {
      errors.push({ row: rowNumber, field: 'premium', message: 'Premium must be greater than 0' })
    }
  })
  return errors
}

function fieldErrors(
  errors: SalesImportRowError[],
  rowIndex: number,
  field: EditableField,
): string[] {
  const rowNumber = rowIndex + 1
  return errors
    .filter((error) => error.row === rowNumber && error.field === field)
    .map((error) => error.message)
}

function ConfidenceBadge({ score }: { score: number | undefined }) {
  if (score === undefined) return null
  const variant = confidenceVariant(score)
  if (!variant) return null
  return (
    <Badge
      variant={variant}
      className="absolute top-1 right-1 px-1.5 py-0 text-[10px] leading-4 pointer-events-none"
    >
      {Math.round(score * 100)}%
    </Badge>
  )
}

export default function PoliciesReviewTable({
  rows,
  confidence,
  onRowChange,
  onConfirm,
  onBack,
  errors: backendErrors = [],
  agents = [],
  agentsLoading = false,
  isSubmitting = false,
  primaryActionLabel,
}: PoliciesReviewTableProps) {
  const label = primaryActionLabel ?? `Confirm Import (${rows.length})`
  const validationErrors = [...validateRows(rows, agents), ...backendErrors]
  const hasErrors = validationErrors.length > 0

  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1">
      <p className="text-sm text-muted-foreground">
        Reviewing {rows.length} policies. Edit any cell before confirming. Yellow/red badges flag
        low-confidence fields.
      </p>
      {hasErrors ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          Fix {validationErrors.length} field {validationErrors.length === 1 ? 'error' : 'errors'} before importing.
        </div>
      ) : null}

      <div className="flex-1 overflow-auto rounded-lg border border-border/50 bg-card/30">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
            <TableRow className="hover:bg-transparent">
              {COLUMNS.map((c) => (
                <TableHead key={c.field} className="whitespace-nowrap">
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIndex) => {
              const rowConf = confidence[rowIndex] ?? {}
              return (
                <TableRow key={rowIndex}>
                  {COLUMNS.map((col) => {
                    const field = col.field
                    const score = rowConf[field]
                    const rawValue = row[field]
                    const messages = fieldErrors(validationErrors, rowIndex, field)

                    if (field === 'agentId') {
                      const current = typeof rawValue === 'string' ? rawValue : ''
                      const known = agents.some((agent) => agent.agentId === current)
                      return (
                        <TableCell key={field} className="align-top min-w-[180px]">
                          <div className="relative">
                            <Select
                              value={current || undefined}
                              onValueChange={(v) => onRowChange(rowIndex, field, v)}
                            >
                              <SelectTrigger className="h-8 text-xs pr-10">
                                <SelectValue placeholder={agentsLoading ? 'Loading agents...' : 'Select agent'} />
                              </SelectTrigger>
                              <SelectContent>
                                {agents.map((agent) => (
                                  <SelectItem key={agent.agentId} value={agent.agentId}>
                                    {agent.displayName || agent.email || agent.agentId.slice(0, 8)}
                                  </SelectItem>
                                ))}
                                {current && !known ? (
                                  <SelectItem value={current}>
                                    Unknown agent: {current.slice(0, 12)}
                                  </SelectItem>
                                ) : null}
                              </SelectContent>
                            </Select>
                            <ConfidenceBadge score={score} />
                          </div>
                          {messages.map((message) => (
                            <p key={message} className="mt-1 text-[11px] text-red-400">{message}</p>
                          ))}
                        </TableCell>
                      )
                    }

                    if (field === 'policyType') {
                      const current = typeof rawValue === 'string' ? rawValue : ''
                      return (
                        <TableCell key={field} className="align-top">
                          <div className="relative">
                            <Select
                              value={current}
                              onValueChange={(v) => onRowChange(rowIndex, field, v)}
                            >
                              <SelectTrigger className="h-8 text-xs pr-10">
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                {POLICY_TYPES.map((t) => (
                                  <SelectItem key={t} value={t}>
                                    {t.replace(/_/g, ' ')}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <ConfidenceBadge score={score} />
                          </div>
                          {messages.map((message) => (
                            <p key={message} className="mt-1 text-[11px] text-red-400">{message}</p>
                          ))}
                        </TableCell>
                      )
                    }

                    if (field === 'status') {
                      const current = typeof rawValue === 'string' ? rawValue : ''
                      return (
                        <TableCell key={field} className="align-top">
                          <div className="relative">
                            <Select
                              value={current}
                              onValueChange={(v) => onRowChange(rowIndex, field, v)}
                            >
                              <SelectTrigger className="h-8 text-xs pr-10">
                                <SelectValue placeholder="—" />
                              </SelectTrigger>
                              <SelectContent>
                                {SALE_STATUSES.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <ConfidenceBadge score={score} />
                          </div>
                          {messages.map((message) => (
                            <p key={message} className="mt-1 text-[11px] text-red-400">{message}</p>
                          ))}
                        </TableCell>
                      )
                    }

                    const isNumeric = field === 'premium' || field === 'faceAmount'
                    const inputValue =
                      rawValue === null || rawValue === undefined ? '' : String(rawValue)

                    return (
                      <TableCell key={field} className="align-top">
                        <div className="relative">
                          <Input
                            type={isNumeric ? 'number' : 'text'}
                            value={inputValue}
                            onChange={(e) => {
                              if (isNumeric) {
                                const v = e.target.value
                                onRowChange(
                                  rowIndex,
                                  field,
                                  v === '' ? null : Number(v),
                                )
                              } else {
                                onRowChange(rowIndex, field, e.target.value)
                              }
                            }}
                            className="h-8 text-xs pr-12"
                          />
                          <ConfidenceBadge score={score} />
                        </div>
                        {messages.map((message) => (
                          <p key={message} className="mt-1 text-[11px] text-red-400">{message}</p>
                        ))}
                      </TableCell>
                    )
                  })}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" onClick={onBack} disabled={isSubmitting}>
          Back
        </Button>
        <Button variant="default" onClick={onConfirm} disabled={isSubmitting || rows.length === 0 || hasErrors}>
          {isSubmitting ? (
            <>
              <IconLoader2 className="animate-spin mr-1.5" size={14} />
              Importing…
            </>
          ) : (
            label
          )}
        </Button>
      </div>
    </div>
  )
}
