import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import {
  IconSearch, IconTrash, IconFileText, IconPhoto, IconFile,
  IconPlus, IconExternalLink,
} from '@tabler/icons-react'
import { toast } from 'sonner'

const CATEGORY_OPTIONS = ['general', 'contract', 'license', 'training', 'compliance', 'other']

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return <IconPhoto size={18} className="text-purple-400" />
  if (mime.includes('pdf') || mime.includes('text')) return <IconFileText size={18} className="text-blue-400" />
  return <IconFile size={18} className="text-muted-foreground" />
}

function formatSize(bytes: number) {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentVaultPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newDoc, setNewDoc] = useState({ filename: '', fileUrl: '', category: 'general' })

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => api.getDocuments(),
  })

  const filtered = documents.filter((d) => {
    if (search && !d.filename.toLowerCase().includes(search.toLowerCase())) return false
    if (categoryFilter && d.category !== categoryFilter) return false
    return true
  })

  async function handleAdd() {
    if (!newDoc.filename.trim() || !newDoc.fileUrl.trim()) {
      toast.error('Filename and URL are required')
      return
    }
    try {
      await api.createDocument(newDoc)
      toast.success('Document added')
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      setShowAdd(false)
      setNewDoc({ filename: '', fileUrl: '', category: 'general' })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to add document')
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteDocument(id)
      toast.success('Document deleted')
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete document')
    }
  }

  return (
    <div className="space-y-5 animate-fade-in pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Document Vault</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage files and documents</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
          <IconPlus size={14} className="mr-1" />
          Add Document
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <Card>
          <CardContent className="flex items-end gap-3 p-4">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Filename</label>
              <Input
                value={newDoc.filename}
                onChange={(e) => setNewDoc((d) => ({ ...d, filename: e.target.value }))}
                placeholder="contract.pdf"
                className="h-8 text-xs"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">File URL</label>
              <Input
                value={newDoc.fileUrl}
                onChange={(e) => setNewDoc((d) => ({ ...d, fileUrl: e.target.value }))}
                placeholder="https://..."
                className="h-8 text-xs"
              />
            </div>
            <div className="w-32 space-y-1">
              <label className="text-xs text-muted-foreground">Category</label>
              <Select
                value={newDoc.category}
                onValueChange={(v) => setNewDoc((d) => ({ ...d, category: v }))}
              >
                <SelectTrigger className="w-full h-8 text-xs">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={handleAdd}>Save</Button>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select
          value={categoryFilter || '_all'}
          onValueChange={(v) => setCategoryFilter(v === '_all' ? '' : v)}
        >
          <SelectTrigger className="h-9 w-[160px] text-xs">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">All categories</SelectItem>
            {CATEGORY_OPTIONS.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Documents list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">{filtered.length} document{filtered.length !== 1 ? 's' : ''}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 rounded bg-card border border-border animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No documents found.</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.02] transition-colors"
                >
                  {fileIcon(doc.mimeType)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{doc.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.category} · {formatSize(doc.fileSize)} · {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <IconExternalLink size={14} />
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(doc.id)}
                    className="text-muted-foreground hover:text-red-400 transition-colors h-7 w-7"
                  >
                    <IconTrash size={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
