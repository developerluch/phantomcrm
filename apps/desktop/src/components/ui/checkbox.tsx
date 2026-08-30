import * as React from 'react'
import { IconCheck } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, onChange, ...props }, ref) => (
    <div className="relative">
      <input
        type="checkbox"
        ref={ref}
        onChange={(e) => {
          onChange?.(e)
          onCheckedChange?.(e.target.checked)
        }}
        className="hidden"
        {...props}
      />
      <button
        type="button"
        role="checkbox"
        aria-checked={props.checked}
        disabled={props.disabled}
        onClick={() => {
          const newChecked = !props.checked
          onCheckedChange?.(newChecked as boolean)
        }}
        className={cn(
          'inline-flex items-center justify-center h-4 w-4 shrink-0 rounded border border-border bg-background transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'disabled:cursor-not-allowed disabled:opacity-50',
          props.checked && 'bg-primary border-primary text-primary-foreground',
          className
        )}
      >
        {props.checked && <IconCheck size={14} />}
      </button>
    </div>
  )
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }
