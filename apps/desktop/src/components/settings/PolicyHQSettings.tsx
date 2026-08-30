import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { IconShieldCheck, IconExternalLink, IconDeviceFloppy } from '@tabler/icons-react'

export default function PolicyHQSettings() {
  const [url, setUrl] = useState('https://app.policyhq.com')

  function handleSave() {
    localStorage.setItem('vipa-policyhq-url', url)
    toast.success('PolicyHQ settings saved')
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">PolicyHQ</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Configure your PolicyHQ integration</p>
      </div>

      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <IconShieldCheck size={15} className="text-teal-400" />
                PolicyHQ
              </CardTitle>
              <CardDescription className="text-xs mt-1">Policy management platform</CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px]">External</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">PolicyHQ URL</label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://app.policyhq.com" />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Auto-Sync Sales</p>
              <p className="text-xs text-muted-foreground">Automatically pull sales from PolicyHQ</p>
            </div>
            <Badge variant="outline" className="text-[10px]">Coming soon</Badge>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} variant="gradient" size="sm" className="flex items-center gap-1.5">
              <IconDeviceFloppy size={14} /> Save
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(url, '_blank')}
              className="flex items-center gap-1.5"
            >
              <IconExternalLink size={14} /> Open PolicyHQ
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
