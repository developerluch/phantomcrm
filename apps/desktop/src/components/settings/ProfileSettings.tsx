import { useState } from 'react'
import { useAuthStore } from '@/store'
import { api } from '@/services/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  IconUser,
  IconBrandDiscord,
  IconDeviceFloppy,
  IconPhoto,
  IconLoader2,
} from '@tabler/icons-react'

const TIMEZONES = [
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Anchorage', 'Pacific/Honolulu', 'America/Phoenix', 'America/Toronto',
  'America/Vancouver', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney',
  'Pacific/Auckland', 'UTC',
]

export default function ProfileSettings() {
  const { user, setAuth, accessToken, refreshToken } = useAuthStore()
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [timezone, setTimezone] = useState('America/New_York')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)

  const initials = displayName
    ? displayName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await api.updateMe({ displayName: displayName.trim(), email: email.trim() })
      if (accessToken && refreshToken) {
        setAuth(updated, accessToken, refreshToken)
      }
      toast.success('Profile updated')
    } catch {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Profile</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your personal information</p>
      </div>

      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconUser size={15} className="text-purple-400" />
            Your Profile
          </CardTitle>
          <CardDescription className="text-xs">
            Your identity across the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative group">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-border" />
              ) : (
                <div
                  className="w-20 h-20 rounded-full flex items-center justify-center text-xl font-bold text-white border-2 border-border"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  {initials === '?' ? <IconUser size={28} /> : initials}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                <IconPhoto size={20} className="text-white" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{user?.displayName || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {user?.avatarUrl ? 'Avatar from Discord' : 'No avatar set'}
              </p>
            </div>
          </div>

          {/* Discord ID */}
          {user?.discordId && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Discord</label>
              <div className="flex items-center gap-2 text-sm">
                <IconBrandDiscord size={16} className="text-[#5865F2]" />
                <span className="font-mono text-xs text-muted-foreground">{user.discordId}</span>
                <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Connected</Badge>
              </div>
            </div>
          )}

          {/* Display Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Display Name</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>

          {/* Timezone */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Timezone</label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>{tz.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone Number</label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 (555) 000-0000" />
          </div>

          {/* Role */}
          {user?.roleId && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Role</label>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs capitalize">{user.roleId}</Badge>
                <span className="text-[11px] text-muted-foreground">Managed by admin</span>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button onClick={handleSave} variant="gradient" size="sm" disabled={saving} className="flex items-center gap-1.5">
              {saving ? <IconLoader2 size={14} className="animate-spin" /> : <IconDeviceFloppy size={14} />}
              {saving ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
