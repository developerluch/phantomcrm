import * as React from 'react'
import { Input } from './input'

interface CurrencyInputProps {
  value: number | undefined
  onChange: (value: number) => void
  placeholder?: string
  className?: string
}

export function CurrencyInput({ value, onChange, placeholder = '$0.00', className }: CurrencyInputProps) {
  const [display, setDisplay] = React.useState('')
  const isFocused = React.useRef(false)

  // Only sync display from external value changes (NOT during active typing)
  React.useEffect(() => {
    if (isFocused.current) return
    if (value !== undefined && value > 0) {
      setDisplay(formatCurrency(value))
    } else if (value === 0 || value === undefined) {
      setDisplay('')
    }
  }, [value])

  function formatCurrency(num: number): string {
    return '$' + num.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9.]/g, '')
    // Prevent multiple dots
    const parts = raw.split('.')
    const cleaned = parts[0] + (parts.length > 1 ? '.' + parts[1].slice(0, 2) : '')
    const num = parseFloat(cleaned) || 0

    if (cleaned) {
      const intPart = Number(parts[0]).toLocaleString('en-US')
      const decPart = parts.length > 1 ? '.' + parts[1].slice(0, 2) : ''
      setDisplay('$' + intPart + decPart)
    } else {
      setDisplay('')
    }
    onChange(num)
  }

  function handleFocus() {
    isFocused.current = true
  }

  function handleBlur() {
    isFocused.current = false
    if (value && value > 0) {
      setDisplay(formatCurrency(value))
    } else {
      setDisplay('')
    }
  }

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
    />
  )
}
