import { forwardRef, type ElementType, type InputHTMLAttributes, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'

type GlassInputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon: ElementType
  rightSlot?: ReactNode
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(function GlassInput(
  { icon: Icon, type = 'text', rightSlot, className, ...props },
  ref,
) {
  return (
    <div className="group relative flex items-center rounded-lg border border-border/50 bg-white/[0.02] backdrop-blur transition-all focus-within:border-[#7DD3FC]/40 focus-within:ring-2 focus-within:ring-[#7DD3FC]/15 focus-within:bg-white/[0.04]">
      <Icon
        size={16}
        className="absolute left-3 text-muted-foreground/60 group-focus-within:text-[#7DD3FC] transition-colors pointer-events-none"
      />
      <Input
        ref={ref}
        type={type}
        className={
          'border-0 bg-transparent pl-9 h-10 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm ' +
          (rightSlot ? 'pr-10 ' : '') +
          (className ?? '')
        }
        {...props}
      />
      {rightSlot && <div className="absolute right-1.5">{rightSlot}</div>}
    </div>
  )
})
