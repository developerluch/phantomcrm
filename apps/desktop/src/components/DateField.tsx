import * as React from 'react'
import { format } from 'date-fns'
import { IconCalendar, IconX } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface DateFieldProps {
  value: Date | null
  onChange: (date: Date | null) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  clearable?: boolean
  fromDate?: Date
  toDate?: Date
}

export function DateField({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  className,
  clearable = true,
  fromDate,
  toDate,
}: DateFieldProps) {
  const [open, setOpen] = React.useState(false)

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    onChange(null)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <IconCalendar className="mr-2 h-4 w-4" />
          <span className="flex-1 truncate">
            {value ? format(value, 'PPP') : placeholder}
          </span>
          {clearable && value && !disabled ? (
            <span
              role="button"
              aria-label="Clear date"
              onClick={handleClear}
              className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted"
            >
              <IconX className="h-3 w-3" />
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value ?? undefined}
          onSelect={(d) => {
            onChange(d ?? null)
            setOpen(false)
          }}
          fromDate={fromDate}
          toDate={toDate}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

/**
 * Parse an ISO date string (YYYY-MM-DD) into a Date, or null.
 * Safe for uncontrolled forms where the stored value is a string.
 */
export function parseDateString(s: string | null | undefined): Date | null {
  if (!s) return null
  const [y, m, d] = s.split('-').map((p) => parseInt(p, 10))
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/**
 * Serialize a Date to ISO YYYY-MM-DD (timezone-agnostic, local wall clock).
 */
export function formatDateString(d: Date | null): string {
  if (!d) return ''
  return format(d, 'yyyy-MM-dd')
}
