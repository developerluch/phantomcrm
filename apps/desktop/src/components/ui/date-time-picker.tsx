import * as React from 'react'
import { format } from 'date-fns'
import { IconCalendarEvent } from '@tabler/icons-react'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface DateTimePickerProps {
  value: Date | undefined
  onChange: (date: Date | undefined) => void
  placeholder?: string
  className?: string
}

function DateTimePicker({ value, onChange, placeholder = 'Pick a date & time', className }: DateTimePickerProps) {
  const hours = Array.from({ length: 12 }, (_, i) => i + 1)
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

  const currentHour = value ? (value.getHours() % 12 || 12) : 12
  const currentMinute = value ? value.getMinutes() : 0
  const currentAmPm = value ? (value.getHours() >= 12 ? 'PM' : 'AM') : 'AM'

  // Snap minute to nearest 5-min increment for display
  const displayMinute = Math.round(currentMinute / 5) * 5

  function updateTime(hour?: number, minute?: number, amPm?: string) {
    const base = value ?? new Date()
    const newDate = new Date(base)
    const h = hour ?? currentHour
    const m = minute ?? currentMinute
    const ap = amPm ?? currentAmPm
    let hour24 = h === 12 ? 0 : h
    if (ap === 'PM') hour24 += 12
    newDate.setHours(hour24, m, 0, 0)
    onChange(newDate)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <IconCalendarEvent size={14} className="mr-2 shrink-0" />
          {value ? format(value, 'MM/dd/yyyy, hh:mm a') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" side="top" sideOffset={8} collisionPadding={16} avoidCollisions>
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            if (date && value) {
              date.setHours(value.getHours(), value.getMinutes(), 0, 0)
            } else if (date) {
              date.setHours(12, 0, 0, 0)
            }
            onChange(date)
          }}
          initialFocus
        />
        <Separator />
        <div className="flex items-center gap-2 p-3">
          <Select value={String(currentHour)} onValueChange={(v) => updateTime(Number(v))}>
            <SelectTrigger className="w-[68px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {hours.map((h) => (
                <SelectItem key={h} value={String(h)}>
                  {String(h).padStart(2, '0')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-sm">:</span>
          <Select value={String(displayMinute)} onValueChange={(v) => updateTime(undefined, Number(v))}>
            <SelectTrigger className="w-[68px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {minutes.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {String(m).padStart(2, '0')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={currentAmPm} onValueChange={(v) => updateTime(undefined, undefined, v)}>
            <SelectTrigger className="w-[68px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AM">AM</SelectItem>
              <SelectItem value="PM">PM</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  )
}
DateTimePicker.displayName = 'DateTimePicker'

export { DateTimePicker }
export type { DateTimePickerProps }
