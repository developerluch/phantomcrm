import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent } from '@/components/ui/card'
import { IconPlus, IconTrash } from '@tabler/icons-react'
import type { ContactAddress } from '@/types/portal'

const ADDRESS_KINDS: ContactAddress['kind'][] = ['mailing', 'home', 'work', 'prior', 'policy']

type Draft = Partial<ContactAddress> & { _local?: string }

interface AddressRepeaterProps {
  addresses: Draft[]
  onChange: (next: Draft[]) => void
}

export function AddressRepeater({ addresses, onChange }: AddressRepeaterProps) {
  function update(idx: number, patch: Partial<Draft>) {
    const next = addresses.map((a, i) => (i === idx ? { ...a, ...patch } : a))
    onChange(next)
  }

  function remove(idx: number) {
    onChange(addresses.filter((_, i) => i !== idx))
  }

  function add() {
    onChange([
      ...addresses,
      {
        _local: crypto.randomUUID(),
        kind: 'mailing',
        country: 'US',
        isPrimary: addresses.length === 0,
      },
    ])
  }

  function setPrimary(idx: number) {
    onChange(addresses.map((a, i) => ({ ...a, isPrimary: i === idx })))
  }

  return (
    <div className="space-y-3">
      {addresses.length === 0 && (
        <p className="text-sm text-muted-foreground">No addresses on file.</p>
      )}
      {addresses.map((addr, idx) => (
        <Card key={addr.id ?? addr._local ?? idx} className="bg-card/30 backdrop-blur">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="w-[140px]">
                <Label className="text-xs">Kind</Label>
                <Select
                  value={addr.kind ?? 'mailing'}
                  onValueChange={(v) => update(idx, { kind: v as ContactAddress['kind'] })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ADDRESS_KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {k}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!addr.isPrimary}
                  onCheckedChange={(checked) => checked && setPrimary(idx)}
                />
                <span className="text-xs text-muted-foreground">Primary</span>
                <Button variant="ghost" size="icon" onClick={() => remove(idx)}>
                  <IconTrash size={14} />
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs">Line 1</Label>
              <Input
                value={addr.line1 ?? ''}
                onChange={(e) => update(idx, { line1: e.target.value })}
                placeholder="123 Main St"
              />
            </div>

            <div>
              <Label className="text-xs">Line 2</Label>
              <Input
                value={addr.line2 ?? ''}
                onChange={(e) => update(idx, { line2: e.target.value })}
                placeholder="Apt / Suite / Unit (optional)"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">City</Label>
                <Input
                  value={addr.city ?? ''}
                  onChange={(e) => update(idx, { city: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">State</Label>
                <Input
                  value={addr.state ?? ''}
                  onChange={(e) => update(idx, { state: e.target.value })}
                  maxLength={2}
                />
              </div>
              <div>
                <Label className="text-xs">Postal</Label>
                <Input
                  value={addr.postalCode ?? ''}
                  onChange={(e) => update(idx, { postalCode: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <IconPlus size={14} className="mr-1" /> Add address
      </Button>
    </div>
  )
}
