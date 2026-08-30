import { useState } from 'react'
import { useAuthStore } from '@/store'
import { api } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { PhantomMark } from '@/components/brand/PhantomMark'
import { toast } from 'sonner'
import { IconBuilding, IconDeviceFloppy, IconLoader2 } from '@tabler/icons-react'

export default function OrgGeneralSettings() {
  const { user } = useAuthStore()
  const [orgName, setOrgName] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!user?.orgId) return
    setSaving(true)
    try {
      await api.updateOrganization(user.orgId, { name: orgName.trim(), slug: orgName.trim().toLowerCase().replace(/\s+/g, '-') })
      toast.success('Organization updated')
    } catch {
      toast.error('Failed to update organization')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Organization</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your organization settings</p>
      </div>

      <Card className="relative overflow-hidden" style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <Separator className="absolute top-0 left-0 right-0 bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconBuilding size={15} className="text-blue-400" />
            General
          </CardTitle>
          <CardDescription className="text-xs">Organization identity and branding</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <PhantomMark variant="static" size={38} />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">PhantomCRM</p>
              <p className="text-xs text-muted-foreground">Workspace brand identity</p>
            </div>
          </div>

          {/* Org Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Organization Name</Label>
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Top Floor Closers" />
          </div>

          {/* Org ID */}
          {user?.orgId && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Organization ID</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">{user.orgId}</Badge>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button onClick={handleSave} variant="gradient" size="sm" disabled={saving} className="flex items-center gap-1.5">
              {saving ? <IconLoader2 size={14} className="animate-spin" /> : <IconDeviceFloppy size={14} />}
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
