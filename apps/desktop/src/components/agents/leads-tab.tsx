import { useState } from 'react'
import { useAgentLeads, useCreateAgentLead, useUpdateAgentLead, useDeleteAgentLead } from '../../hooks/useAgentLeads'
import { LEAD_STATUSES } from '../../types/portal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { IconPlus, IconTrash, IconLoader2 } from '@tabler/icons-react'
import { toast } from 'sonner'

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  contacted: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  interested: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  converted: 'bg-green-500/20 text-green-400 border-green-500/30',
  lost: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export function LeadsTab({ agentId }: { agentId: string }) {
  const { data: leads, isLoading } = useAgentLeads(agentId)
  const createLead = useCreateAgentLead()
  const updateLead = useUpdateAgentLead()
  const deleteLead = useDeleteAgentLead()

  const [showForm, setShowForm] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [source, setSource] = useState('')

  function handleCreate() {
    if (!firstName.trim() || !lastName.trim()) return
    createLead.mutate(
      {
        agentId,
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email || undefined,
          phone: phone || undefined,
          source: source || undefined,
        },
      },
      {
        onSuccess: () => {
          toast.success('Lead created')
          setFirstName('')
          setLastName('')
          setEmail('')
          setPhone('')
          setSource('')
          setShowForm(false)
        },
        onError: () => toast.error('Failed to create lead'),
      }
    )
  }

  function handleStatusChange(leadId: string, status: string) {
    updateLead.mutate(
      { agentId, leadId, data: { status } },
      {
        onSuccess: () => toast.success('Status updated'),
        onError: () => toast.error('Failed to update status'),
      }
    )
  }

  function handleDelete(leadId: string) {
    if (!confirm('Delete this lead?')) return
    deleteLead.mutate(
      { agentId, leadId },
      {
        onSuccess: () => toast.success('Lead deleted'),
        onError: () => toast.error('Failed to delete lead'),
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{leads?.length ?? 0} lead{(leads?.length ?? 0) !== 1 ? 's' : ''}</p>
        <Button onClick={() => setShowForm(!showForm)} variant="outline" size="sm" className="flex items-center gap-1">
          <IconPlus size={14} />
          Add Lead
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-border/50 bg-popover p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" />
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
            <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source" className="col-span-2" />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} variant="gradient" size="sm" disabled={!firstName.trim() || !lastName.trim() || createLead.isPending}>
              {createLead.isPending ? 'Creating...' : 'Create'}
            </Button>
            <Button onClick={() => setShowForm(false)} variant="outline" size="sm">Cancel</Button>
          </div>
        </div>
      )}

      {!leads || leads.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-popover p-12 text-center">
          <p className="text-muted-foreground">No leads yet. Click "Add Lead" to create one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => (
            <div key={lead.id} className="rounded-xl border border-border/50 bg-popover p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {lead.firstName} {lead.lastName}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {lead.email && <span className="text-xs text-muted-foreground truncate">{lead.email}</span>}
                    {lead.phone && <span className="text-xs text-muted-foreground">{lead.phone}</span>}
                  </div>
                  {lead.source && (
                    <span className="text-xs text-muted-foreground mt-0.5 block">Source: {lead.source}</span>
                  )}
                </div>

                <Select value={lead.status} onValueChange={(val) => handleStatusChange(lead.id, val)}>
                  <SelectTrigger className="h-7 w-28 text-xs px-2 py-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="text-xs">{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Badge className={STATUS_COLORS[lead.status] ?? 'bg-slate-500/20 text-muted-foreground'}>
                  {lead.status}
                </Badge>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(lead.id)}
                  className="h-7 w-7 text-muted-foreground hover:text-red-400"
                >
                  <IconTrash size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
