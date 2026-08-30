import { IconFlask } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { isMockMode, disableMockMode } from './sales-mock-mode'

export default function MockModeBanner() {
  if (!isMockMode()) return null

  const handleDisable = () => {
    disableMockMode()
    window.location.reload()
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-200">
      <div className="flex items-center gap-2">
        <IconFlask size={16} className="shrink-0" />
        <span className="text-xs">
          Mock mode ON — Book of Business is reading from local fixtures. Backend endpoints arrive in a separate session.
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDisable}
        className="h-7 text-xs text-amber-200 hover:bg-amber-500/20 hover:text-amber-100"
      >
        Disable
      </Button>
    </div>
  )
}
