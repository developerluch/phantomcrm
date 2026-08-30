import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { IconPalette } from '@tabler/icons-react'
import { useCalendarSettingsStore } from '@/store/calendar-settings-store'
import type { EventCategory } from '@/components/calendar/constants'
import { DEFAULT_EVENT_CATEGORY_COLORS, EVENT_CATEGORY_LABELS } from '@/components/calendar/constants'

const COLOR_SWATCHES = [
  '#7DD3FC', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ec4899', '#06b6d4', '#f97316', '#a855f7', '#ef4444',
  '#64748b', '#6366f1', '#14b8a6', '#f43f5e', '#0ea5e9',
]

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/

export default function CalendarColorSettings() {
  const { eventColors, setEventColor, resetColors } = useCalendarSettingsStore()
  const [hexInput, setHexInput] = useState('')
  const [editingCategory, setEditingCategory] = useState<EventCategory | null>(null)

  const categories = Object.keys(DEFAULT_EVENT_CATEGORY_COLORS) as EventCategory[]

  function handleSwatchClick(category: EventCategory, color: string) {
    setEventColor(category, color)
  }

  function handleHexBlur(category: EventCategory) {
    const value = hexInput.startsWith('#') ? hexInput : `#${hexInput}`
    if (HEX_REGEX.test(value)) {
      setEventColor(category, value)
    }
    setHexInput('')
  }

  function handlePopoverOpen(category: EventCategory) {
    setEditingCategory(category)
    setHexInput(eventColors[category])
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Calendar Colors</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Customize event category colors
        </p>
      </div>

      <Card className="relative overflow-hidden" style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconPalette size={16} className="text-primary" />
            Event Categories
          </CardTitle>
          <CardDescription className="text-xs">
            Click a color swatch to change the category color
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {categories.map((category) => {
            const color = eventColors[category]
            return (
              <div
                key={category}
                className="flex items-center justify-between py-2 px-1 rounded-lg hover:bg-white/[0.03] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm text-foreground">
                    {EVENT_CATEGORY_LABELS[category]}
                  </span>
                </div>
                <Popover onOpenChange={(open) => open && handlePopoverOpen(category)}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 w-14 px-2 gap-1.5">
                      <span
                        className="w-3.5 h-3.5 rounded border border-white/10"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {color.slice(0, 7)}
                      </span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-56 p-3">
                    <div className="grid grid-cols-5 gap-1.5 mb-3">
                      {COLOR_SWATCHES.map((swatch) => (
                        <Button
                          key={swatch}
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 rounded-lg ${color === swatch ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}`}
                          onClick={() => handleSwatchClick(category, swatch)}
                        >
                          <span
                            className="w-5 h-5 rounded"
                            style={{ backgroundColor: swatch }}
                          />
                        </Button>
                      ))}
                    </div>
                    <Separator className="mb-3" />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">#</span>
                      <Input
                        value={editingCategory === category ? hexInput.replace('#', '') : color.replace('#', '')}
                        onChange={(e) => setHexInput(`#${e.target.value}`)}
                        onBlur={() => handleHexBlur(category)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleHexBlur(category)
                        }}
                        className="h-7 text-xs font-mono"
                        maxLength={6}
                        placeholder="3b82f6"
                      />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Button variant="outline" size="sm" onClick={resetColors} className="gap-1.5">
        <IconPalette size={14} />
        Reset to Defaults
      </Button>
    </div>
  )
}
