import { format, parseISO } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { IconPlus, IconTrash, IconCalendar } from '@tabler/icons-react'
import type { FilterOp, FilterRule, SmartListFilter } from '@/types/portal'
import { LIFECYCLE_STAGES, LIFECYCLE_STAGE_LABELS, isFilterGroup } from '@/types/portal'
import { cn } from '@/lib/utils'

const MAX_RULES = 10

interface FilterBuilderProps {
  value: SmartListFilter
  onChange: (next: SmartListFilter) => void
}

interface FieldDef {
  id: string
  label: string
  ops: FilterOp[]
  input?: 'text' | 'enum' | 'boolean' | 'date'
  enumOptions?: { value: string; label: string }[]
}

const FIELDS: FieldDef[] = [
  { id: 'firstName', label: 'First name', ops: ['eq', 'neq', 'contains', 'startsWith'], input: 'text' },
  { id: 'lastName', label: 'Last name', ops: ['eq', 'neq', 'contains', 'startsWith'], input: 'text' },
  { id: 'fullName', label: 'Full name', ops: ['contains', 'startsWith'], input: 'text' },
  { id: 'email', label: 'Email', ops: ['eq', 'neq', 'contains', 'startsWith', 'endsWith', 'exists'], input: 'text' },
  { id: 'phone', label: 'Phone', ops: ['eq', 'neq', 'contains'], input: 'text' },
  {
    id: 'lifecycleStage',
    label: 'Lifecycle stage',
    ops: ['eq', 'neq', 'in', 'nin'],
    input: 'enum',
    enumOptions: LIFECYCLE_STAGES.map((s) => ({ value: s, label: LIFECYCLE_STAGE_LABELS[s] })),
  },
  {
    id: 'status',
    label: 'Status',
    ops: ['eq', 'neq'],
    input: 'enum',
    enumOptions: [
      { value: 'active', label: 'Active' },
      { value: 'archived', label: 'Archived' },
      { value: 'do_not_contact', label: 'Do not contact' },
    ],
  },
  { id: 'ownerAgentDiscordId', label: 'Owner (discord id)', ops: ['eq', 'neq', 'exists'], input: 'text' },
  { id: 'sourceType', label: 'Source type', ops: ['eq', 'neq', 'in'], input: 'text' },
  { id: 'tags', label: 'Tag', ops: ['hasTag', 'lacksTag'], input: 'text' },
  { id: 'address.state', label: 'Address state', ops: ['eq', 'neq', 'in'], input: 'text' },
  { id: 'address.city', label: 'Address city', ops: ['eq', 'contains', 'startsWith'], input: 'text' },
  { id: 'dob', label: 'Date of birth', ops: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'exists'], input: 'date' },
  { id: 'createdAt', label: 'Created', ops: ['gt', 'gte', 'lt', 'lte'], input: 'date' },
  { id: 'updatedAt', label: 'Updated', ops: ['gt', 'gte', 'lt', 'lte'], input: 'date' },
  { id: 'lastActivityAt', label: 'Last activity', ops: ['gt', 'gte', 'lt', 'lte', 'exists'], input: 'date' },
]

const OP_LABELS: Record<FilterOp, string> = {
  eq: 'equals',
  neq: 'not equals',
  in: 'is one of',
  nin: 'is not one of',
  contains: 'contains',
  startsWith: 'starts with',
  endsWith: 'ends with',
  matches: 'matches',
  exists: 'has value',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  between: 'between',
  hasTag: 'has tag',
  lacksTag: 'lacks tag',
}

export function FilterBuilder({ value, onChange }: FilterBuilderProps) {
  // v1: flatten any nested groups; the builder itself exposes only one level.
  const flatRules = value.rules.filter((r): r is FilterRule => !isFilterGroup(r))

  function updateRule(idx: number, patch: Partial<FilterRule>) {
    const next = flatRules.map((r, i) => (i === idx ? { ...r, ...patch } : r))
    onChange({ combinator: value.combinator, rules: next })
  }

  function removeRule(idx: number) {
    const next = flatRules.filter((_, i) => i !== idx)
    onChange({ combinator: value.combinator, rules: next })
  }

  function addRule() {
    if (flatRules.length >= MAX_RULES) return
    const first = FIELDS[0]
    const rule: FilterRule = { field: first.id, op: first.ops[0], value: '' }
    onChange({ combinator: value.combinator, rules: [...flatRules, rule] })
  }

  function setCombinator(c: 'and' | 'or') {
    onChange({ combinator: c, rules: flatRules })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Tabs value={value.combinator} onValueChange={(v) => setCombinator(v as 'and' | 'or')}>
          <TabsList>
            <TabsTrigger value="and">Match ALL</TabsTrigger>
            <TabsTrigger value="or">Match ANY</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="text-xs text-muted-foreground ml-auto">
          {flatRules.length} / {MAX_RULES} rules
        </div>
      </div>

      <div className="space-y-2">
        {flatRules.map((rule, idx) => {
          const def = FIELDS.find((f) => f.id === rule.field) ?? FIELDS[0]
          const allowedOps = def.ops
          return (
            <Card key={idx} className="bg-card/30 backdrop-blur">
              <CardContent className="p-3 flex items-center gap-2">
                <Select
                  value={rule.field}
                  onValueChange={(v) => {
                    const nextDef = FIELDS.find((f) => f.id === v) ?? FIELDS[0]
                    updateRule(idx, { field: v, op: nextDef.ops[0], value: '' })
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FIELDS.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={rule.op} onValueChange={(v) => updateRule(idx, { op: v as FilterOp })}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedOps.map((op) => (
                      <SelectItem key={op} value={op}>
                        {OP_LABELS[op]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {rule.op !== 'exists' && (
                  <FilterValueInput
                    def={def}
                    op={rule.op}
                    value={rule.value}
                    onChange={(v) => updateRule(idx, { value: v })}
                  />
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-auto"
                  onClick={() => removeRule(idx)}
                >
                  <IconTrash size={14} />
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={addRule}
        disabled={flatRules.length >= MAX_RULES}
      >
        <IconPlus size={14} className="mr-1" /> Add rule
      </Button>
    </div>
  )
}

function FilterValueInput({
  def,
  op,
  value,
  onChange,
}: {
  def: FieldDef
  op: FilterOp
  value: unknown
  onChange: (v: unknown) => void
}) {
  // Dates use Popover + Calendar per spec §2.10.
  if (def.input === 'date') {
    const parsed = typeof value === 'string' && value ? parseIsoSafe(value) : undefined
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              'flex-1 justify-start text-left font-normal',
              !parsed && 'text-muted-foreground',
            )}
          >
            <IconCalendar size={14} className="mr-2" />
            {parsed ? format(parsed, 'PP') : 'Pick a date'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={parsed}
            onSelect={(d) => onChange(d ? format(d, 'yyyy-MM-dd') : '')}
          />
        </PopoverContent>
      </Popover>
    )
  }

  if (def.input === 'enum' && def.enumOptions) {
    if (op === 'in' || op === 'nin') {
      // v1: comma-separated. v2 could be multi-select.
      const arr = Array.isArray(value) ? (value as string[]) : []
      return (
        <Input
          value={arr.join(',')}
          onChange={(e) =>
            onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
          }
          placeholder={def.enumOptions.map((o) => o.value).join(', ')}
        />
      )
    }
    return (
      <Select value={String(value ?? '')} onValueChange={onChange}>
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent>
          {def.enumOptions.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (op === 'in' || op === 'nin') {
    const arr = Array.isArray(value) ? (value as string[]) : []
    return (
      <Input
        value={arr.join(',')}
        onChange={(e) =>
          onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
        }
        placeholder="value1, value2, …"
      />
    )
  }

  return (
    <Input
      value={typeof value === 'string' ? value : value == null ? '' : String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder="value"
      className="flex-1"
    />
  )
}

function parseIsoSafe(s: string): Date | undefined {
  try {
    const d = parseISO(s)
    return isNaN(d.getTime()) ? undefined : d
  } catch {
    return undefined
  }
}
