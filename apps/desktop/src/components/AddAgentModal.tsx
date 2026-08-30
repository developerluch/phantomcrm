import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import { toast } from 'sonner'
import {
  IconCheck,
  IconMail,
  IconMessage,
  IconX,
  IconUserPlus,
  IconLoader2,
  IconSearch,
  IconShieldCheck,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import type { DiscordMemberLookup, CompTierWithAgents } from '../types/portal'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
]

const AGENCIES = ['TFC', 'Radiant', 'GBU', 'TruLight', 'Thrive', 'The Point', 'Synergy', 'Illuminate', 'Elite One']

interface CreatedAgentResponse {
  id?: string
  discordId?: string
  discord_id?: string
}

type InviteDelivery = 'email' | 'sms' | 'both'

interface Props {
  open: boolean
  onClose: () => void
}

export default function AddAgentModal({ open, onClose }: Props) {
  const queryClient = useQueryClient()

  const [discordId, setDiscordId] = useState('')
  const [memberLookup, setMemberLookup] = useState<DiscordMemberLookup | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [state, setState] = useState('')
  const [agency, setAgency] = useState('')
  const [npn, setNpn] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [sendInvite, setSendInvite] = useState(true)
  const [inviteDelivery, setInviteDelivery] = useState<InviteDelivery>('email')
  const [compTierId, setCompTierId] = useState('')
  const [autoVerify, setAutoVerify] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const { data: compTiers = [] } = useQuery<CompTierWithAgents[]>({
    queryKey: ['comp-tiers'],
    queryFn: () => api.getCompTiers(),
    enabled: open,
  })

  const resetForm = () => {
    setDiscordId('')
    setMemberLookup(null)
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setState('')
    setAgency('')
    setNpn('')
    setLicenseNumber('')
    setSendInvite(true)
    setInviteDelivery('email')
    setCompTierId('')
    setAutoVerify(true)
    setSubmitting(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const handleLookup = async () => {
    if (!discordId.trim()) return
    setLookingUp(true)
    setMemberLookup(null)
    try {
      const result = await api.lookupDiscordMember(discordId.trim())
      setMemberLookup(result)
    } catch {
      setMemberLookup({ exists: false, discordId: discordId.trim() })
    } finally {
      setLookingUp(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim() || !email.trim()) return
    if (sendInvite && (inviteDelivery === 'sms' || inviteDelivery === 'both') && !phone.trim()) return

    setSubmitting(true)
    try {
      const created = await api.createAgent({
        discordId: discordId.trim() || undefined,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        state: state || undefined,
        agency: agency || undefined,
        npn: npn.trim() || undefined,
        licenseNumber: licenseNumber.trim() || undefined,
      }) as CreatedAgentResponse | undefined

      const agentId = created?.discordId || created?.discord_id || created?.id || discordId.trim() || email.trim()

      if (memberLookup?.avatarUrl && agentId) {
        try {
          await api.updateProfile(agentId, { photoUrl: memberLookup.avatarUrl })
        } catch {
          // Best-effort profile enrichment.
        }
      }

      if (compTierId && agentId) {
        try {
          await api.setCompTier(agentId, compTierId)
        } catch {
          // Best-effort until backend supports email-first agent IDs everywhere.
        }
      }

      let verifyMsg = ''
      if (autoVerify && state && agentId) {
        try {
          const result = await api.verifyAgent(agentId, {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            state,
            npn: npn.trim() || undefined,
          })
          verifyMsg = result.verified
            ? ` — License verified${result.npn ? ` (NPN: ${result.npn})` : ''}`
            : ' — License not found'
        } catch {
          verifyMsg = ' — Verification failed'
        }
      }

      let inviteMsg = ''
      if (sendInvite) {
        const channels = inviteDelivery === 'both'
          ? ['email', 'sms'] as const
          : [inviteDelivery] as const

        try {
          const invite = await api.inviteAgentOnboarding({
            agentId,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            channels: [...channels],
          })
          const delivered = [
            invite.emailSent ? 'email' : null,
            invite.smsSent ? 'SMS' : null,
          ].filter(Boolean).join(' and ')
          inviteMsg = delivered ? ` — Invite sent by ${delivered}` : ' — Invite queued'
        } catch {
          inviteMsg = ' — Invite failed'
        }
      }

      toast.success(`Agent added successfully${verifyMsg}${inviteMsg}`)
      queryClient.invalidateQueries({ queryKey: ['org-chart'] })
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      handleClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create agent'
      if (msg.includes('409')) {
        toast.error('This agent already exists. Check the Agents page before creating a duplicate.', { duration: 8000 })
      } else if (msg.includes('400')) {
        toast.error('Missing required fields — check name, email, and phone if SMS invite is selected')
      } else {
        toast.error(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const canVerifyLicense = Boolean(state && (npn.trim() || (firstName.trim() && lastName.trim())))
  const smsInviteNeedsPhone = sendInvite && (inviteDelivery === 'sms' || inviteDelivery === 'both') && !phone.trim()
  const submitLabel = sendInvite ? 'Create & Send Invite' : 'Create Agent'

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !submitting) handleClose() }}>
      <DialogContent className="sm:max-w-2xl bg-card/95 backdrop-blur-md border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted border border-border">
              <IconUserPlus size={18} className="text-foreground" />
            </div>
            Add Agent
          </DialogTitle>
          <DialogDescription>
            Create an agent manually. Link Discord when available; it is not required for the MVP workflow.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Agent Details</h3>
              <p className="text-xs text-muted-foreground">Name and email create the agent profile and power the onboarding invite.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">First Name *</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" />
              </div>
              <div>
                <Label className="mb-1.5 block">Last Name *</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">Email *</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="agent@example.com" type="email" />
              </div>
              <div>
                <Label className="mb-1.5 block">Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 123-4567" type="tel" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">State</Label>
                <Select value={state || undefined} onValueChange={setState}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state..." />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Agency</Label>
                <Select value={agency || undefined} onValueChange={setAgency}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select agency..." />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENCIES.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Onboarding Invite</h3>
              <p className="text-xs text-muted-foreground">Send the onboarding link after creation. Email uses Resend; SMS uses Telnyx from the backend.</p>
            </div>
            <Card className="bg-card/50">
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label>Send onboarding invite</Label>
                    <p className="text-xs text-muted-foreground">The rep receives a secure link to finish their setup.</p>
                  </div>
                  <Switch checked={sendInvite} onCheckedChange={setSendInvite} />
                </div>
                {sendInvite && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="mb-1.5 block">Delivery Method</Label>
                      <Select value={inviteDelivery} onValueChange={(value) => setInviteDelivery(value as InviteDelivery)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">
                            <span className="inline-flex items-center gap-2">
                              <IconMail size={14} />
                              Email via Resend
                            </span>
                          </SelectItem>
                          <SelectItem value="sms">
                            <span className="inline-flex items-center gap-2">
                              <IconMessage size={14} />
                              SMS via Telnyx
                            </span>
                          </SelectItem>
                          <SelectItem value="both">Email and SMS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="rounded-md border border-border bg-background/50 p-3 text-xs text-muted-foreground">
                      {smsInviteNeedsPhone
                        ? 'Add a phone number before sending an SMS invite.'
                        : inviteDelivery === 'email'
                          ? 'Invite will be sent to the email above.'
                          : inviteDelivery === 'sms'
                            ? 'Invite will be sent to the phone above.'
                            : 'Invite will be sent to both email and phone.'}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          <Separator />

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Optional Discord Link</h3>
              <p className="text-xs text-muted-foreground">Use Discord lookup only when the agent is already in the server.</p>
            </div>
            <div className="flex gap-2">
              <Input
                value={discordId}
                onChange={(e) => {
                  setDiscordId(e.target.value)
                  setMemberLookup(null)
                }}
                placeholder="Discord user ID"
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={handleLookup} disabled={lookingUp || !discordId.trim()}>
                {lookingUp ? <IconLoader2 size={14} className="animate-spin" /> : <IconSearch size={14} />}
                {lookingUp ? 'Checking...' : 'Check'}
              </Button>
            </div>
            {memberLookup && (
              <Card className="bg-card/50">
                <CardContent className="p-3 flex items-center gap-3">
                  {memberLookup.exists ? (
                    <>
                      {memberLookup.avatarUrl && <img src={memberLookup.avatarUrl} className="h-8 w-8 rounded-full" alt="" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{memberLookup.displayName || memberLookup.username}</p>
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                          <IconCheck size={10} className="mr-0.5" />
                          Found in server
                        </Badge>
                      </div>
                    </>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <IconX size={12} />
                      Not found. You can still create this agent manually.
                    </Badge>
                  )}
                </CardContent>
              </Card>
            )}
          </section>

          <Separator />

          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold">License Verification</h3>
              <p className="text-xs text-muted-foreground">Provide NPN when available. Auto-verification runs after the profile is created.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block">NPN</Label>
                <Input value={npn} onChange={(e) => setNpn(e.target.value)} placeholder="National Producer Number" />
              </div>
              <div>
                <Label className="mb-1.5 block">License Number</Label>
                <Input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="Optional state license #" />
              </div>
            </div>
            <Card className="bg-card/50">
              <CardContent className="p-3 flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2">
                    <IconShieldCheck size={14} />
                    Auto-verify License
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {!state ? 'Select a state first' : canVerifyLicense ? 'Verify by NPN or name/state after creation' : 'Add NPN or name to verify'}
                  </p>
                </div>
                <Switch checked={autoVerify} onCheckedChange={setAutoVerify} disabled={!canVerifyLicense} />
              </CardContent>
            </Card>
          </section>

          <Separator />

          <section>
            <Label className="mb-1.5 block">Compensation Tier</Label>
            <Select value={compTierId || '_none'} onValueChange={(v) => setCompTierId(v === '_none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="No tier assigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">No tier assigned</SelectItem>
                {compTiers.map((tier) => (
                  <SelectItem key={tier.id} value={tier.id}>
                    {tier.name} — {tier.percentage}%
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting || !firstName.trim() || !lastName.trim() || !email.trim() || smsInviteNeedsPhone}
              className="min-w-[140px]"
            >
              {submitting ? (
                <>
                  <IconLoader2 size={14} className="animate-spin" />
                  Creating...
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
