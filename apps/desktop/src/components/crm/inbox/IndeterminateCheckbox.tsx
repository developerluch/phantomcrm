import { IconMinus } from '@tabler/icons-react'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

export type TriState = boolean | 'indeterminate'

interface IndeterminateCheckboxProps {
  checked: TriState
  onCheckedChange: (next: boolean) => void
  className?: string
  disabled?: boolean
  'aria-label'?: string
}

// Tri-state checkbox composed from the shared Checkbox primitive without
// modifying it. When indeterminate, renders an IconMinus overlay; exposes
// aria-checked="mixed" on the wrapping span. Clicking indeterminate selects
// all; clicking checked deselects all.
export function IndeterminateCheckbox({
  checked,
  onCheckedChange,
  className,
  disabled,
  'aria-label': ariaLabel,
}: IndeterminateCheckboxProps) {
  const isIndeterminate = checked === 'indeterminate'
  const isChecked = checked === true
  return (
    <span
      className={cn('relative inline-flex items-center justify-center', className)}
      role="checkbox"
      aria-checked={isIndeterminate ? 'mixed' : isChecked}
      aria-label={ariaLabel}
    >
      <Checkbox
        checked={isChecked}
        disabled={disabled}
        onCheckedChange={() => onCheckedChange(!isChecked)}
        aria-hidden
        tabIndex={-1}
      />
      {isIndeterminate && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <IconMinus size={12} className="text-primary-foreground" />
        </span>
      )}
    </span>
  )
}
