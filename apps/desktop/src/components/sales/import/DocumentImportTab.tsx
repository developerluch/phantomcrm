import { useState, useRef, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import {
  IconUpload,
  IconFileText,
  IconAlertTriangle,
  IconX,
  IconShieldOff,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { getAccountAgentId } from '@/lib/agent-id'
import { ApiError, api } from '../../../services/api'
import { useAuthStore } from '../../../store'
import type { Sale, SalesAgentDirectoryEntry, SalesImportRowError } from '../../../types/portal'
import PoliciesReviewTable from './PoliciesReviewTable'

interface DocumentImportTabProps {
  onClose: () => void
  agents: SalesAgentDirectoryEntry[]
  agentsLoading?: boolean
}

type FileStatus = 'queued' | 'uploading' | 'parsing' | 'ready' | 'error'

interface ParsedDocumentResult {
  fields: Partial<Sale>
  confidence: Record<string, number>
  raw_text_excerpt: string
}

interface FileEntry {
  id: string
  file: File
  status: FileStatus
  error?: string
  result?: ParsedDocumentResult
}

const MAX_FILES = 20
const MAX_FILE_BYTES = 10 * 1024 * 1024
const PARSE_CONCURRENCY = 3

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statusBadge(status: FileStatus) {
  switch (status) {
    case 'queued':
      return <Badge variant="secondary">Queued</Badge>
    case 'uploading':
      return <Badge variant="info">Uploading</Badge>
    case 'parsing':
      return <Badge variant="warning">Parsing</Badge>
    case 'ready':
      return <Badge variant="success">Ready</Badge>
    case 'error':
      return <Badge variant="destructive">Error</Badge>
  }
}

type Step = 'upload' | 'review'

export default function DocumentImportTab({ onClose, agents, agentsLoading = false }: DocumentImportTabProps) {
  // Env flag intentionally defaults to enabled; only `"false"` literal disables it.
  // Matches the cast pattern at src/services/config.ts:9-21.
  const docParsingEnabled =
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_ENABLE_AI_DOCUMENT_PARSING !== 'false'

  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const accountAgentId = getAccountAgentId(user)
  const defaultAgentId =
    accountAgentId || agents.find((agent) => agent.isCurrentUser)?.agentId || ''
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [files, setFiles] = useState<FileEntry[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState(false)
  const [reviewRows, setReviewRows] = useState<Array<Partial<Sale>>>([])
  const [reviewConfidence, setReviewConfidence] = useState<Array<Record<string, number>>>([])
  const [reviewErrors, setReviewErrors] = useState<SalesImportRowError[]>([])

  const allReady = useMemo(
    () => files.length > 0 && files.every((f) => f.status === 'ready'),
    [files],
  )

  // Drive each file through 'uploading' → 'parsing' → 'ready' (or 'error').
  // Concurrency cap: process the queue in chunks so we never have more than
  // PARSE_CONCURRENCY in-flight parses against the backend.
  const runParser = useCallback(async (entries: FileEntry[]) => {
    for (let i = 0; i < entries.length; i += PARSE_CONCURRENCY) {
      const chunk = entries.slice(i, i + PARSE_CONCURRENCY)
      await Promise.all(
        chunk.map(async (entry) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === entry.id ? { ...f, status: 'uploading' } : f)),
          )
          try {
            setFiles((prev) =>
              prev.map((f) => (f.id === entry.id ? { ...f, status: 'parsing' } : f)),
            )
            const result = await api.parseSalesDocument(entry.file)
            setFiles((prev) =>
              prev.map((f) =>
                f.id === entry.id ? { ...f, status: 'ready', result } : f,
              ),
            )
          } catch (err) {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === entry.id
                  ? { ...f, status: 'error', error: (err as Error).message }
                  : f,
              ),
            )
          }
        }),
      )
    }
  }, [])

  const addFiles = useCallback(
    (incoming: File[]) => {
      if (!docParsingEnabled) return

      const accepted: FileEntry[] = []
      const rejected: string[] = []

      for (const file of incoming) {
        const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf'
        if (!isPdf) {
          rejected.push(`${file.name}: not a PDF`)
          continue
        }
        if (file.size > MAX_FILE_BYTES) {
          rejected.push(`${file.name}: exceeds 10MB`)
          continue
        }
        accepted.push({
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
          file,
          status: 'queued',
        })
      }

      if (rejected.length > 0) {
        toast.error(rejected.join(' · '))
      }

      setFiles((prev) => {
        const room = MAX_FILES - prev.length
        if (room <= 0) {
          toast.error(`Maximum ${MAX_FILES} files at a time.`)
          return prev
        }
        const allowed = accepted.slice(0, room)
        if (accepted.length > room) {
          toast.error(`Only the first ${room} files were added (max ${MAX_FILES}).`)
        }
        const next = [...prev, ...allowed]
        // Kick off parsing for the new entries after state update; runParser
        // captures the entries by reference so it doesn't depend on the updated state.
        if (allowed.length > 0) {
          void runParser(allowed)
        }
        return next
      })
    },
    [docParsingEnabled, runParser],
  )

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const resetTab = useCallback(() => {
    setFiles([])
    setReviewRows([])
    setReviewConfidence([])
    setReviewErrors([])
    setStep('upload')
  }, [])

  const handleReview = useCallback(() => {
    const ready = files.filter((f) => f.status === 'ready' && f.result)
    setReviewErrors([])
    setReviewRows(ready.map((f) => ({
      ...(defaultAgentId ? { agentId: defaultAgentId } : {}),
      ...f.result!.fields,
    })))
    setReviewConfidence(ready.map((f) => f.result!.confidence))
    setStep('review')
  }, [defaultAgentId, files])

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
      const dupMsg = result.skipped > 0 ? ` (${result.skipped} duplicates skipped)` : ''
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

  return (
    <div className="flex flex-col gap-4 min-h-0 flex-1">
      <Card className="bg-amber-500/10 border border-amber-500/30 text-amber-200 p-3">
        <div className="flex items-start gap-2 text-sm">
          <IconAlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
          <p>
            AI parsing currently runs on standard Anthropic infrastructure. For multi-tenant rollout, this will require Enterprise-tier BAA.
          </p>
        </div>
      </Card>

      {!docParsingEnabled ? (
        <Card className="bg-card/40 border border-border/60 p-6">
          <div className="flex items-start gap-3">
            <IconShieldOff size={20} className="text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium">Document parsing is disabled in this environment.</p>
              <p className="text-xs text-muted-foreground mt-1">
                Contact your administrator.
              </p>
            </div>
          </div>
        </Card>
      ) : step === 'upload' ? (
        <>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragOver(false)
              const dropped = Array.from(e.dataTransfer.files ?? [])
              addFiles(dropped)
            }}
            className={cn(
              'h-44 rounded-lg border border-dashed flex flex-col items-center justify-center gap-3 transition-colors',
              dragOver
                ? 'border-sky-300 bg-sky-500/5'
                : 'border-border/60 bg-card/30',
            )}
          >
            <IconFileText size={32} className="text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              Drop PDF policy documents here, or
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={(e) => {
                const list = Array.from(e.target.files ?? [])
                addFiles(list)
                if (fileInputRef.current) fileInputRef.current.value = ''
              }}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              <IconUpload size={14} />
              Browse files
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Up to {MAX_FILES} PDFs, max 10MB each.
            </p>
          </div>

          {files.length > 0 ? (
            <div className="rounded-lg border border-border/50 bg-card/30 divide-y divide-border/40">
              {files.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 p-2.5">
                  <IconFileText size={18} className="text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{entry.file.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatBytes(entry.file.size)}
                      {entry.error ? ` · ${entry.error}` : null}
                    </div>
                  </div>
                  {statusBadge(entry.status)}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFile(entry.id)}
                    className="h-7 w-7"
                  >
                    <IconX size={14} />
                  </Button>
                </div>
              ))}
            </div>
          ) : null}

          {files.length > 0 ? (
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={resetTab}>
                Clear all
              </Button>
              <Button
                variant="default"
                onClick={handleReview}
                disabled={!allReady}
              >
                Review {files.filter((f) => f.status === 'ready').length} parsed policies
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <PoliciesReviewTable
          rows={reviewRows}
          confidence={reviewConfidence}
          errors={reviewErrors}
          agents={agents}
          agentsLoading={agentsLoading}
          onRowChange={editRow}
          onBack={() => setStep('upload')}
          onConfirm={handleConfirm}
          isSubmitting={importing}
          primaryActionLabel={`Confirm Import (${reviewRows.length})`}
        />
      )}
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
