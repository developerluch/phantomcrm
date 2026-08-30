import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { IconCopy, IconShare } from '@tabler/icons-react'
import { toast } from 'sonner'

interface QuickSharePopoverProps {
  bookingUrl: string
  children: React.ReactNode
}

export default function QuickSharePopover({ bookingUrl, children }: QuickSharePopoverProps) {
  function handleCopy() {
    navigator.clipboard.writeText(bookingUrl)
    toast.success('Booking link copied!')
  }

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <IconShare size={12} className="text-primary" />
            Share Booking Link
          </p>
          <div className="flex gap-1.5">
            <Input
              readOnly
              value={bookingUrl}
              className="text-xs h-8 bg-muted/10"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <Button variant="outline" size="sm" className="h-8 px-2 shrink-0" onClick={handleCopy}>
              <IconCopy size={12} />
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
