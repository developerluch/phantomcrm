import { useState } from 'react'
import { IconCalendar } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { useDateStore, type PresetPeriod } from '../../store/date-store'
import { format, parseISO } from 'date-fns'

const PRESETS: { value: PresetPeriod; label: string }[] = [
  { value: 'this-week', label: 'This Week' },
  { value: 'last-week', label: 'Last Week' },
  { value: 'this-month', label: 'This Month' },
  { value: 'last-month', label: 'Last Month' },
  { value: 'this-quarter', label: 'This Quarter' },
  { value: 'this-year', label: 'This Year' },
]

function formatShort(iso: string) {
  return format(parseISO(iso), 'MMM d')
}

export function DashboardDateBar() {
  const { preset, current, comparison, setPreset, setCustomRange } = useDateStore()
  const [customFrom, setCustomFrom] = useState(current.from)
  const [customTo, setCustomTo] = useState(current.to)
  const [compFrom, setCompFrom] = useState(comparison.from)
  const [compTo, setCompTo] = useState(comparison.to)

  function applyCustom() {
    setCustomRange(
      { from: customFrom, to: customTo },
      { from: compFrom, to: compTo }
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Preset quick buttons */}
      {PRESETS.map((p) => (
        <Button
          key={p.value}
          variant={preset === p.value ? 'default' : 'ghost'}
          size="sm"
          className={`h-7 text-xs px-3 ${
            preset === p.value
              ? 'bg-foreground text-background hover:bg-foreground/90'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setPreset(p.value)}
        >
          {p.label}
        </Button>
      ))}

      {/* Custom date picker */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={preset === 'custom' ? 'default' : 'ghost'}
            size="sm"
            className={`h-7 text-xs px-3 gap-1.5 ${
              preset === 'custom'
                ? 'bg-foreground text-background hover:bg-foreground/90'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <IconCalendar size={13} /> Custom
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Current Period</label>
              <div className="flex items-center gap-2">
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 text-xs" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <Separator />
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Comparison Period</label>
              <div className="flex items-center gap-2">
                <Input type="date" value={compFrom} onChange={(e) => setCompFrom(e.target.value)} className="h-8 text-xs" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="date" value={compTo} onChange={(e) => setCompTo(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <Button variant="default" size="sm" className="w-full h-8 text-xs" onClick={applyCustom}>
              Apply Range
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active range label */}
      <Badge variant="outline" className="ml-auto text-[10px] gap-1 border-border/30 text-muted-foreground">
        <IconCalendar size={10} />
        {formatShort(current.from)} – {formatShort(current.to)}
      </Badge>
    </div>
  )
}
