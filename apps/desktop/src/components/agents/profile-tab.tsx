import { useState, useEffect } from 'react'
import { useProfile, useUpdateProfile } from '../../hooks/useProfile'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { IconDeviceFloppy, IconLoader2 } from '@tabler/icons-react'
import { toast } from 'sonner'

export function ProfileTab({ agentId }: { agentId: string }) {
  const { data: profile, isLoading } = useProfile(agentId)
  const updateProfile = useUpdateProfile()

  const [bio, setBio] = useState('')
  const [city, setCity] = useState('')
  const [timezone, setTimezone] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [photoUrl, setPhotoUrl] = useState('')
  const [startDate, setStartDate] = useState('')

  useEffect(() => {
    if (profile) {
      setBio(profile.bio ?? '')
      setCity(profile.city ?? '')
      setTimezone(profile.timezone ?? '')
      setLinkedinUrl(profile.linkedinUrl ?? '')
      setPhotoUrl(profile.photoUrl ?? '')
      setStartDate(profile.startDate?.slice(0, 10) ?? '')
    }
  }, [profile])

  function handleSave() {
    updateProfile.mutate(
      {
        agentId,
        data: {
          bio: bio || null,
          city: city || null,
          timezone: timezone || null,
          linkedinUrl: linkedinUrl || null,
          photoUrl: photoUrl || null,
          startDate: startDate || null,
        },
      },
      {
        onSuccess: () => toast.success('Profile updated'),
        onError: () => toast.error('Failed to update profile'),
      }
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <IconLoader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bio</label>
          <Textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            placeholder="Short bio..."
            className="w-full rounded-md border border-border bg-popover px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground resize-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">City</label>
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Miami" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Timezone</label>
          <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="e.g. America/New_York" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">LinkedIn URL</label>
          <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Photo URL</label>
          <Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://..." />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Start Date</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </div>

      {profile?.compTier && (
        <div className="rounded-lg border border-border/50 bg-popover p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Comp Tier</div>
          <div className="text-foreground font-medium">
            {profile.compTier.name}{' '}
            <span className="text-blue-400">({profile.compTier.percentage}%)</span>
          </div>
        </div>
      )}

      {profile?.manager && (
        <div className="rounded-lg border border-border/50 bg-popover p-4">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Manager</div>
          <div className="text-foreground font-medium">
            {profile.manager.firstName} {profile.manager.lastName}
          </div>
        </div>
      )}

      <Button
        onClick={handleSave}
        variant="gradient"
        size="sm"
        disabled={updateProfile.isPending}
        className="flex items-center gap-1.5"
      >
        {updateProfile.isPending ? (
          <><IconLoader2 size={14} className="animate-spin" /> Saving...</>
        ) : (
          <><IconDeviceFloppy size={14} /> Save Profile</>
        )}
      </Button>
    </div>
  )
}
