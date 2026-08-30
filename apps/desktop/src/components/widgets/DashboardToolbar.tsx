import { useState } from 'react'
import {
  IconPlus,
  IconRefresh,
  IconLayoutDashboard,
  IconLayoutNavbarCollapse,
  IconLayoutNavbarExpand,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { useWidgetContext } from '@/contexts/WidgetContext'
import { AddWidgetDrawer } from './AddWidgetDrawer'

export function DashboardToolbar() {
  const {
    isEditing,
    setEditing,
    resetToDefault,
    widgets,
    collapsed,
    collapseAll,
    expandAll,
  } = useWidgetContext()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const allCollapsed = widgets.length > 0 && widgets.every((w) => w.id in collapsed)

  return (
    <>
      <div className="flex items-center gap-2">
        {isEditing && (
          <>
            <Button variant="outline" size="sm" onClick={() => setDrawerOpen(true)}>
              <IconPlus size={14} className="mr-1.5" /> Add Widget
            </Button>
            <Button variant="outline" size="sm" onClick={resetToDefault}>
              <IconRefresh size={14} className="mr-1.5" /> Reset
            </Button>
          </>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => (allCollapsed ? expandAll() : collapseAll())}
        >
          {allCollapsed ? (
            <>
              <IconLayoutNavbarExpand size={14} className="mr-1.5" /> Expand all
            </>
          ) : (
            <>
              <IconLayoutNavbarCollapse size={14} className="mr-1.5" /> Collapse all
            </>
          )}
        </Button>
        <Button
          variant={isEditing ? 'default' : 'outline'}
          size="sm"
          onClick={() => setEditing(!isEditing)}
        >
          <IconLayoutDashboard size={14} className="mr-1.5" /> {isEditing ? 'Done' : 'Customize'}
        </Button>
      </div>
      <AddWidgetDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  )
}
