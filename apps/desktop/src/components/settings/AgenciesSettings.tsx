import { useState, useEffect } from 'react'
import { getAgencies, addAgency, removeAgency, getActiveAgencyId, setActiveAgency, type Agency } from '@/services/storage'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { IconBriefcase, IconPlus, IconTrash } from '@tabler/icons-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

export default function AgenciesSettings() {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    setAgencies(getAgencies())
    setActiveId(getActiveAgencyId())
  }, [])

  function handleAdd() {
    if (!newName.trim()) return
    addAgency(newName.trim())
    setAgencies(getAgencies())
    setActiveId(getActiveAgencyId())
    setNewName('')
    toast.success('Agency added')
  }

  function handleRemove(id: string) {
    removeAgency(id)
    setAgencies(getAgencies())
    setActiveId(getActiveAgencyId())
    toast.success('Agency removed')
  }

  function handleSetActive(id: string) {
    setActiveAgency(id)
    setActiveId(id)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Agencies</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your agencies and sub-teams</p>
      </div>

      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconBriefcase size={15} className="text-amber-400" />
            Agencies
          </CardTitle>
          <CardDescription className="text-xs">Add, remove, and switch between agencies</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new */}
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New agency name"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd} size="sm" variant="outline" disabled={!newName.trim()} className="shrink-0">
              <IconPlus size={14} className="mr-1" /> Add
            </Button>
          </div>

          {/* List */}
          {agencies.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No agencies yet</p>
          ) : (
            <div className="space-y-2">
              {agencies.map((agency) => (
                <div
                  key={agency.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/10 hover:bg-muted/20 transition-colors"
                >
                  <Button
                    variant="ghost"
                    onClick={() => handleSetActive(agency.id)}
                    className="flex-1 text-left h-auto p-0 justify-start"
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{agency.name}</p>
                      {activeId === agency.id && (
                        <Badge className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Active</Badge>
                      )}
                    </div>
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(agency.id)}
                        className="h-7 w-7 text-muted-foreground hover:text-red-400"
                      >
                        <IconTrash size={14} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Remove agency</TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
