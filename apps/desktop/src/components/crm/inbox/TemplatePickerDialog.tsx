import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useTemplates } from '@/hooks/useTemplates'
import type { Channel, MessageTemplate } from '@/types/portal'

interface TemplatePickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  channel: Channel
  onSubmit: (templateId: string, variables: Record<string, string>) => void
}

/** Pick an approved message template + fill in its variables. The list of
 *  approved templates comes from /crm/templates?status=approved&channel=...;
 *  variable inputs are rendered from the template's `variables` array. */
export function TemplatePickerDialog({
  open,
  onOpenChange,
  channel,
  onSubmit,
}: TemplatePickerDialogProps) {
  const { data, isLoading } = useTemplates({ channel, status: 'approved' })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [vars, setVars] = useState<Record<string, string>>({})

  const templates = data?.templates ?? []
  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId],
  )

  const handleSubmit = () => {
    if (!selected) return
    onSubmit(selected.id, vars)
    onOpenChange(false)
    setSelectedId(null)
    setVars({})
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Send a template</DialogTitle>
          <DialogDescription>
            Pick an approved {channel === 'whatsapp' ? 'WhatsApp' : channel} template and
            fill in its variables.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Templates
            </h3>
            <Command className="rounded-md border bg-card/30">
              <CommandInput placeholder="Search templates…" />
              <CommandList>
                {isLoading ? (
                  <div className="p-3 text-sm text-muted-foreground">Loading…</div>
                ) : templates.length === 0 ? (
                  <CommandEmpty>No approved templates yet.</CommandEmpty>
                ) : (
                  <CommandGroup>
                    {templates.map((t) => (
                      <CommandItem
                        key={t.id}
                        value={`${t.name} ${t.body}`}
                        onSelect={() => {
                          setSelectedId(t.id)
                          setVars(initialVars(t))
                        }}
                        className="flex flex-col items-start gap-1"
                      >
                        <span className="font-medium">{t.name}</span>
                        <span className="line-clamp-2 text-xs text-muted-foreground">
                          {t.body}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Variables
            </h3>
            {selected ? (
              <>
                <div className="rounded-md border bg-muted/30 p-3 text-xs">
                  {renderTemplatePreview(selected.body, vars)}
                </div>
                <Separator />
                {selected.variables.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    This template has no variables.
                  </p>
                ) : (
                  selected.variables.map((name) => (
                    <div key={name} className="space-y-1">
                      <label className="text-xs font-medium">{name}</label>
                      <Input
                        value={vars[name] ?? ''}
                        onChange={(e) =>
                          setVars((prev) => ({ ...prev, [name]: e.target.value }))
                        }
                      />
                    </div>
                  ))
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Select a template on the left.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="brand" onClick={handleSubmit} disabled={!selected}>
            Send template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function initialVars(t: MessageTemplate): Record<string, string> {
  return Object.fromEntries(t.variables.map((v) => [v, '']))
}

function renderTemplatePreview(body: string, vars: Record<string, string>): string {
  // Supports {{name}} placeholder syntax — empty values stay as the literal
  // {{name}} so the user sees what's missing.
  return body.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key: string) => {
    const v = vars[key]
    return v && v.length > 0 ? v : `{{${key}}}`
  })
}
