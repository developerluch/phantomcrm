import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { IconPhone, IconDeviceFloppy, IconRefresh } from '@tabler/icons-react'

export default function WavvIntegrationSettings() {
  const [syncInterval, setSyncInterval] = useState(
    () => localStorage.getItem('phantom-wavv-sync-interval') || '30m',
  )

  function handleSave() {
    localStorage.setItem('phantom-wavv-sync-interval', syncInterval)
    localStorage.removeItem('vipa-wavv-key')
    toast.success('WAVV preference saved')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">WAVV Integration</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Connect and configure your WAVV dialer</p>
      </div>

      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <IconPhone size={15} className="text-cyan-400" />
                Connection
              </CardTitle>
              <CardDescription className="text-xs mt-1">Server-managed WAVV configuration</CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px]">Managed by API</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Configure <code>WAVV_API_KEY</code> on the API service. Provider keys are never stored in the renderer.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Sync Interval</label>
            <Select value={syncInterval} onValueChange={setSyncInterval}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15m">Every 15 minutes</SelectItem>
                <SelectItem value="30m">Every 30 minutes</SelectItem>
                <SelectItem value="1h">Every hour</SelectItem>
                <SelectItem value="manual">Manual only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} variant="gradient" size="sm" className="flex items-center gap-1.5">
              <IconDeviceFloppy size={14} /> Save
            </Button>
            <Button variant="outline" size="sm" disabled className="flex items-center gap-1.5 opacity-50">
              <IconRefresh size={14} /> Sync Now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Agent Mapping */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Agent Mapping</CardTitle>
          <CardDescription className="text-xs">How WAVV agents map to Phantom agents</CardDescription>
        </CardHeader>
        <CardContent>
          <Select defaultValue="email">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">By email address</SelectItem>
              <SelectItem value="name">By name</SelectItem>
              <SelectItem value="manual">Manual mapping</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    </div>
  )
}
