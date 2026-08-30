import { useState } from 'react'
import { api } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  IconDatabaseExport,
  IconDownload,
  IconTrash,
  IconAlertTriangle,
  IconLoader2,
} from '@tabler/icons-react'

export default function DataExportSettings() {
  const [exporting, setExporting] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const blob = await api.exportCsv()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `phantom-export-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Data exported successfully')
    } catch {
      toast.error('Failed to export data')
    } finally {
      setExporting(false)
    }
  }

  async function handleClearChat() {
    try {
      const { conversations } = await api.getChatConversations()
      for (const conv of conversations) {
        await api.deleteChatConversation(conv.id)
      }
      toast.success('Chat history cleared')
      setConfirmClear(false)
    } catch {
      toast.error('Failed to clear chat history')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Data & Export</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Export your data or manage storage</p>
      </div>

      {/* Export */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconDatabaseExport size={15} className="text-blue-400" />
            Export Data
          </CardTitle>
          <CardDescription className="text-xs">Download your agents, recruits, and sales data</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={exporting} variant="outline" size="sm" className="flex items-center gap-1.5">
            {exporting ? <IconLoader2 size={14} className="animate-spin" /> : <IconDownload size={14} />}
            {exporting ? 'Exporting...' : 'Export All Data (CSV)'}
          </Button>
        </CardContent>
      </Card>

      {/* Clear Chat */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconTrash size={15} className="text-muted-foreground" />
            Chat History
          </CardTitle>
          <CardDescription className="text-xs">Manage your AI chat conversation history</CardDescription>
        </CardHeader>
        <CardContent>
          {confirmClear ? (
            <div className="space-y-3">
              <p className="text-sm text-red-400">Are you sure? This will permanently delete all chat conversations.</p>
              <div className="flex gap-2">
                <Button onClick={handleClearChat} variant="destructive" size="sm">Yes, Delete All</Button>
                <Button onClick={() => setConfirmClear(false)} variant="outline" size="sm">Cancel</Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setConfirmClear(true)} variant="outline" size="sm" className="flex items-center gap-1.5 text-muted-foreground">
              <IconTrash size={14} /> Clear Chat History
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-500/20" style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-red-400">
            <IconAlertTriangle size={15} />
            Danger Zone
          </CardTitle>
          <CardDescription className="text-xs">Irreversible actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg border border-red-500/10 bg-red-500/5">
            <div>
              <p className="text-sm text-foreground">Delete All Sales Data</p>
              <p className="text-xs text-muted-foreground">Permanently remove all sales records</p>
            </div>
            <Button variant="destructive" size="sm" disabled className="opacity-50 cursor-not-allowed">Delete</Button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-red-500/10 bg-red-500/5">
            <div>
              <p className="text-sm text-foreground">Reset Pipeline</p>
              <p className="text-xs text-muted-foreground">Reset all recruit pipeline data</p>
            </div>
            <Button variant="destructive" size="sm" disabled className="opacity-50 cursor-not-allowed">Reset</Button>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border border-red-500/10 bg-red-500/5">
            <div>
              <p className="text-sm text-foreground">Delete Account</p>
              <p className="text-xs text-muted-foreground">Permanently delete your account and all data</p>
            </div>
            <Button variant="destructive" size="sm" disabled className="opacity-50 cursor-not-allowed">Delete</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
