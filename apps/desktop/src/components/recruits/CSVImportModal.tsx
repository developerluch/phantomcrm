import { useState, useRef } from 'react'
import { useBulkImportRecruits } from '../../hooks/useRecruits'
import { toast } from 'sonner'
import { IconUpload, IconFileSpreadsheet, IconLoader2 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface ParsedRow {
  firstName: string
  lastName: string
  phone: string
  tags: string
  smsMessage: string
  source: string
}

interface Props {
  open: boolean
  onClose: () => void
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []

  // Parse header
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''))
  const firstNameIdx = header.findIndex((h) => h === 'firstname' || h === 'first_name' || h === 'first name')
  const lastNameIdx = header.findIndex((h) => h === 'lastname' || h === 'last_name' || h === 'last name')
  const phoneIdx = header.findIndex((h) => h === 'phone' || h === 'phone_number' || h === 'phonenumber')
  const tagsIdx = header.findIndex((h) => h === 'tags' || h === 'tag')
  const smsIdx = header.findIndex((h) => h === 'smsmessage' || h === 'sms_message' || h === 'sms' || h === 'message')
  const sourceIdx = header.findIndex((h) => h === 'source')

  const rows: ParsedRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^["']|["']$/g, ''))
    const firstName = firstNameIdx >= 0 ? cols[firstNameIdx] ?? '' : cols[0] ?? ''
    const lastName = lastNameIdx >= 0 ? cols[lastNameIdx] ?? '' : cols[1] ?? ''
    if (!firstName && !lastName) continue

    rows.push({
      firstName,
      lastName,
      phone: phoneIdx >= 0 ? cols[phoneIdx] ?? '' : cols[2] ?? '',
      tags: tagsIdx >= 0 ? cols[tagsIdx] ?? '' : '',
      smsMessage: smsIdx >= 0 ? cols[smsIdx] ?? '' : '',
      source: sourceIdx >= 0 ? cols[sourceIdx] ?? '' : 'csv_import',
    })
  }
  return rows
}

export default function CSVImportModal({ open, onClose }: Props) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const bulkImport = useBulkImportRecruits()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = parseCSV(text)
      setParsedRows(rows)
      if (rows.length === 0) {
        toast.error('No valid rows found. Expected columns: firstName, lastName, phone, tags, smsMessage, source')
      }
    }
    reader.readAsText(file)
  }

  const handleImport = () => {
    if (parsedRows.length === 0) return
    bulkImport.mutate(
      { recruits: parsedRows },
      {
        onSuccess: (data) => {
          toast.success(`Imported ${data.created} recruits (${data.skipped} skipped, ${data.queued} SMS queued)`)
          setParsedRows([])
          setFileName('')
          onClose()
        },
        onError: () => toast.error('Import failed'),
      }
    )
  }

  const handleClose = () => {
    setParsedRows([])
    setFileName('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconFileSpreadsheet size={20} className="text-blue-400" />
            CSV Import
          </DialogTitle>
        </DialogHeader>

        {/* File picker */}
        <div className="mb-4">
          <Input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            className="w-full justify-center gap-2"
          >
            <IconUpload size={16} />
            {fileName || 'Choose CSV file'}
          </Button>
          <p className="text-xs text-muted-foreground mt-1.5">
            Columns: firstName, lastName, phone, tags, smsMessage, source
          </p>
        </div>

        {/* Preview table */}
        {parsedRows.length > 0 && (
          <div className="flex-1 overflow-auto mb-4 rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-[200px]">Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="max-w-[200px]">SMS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedRows.slice(0, 50).map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.firstName} {row.lastName}</TableCell>
                    <TableCell className="text-muted-foreground">{row.phone || '--'}</TableCell>
                    <TableCell className="text-muted-foreground">{row.source || '--'}</TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-[200px]">{row.smsMessage || '--'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {parsedRows.length > 50 && (
              <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border">
                Showing 50 of {parsedRows.length} rows
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {parsedRows.length > 0 ? `${parsedRows.length} rows ready` : 'No file selected'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={parsedRows.length === 0 || bulkImport.isPending}
            >
              {bulkImport.isPending ? (
                <IconLoader2 size={14} className="animate-spin mr-1.5" />
              ) : (
                <IconUpload size={14} className="mr-1.5" />
              )}
              Import {parsedRows.length > 0 ? parsedRows.length : ''} Recruits
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
