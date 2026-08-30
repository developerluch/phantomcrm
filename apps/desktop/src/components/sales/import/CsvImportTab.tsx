import { useState, useRef, useMemo, useCallback } from 'react'
import Papa from 'papaparse'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import {
  IconUpload,
  IconFileSpreadsheet,
  IconLoader2,
  IconArrowLeft,
  IconSparkles,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
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
import { cn } from '@/lib/utils'
import { getAccountAgentId } from '@/lib/agent-id'
import { ApiError, api } from '../../../services/api'
import { useAuthStore } from '../../../store'
import type { Sale, SalesAgentDirectoryEntry, SalesImportRowError } from '../../../types/portal'
import { suggestMapping, SALE_FIELD_LABELS } from './suggest-mapping'
import PoliciesReviewTable from './PoliciesReviewTable'

interface CsvImportTabProps {
  onClose: () => void
  agents: SalesAgentDirectoryEntry[]
  agentsLoading?: boolean
}

type Step = 1 | 2 | 3 | 4

type CsvRow = Record<string, string>

const STEP_LABELS: Record<Step, string> = {
  1: 'Upload',
  2: 'Map columns',
  3: 'Cleanup',
  4: 'Review',
}

// Build a remapped row by walking the CSV row through the user's mapping.
// Numeric/date coercion is deferred to the AI step (or skipped when AI is off).
function applyMapping(
  csvRow: CsvRow,
  mapping: Record<string, keyof Sale | null>,
): Partial<Sale> {
  const out: Partial<Sale> = {}
  for (const [header, value] of Object.entries(csvRow)) {
    const field = mapping[header]
    if (!field) continue
    const trimmed = (value ?? '').trim()
    if (!trimmed) continue

    if (field === 'premium' || field === 'faceAmount' || field === 'commission') {
      const n = Number(trimmed.replace(/[$,]/g, ''))
      if (!Number.isNaN(n)) {
        // Numeric coercion at this stage keeps the review table's number inputs happy.
        ;(out as Record<string, unknown>)[field] = n
      }
    } else {
      ;(out as Record<string, unknown>)[field] = trimmed
    }
  }
  return out
}

function StepDots({ step }: { step: Step }) {
  const stepKeys: Step[] = [1, 2, 3, 4]
  return (
    <div className="flex items-center gap-2">
      {stepKeys.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-colors',
              s === step
                ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-300/40'
                : s < step
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-muted/40 text-muted-foreground',
            )}
          >
            {s}
          </div>
          <span
            className={cn(
              'text-xs',
              s === step ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {STEP_LABELS[s]}
          </span>
          {i < stepKeys.length - 1 ? (
            <div className="h-px w-6 bg-border/60" />
          ) : null}
        </div>
      ))}
    </div>
  )
}

export default function CsvImportTab({ onClose, agents, agentsLoading = false }: CsvImportTabProps) {
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const accountAgentId = getAccountAgentId(user)
  const defaultAgentId =
    accountAgentId || agents.find((agent) => agent.isCurrentUser)?.agentId || ''

  const [step, setStep] = useState<Step>(1)
  const [fileName, setFileName] = useState('')
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [mapping, setMapping] = useState<Record<string, keyof Sale | null>>({})
  const [useAiCleanup, setUseAiCleanup] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [reviewRows, setReviewRows] = useState<Array<Partial<Sale>>>([])
  const [reviewConfidence, setReviewConfidence] = useState<Array<Record<string, number>>>([])
  const [reviewErrors, setReviewErrors] = useState<SalesImportRowError[]>([])
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fieldOptions = useMemo(
    () =>
      (Object.keys(SALE_FIELD_LABELS) as Array<keyof typeof SALE_FIELD_LABELS>).map((k) => ({
        value: k as keyof Sale,
        label: SALE_FIELD_LABELS[k],
      })),
    [],
  )

  const ingestCsvText = useCallback((text: string, name: string) => {
    const parsed = Papa.parse<CsvRow>(text, {
      header: true,
      skipEmptyLines: true,
    })
    if (parsed.errors.length > 0) {
      toast.error(`Failed to parse CSV: ${parsed.errors[0].message}`)
      return
    }
    const data = (parsed.data ?? []).filter(
      (r) => r && typeof r === 'object' && Object.keys(r).length > 0,
    )
    if (data.length === 0) {
      toast.error('No rows found in CSV.')
      return
    }
    const headers = parsed.meta.fields ?? Object.keys(data[0])
    setFileName(name)
    setCsvHeaders(headers)
    setCsvRows(data)
    setMapping(suggestMapping(headers))
    setStep(2)
  }, [])

  const handleFileSelected = useCallback(
    (file: File | null | undefined) => {
      if (!file) return
      const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv'
      if (!isCsv) {
        toast.error('Please drop a .csv file.')
        return
      }
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = (e.target?.result as string) ?? ''
        ingestCsvText(text, file.name)
      }
      reader.onerror = () => toast.error('Could not read the file.')
      reader.readAsText(file)
    },
    [ingestCsvText],
  )

  const handleSampleCsv = useCallback(async () => {
    try {
      const res = await fetch('/sample-policies.csv')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      ingestCsvText(text, 'sample-policies.csv')
    } catch (err) {
      toast.error(`Could not load sample CSV: ${(err as Error).message}`)
    }
  }, [ingestCsvText])

  const handleAdvanceToReview = useCallback(async () => {
    setReviewErrors([])
    const remapped = csvRows.map((row) => ({
      ...(defaultAgentId ? { agentId: defaultAgentId } : {}),
      ...applyMapping(row, mapping),
    }))
    if (!useAiCleanup) {
      setReviewRows(remapped)
      setReviewConfidence(remapped.map(() => ({})))
      setStep(4)
      return
    }
    setParsing(true)
    try {
      // AI cleanup uses the raw mapped values (header keys = original CSV headers),
      // so feed the parser the un-coerced row dictionary keyed by ORIGINAL headers.
      // Mock + real backend both expect Record<string,string> input shaped like CSV.
      const result = await api.parseSalesCsvRows(csvRows)
      const aiRows = result.rows
      const aiConfidence = result.confidence
      // Drop unmapped fields from aiRows to honor the user's column choices.
      const mappedFields = new Set(
        Object.values(mapping).filter((v): v is keyof Sale => v !== null),
      )
      const cleaned = aiRows.map((r) => {
        const out: Partial<Sale> = {}
        for (const [k, v] of Object.entries(r)) {
          if (k === 'agentId' || mappedFields.has(k as keyof Sale)) {
            ;(out as Record<string, unknown>)[k] = v
          }
        }
        if (!out.agentId && defaultAgentId) out.agentId = defaultAgentId
        return out
      })
      setReviewRows(cleaned)
      setReviewConfidence(aiConfidence)
      setStep(4)
    } catch (err) {
      toast.error(`AI normalization failed: ${(err as Error).message}`)
    } finally {
      setParsing(false)
    }
  }, [csvRows, defaultAgentId, mapping, useAiCleanup])

  const editRow = useCallback(
    (rowIndex: number, field: keyof Sale, value: string | number | null) => {
      setReviewRows((prev) => {
        const next = prev.slice()
        const current = { ...(next[rowIndex] ?? {}) }
        if (value === null || value === '') {
          delete (current as Record<string, unknown>)[field]
        } else {
          ;(current as Record<string, unknown>)[field] = value
        }
        next[rowIndex] = current
        return next
      })
      setReviewErrors((prev) =>
        prev.filter((error) => error.row !== rowIndex + 1 || error.field !== field),
      )
    },
    [],
  )

  const handleConfirm = useCallback(async () => {
    setImporting(true)
    try {
      const result = await api.bulkImportSales(reviewRows)
      const dupMsg =
        result.skipped > 0 ? ` (${result.skipped} duplicates skipped)` : ''
      toast.success(`Imported ${result.created} policies${dupMsg}`)
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      onClose()
    } catch (err) {
      const rowErrors = extractSalesImportRowErrors(err)
      if (rowErrors.length > 0) {
        setReviewErrors(rowErrors)
        toast.error('Fix the highlighted row errors and try again.')
        return
      }
      toast.error(`Import failed: ${(err as Error).message}`)
    } finally {
      setImporting(false)
    }
  }, [reviewRows, queryClient, onClose])

  const previewRows = useMemo(() => csvRows.slice(0, 3), [csvRows])

  return (
    <div className="flex flex-col gap-4 min-h-0 flex-1">
      <StepDots step={step} />

      {step === 1 ? (
        <div className="flex flex-col gap-3">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const file = e.dataTransfer.files?.[0]
              handleFileSelected(file)
            }}
            className={cn(
              'h-48 rounded-lg border border-dashed flex flex-col items-center justify-center gap-3 transition-colors',
              dragOver
                ? 'border-sky-300 bg-sky-500/5'
                : 'border-border/60 bg-card/30',
            )}
          >
            <IconFileSpreadsheet size={32} className="text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              Drop a .csv file here, or
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={(e) => handleFileSelected(e.target.files?.[0])}
              className="hidden"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5"
              >
                <IconUpload size={14} />
                Browse files
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSampleCsv}>
                Use sample CSV
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            We auto-detect columns like Client Name, Policy #, Carrier, DOB, Premium, and Face
            Amount. You'll get a chance to remap any header on the next step.
          </p>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4 min-h-0">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <span className="font-medium">{fileName}</span>
              <span className="text-muted-foreground"> · {csvRows.length} rows</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep(1)
                setCsvRows([])
                setCsvHeaders([])
                setMapping({})
                setFileName('')
              }}
              className="gap-1.5"
            >
              <IconArrowLeft size={14} />
              Back
            </Button>
          </div>

          {previewRows.length > 0 ? (
            <div className="rounded-lg border border-border/50 overflow-auto max-h-40 bg-card/30">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {csvHeaders.map((h) => (
                      <TableHead key={h} className="whitespace-nowrap text-xs">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i}>
                      {csvHeaders.map((h) => (
                        <TableCell key={h} className="text-xs text-muted-foreground">
                          {row[h] ?? ''}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}

          <div className="rounded-lg border border-border/50 bg-card/30 p-3">
            <p className="text-xs text-muted-foreground mb-3">
              Map each CSV column to a policy field. Choose "(skip)" to ignore a column.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {csvHeaders.map((header) => {
                const current = mapping[header] ?? '__skip__'
                return (
                  <div
                    key={header}
                    className="flex items-center gap-2 rounded-md bg-card/40 px-2 py-1.5"
                  >
                    <span className="text-xs font-medium truncate flex-1">{header}</span>
                    <Select
                      value={current as string}
                      onValueChange={(v) =>
                        setMapping((prev) => ({
                          ...prev,
                          [header]: v === '__skip__' ? null : (v as keyof Sale),
                        }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__skip__">(skip)</SelectItem>
                        {fieldOptions.map((opt) => (
                          <SelectItem key={opt.value as string} value={opt.value as string}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="default" onClick={() => setStep(3)}>
              Continue
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep(2)}
              className="gap-1.5"
            >
              <IconArrowLeft size={14} />
              Back
            </Button>
          </div>

          <div className="rounded-lg border border-border/50 bg-card/30 p-4">
            <div className="flex items-start gap-3">
              <IconSparkles size={18} className="text-sky-300 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-sm">
                    Use AI to normalize values (recommended)
                  </div>
                  <Switch checked={useAiCleanup} onCheckedChange={setUseAiCleanup} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Fuzzy-matches carrier names, expands policy-type abbreviations (FE → Final
                  Expense, IUL → Indexed Universal Life, …), and normalizes date formats to ISO.
                  Skips this and uses raw values when off.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="default"
              onClick={handleAdvanceToReview}
              disabled={parsing}
            >
              {parsing ? (
                <>
                  <IconLoader2 className="animate-spin mr-1.5" size={14} />
                  Normalizing…
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <PoliciesReviewTable
          rows={reviewRows}
          confidence={reviewConfidence}
          errors={reviewErrors}
          agents={agents}
          agentsLoading={agentsLoading}
          onRowChange={editRow}
          onBack={() => setStep(3)}
          onConfirm={handleConfirm}
          isSubmitting={importing}
          primaryActionLabel={`Confirm Import (${reviewRows.length})`}
        />
      ) : null}
    </div>
  )
}

function extractSalesImportRowErrors(err: unknown): SalesImportRowError[] {
  if (!(err instanceof ApiError)) return []
  const details = err.details
  if (!details || typeof details !== 'object' || !('errors' in details)) return []
  const errors = (details as { errors?: unknown }).errors
  if (!Array.isArray(errors)) return []
  return errors.filter((error): error is SalesImportRowError => (
    !!error &&
    typeof error === 'object' &&
    typeof (error as SalesImportRowError).row === 'number' &&
    typeof (error as SalesImportRowError).field === 'string' &&
    typeof (error as SalesImportRowError).message === 'string'
  ))
}
