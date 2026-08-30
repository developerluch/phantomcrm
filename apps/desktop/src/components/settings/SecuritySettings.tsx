import { useState } from 'react'
import { useAuthStore } from '@/store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  IconShield,
  IconBrandDiscord,
  IconLock,
  IconDevices,
  IconFingerprint,
} from '@tabler/icons-react'

export default function SecuritySettings() {
  const { user } = useAuthStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const hasEmailAuth = !!user?.email && user.email.includes('@')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Security</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your password and security settings</p>
      </div>

      {/* Change Password */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconLock size={15} className="text-amber-400" />
            Change Password
          </CardTitle>
          <CardDescription className="text-xs">
            {hasEmailAuth ? 'Update your account password' : 'Not available — you signed in with Discord'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Password</label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={!hasEmailAuth} placeholder="••••••••" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">New Password</label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={!hasEmailAuth} placeholder="••••••••" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Confirm New Password</label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={!hasEmailAuth} placeholder="••••••••" />
          </div>
          <Button variant="gradient" size="sm" disabled={!hasEmailAuth || !currentPassword || !newPassword || newPassword !== confirmPassword}>
            Update Password
          </Button>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconDevices size={15} className="text-blue-400" />
            Active Sessions
          </CardTitle>
          <CardDescription className="text-xs">Manage your active sessions across devices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <IconDevices size={32} className="text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Session management coming soon</p>
          </div>
        </CardContent>
      </Card>

      {/* 2FA */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconFingerprint size={15} className="text-emerald-400" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription className="text-xs">Add an extra layer of security</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Two-factor authentication</p>
            <Badge variant="outline" className="text-[10px]">Coming soon</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconShield size={15} className="text-purple-400" />
            Connected Accounts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/50">
            <div className="w-10 h-10 rounded-full bg-[#5865F2]/15 flex items-center justify-center">
              <IconBrandDiscord size={20} className="text-[#5865F2]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Discord</p>
              <p className="text-xs text-muted-foreground">
                {user?.discordId ? `Connected as ${user.displayName}` : 'Not connected'}
              </p>
            </div>
            <Badge className={user?.discordId
              ? 'text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
              : 'text-[10px]'
            }>
              {user?.discordId ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
