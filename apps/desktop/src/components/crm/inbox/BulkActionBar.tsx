import { Button } from '@/components/ui/button'
import { IndeterminateCheckbox, type TriState } from './IndeterminateCheckbox'

interface BulkActionBarProps {
  selectedCount: number
  totalVisible: number
  selectAllState: TriState
  onToggleSelectAll: () => void
  onClearSelection: () => void
}

export function BulkActionBar({
  selectedCount,
  totalVisible,
  selectAllState,
  onToggleSelectAll,
  onClearSelection,
}: BulkActionBarProps) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/50 bg-card/40 px-2 py-1.5 backdrop-blur">
      <IndeterminateCheckbox
        checked={selectAllState}
        onCheckedChange={onToggleSelectAll}
        aria-label="Select all visible threads"
      />
      <span className="text-xs text-muted-foreground">
        {selectedCount} of {totalVisible} selected
      </span>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onClearSelection}>
          Clear
        </Button>
      </div>
    </div>
  )
}
