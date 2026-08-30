import { Suspense, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconGripVertical, IconArrowsMaximize, IconChevronUp, IconDots, IconRefresh, IconTrash } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { useWidgetContext } from '@/contexts/WidgetContext'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

interface WidgetShellProps {
  id: string
  type: string
}

export function WidgetShell({ id, type }: WidgetShellProps) {
  const { registry, isEditing, removeWidget, addWidget, collapsed, toggleCollapse } = useWidgetContext()
  const definition = registry[type]
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const isCollapsed = id in collapsed

  if (!definition) return null

  const Component = definition.component
  const Icon = definition.icon

  const handleRemove = () => {
    removeWidget(id)
    toast('Widget removed', {
      action: {
        label: 'Undo',
        onClick: () => addWidget(type),
      },
      duration: 5000,
    })
  }

  const handleRefresh = () => {
    queryClient.invalidateQueries()
    toast.success('Refreshing data...')
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring' as const, stiffness: 300, damping: 24, mass: 0.8 }}
      className={`h-full w-full ${isCollapsed ? 'widget-collapsed' : ''}`}
    >
      <div className="bg-card/50 backdrop-blur border border-border/50 rounded-xl h-full flex flex-col overflow-hidden">
        {/* Widget header bar */}
        <div className={`widget-drag-handle flex-none flex items-center justify-between px-3 py-2 border-b border-border/30 ${isEditing ? 'cursor-grab active:cursor-grabbing' : ''}`}>
          <div className="flex items-center gap-2 min-w-0">
            {isEditing && (
              <IconGripVertical size={14} className="text-muted-foreground shrink-0" />
            )}
            <Icon size={16} className="text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-foreground truncate">{definition.title}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => toggleCollapse(id)}
              aria-label={isCollapsed ? 'Expand widget' : 'Collapse widget'}
            >
              <IconChevronUp
                size={14}
                className={`transition-transform duration-150 ${isCollapsed ? 'rotate-180' : ''}`}
              />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpanded(true)} aria-label={`Expand ${definition.title}`}>
              <IconArrowsMaximize size={14} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <IconDots size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleRefresh}>
                  <IconRefresh size={14} className="mr-2" /> Refresh
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRemove} className="text-destructive">
                  <IconTrash size={14} className="mr-2" /> Remove Widget
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Widget content — flex-1 fills remaining height */}
        <AnimatePresence initial={false}>
          {!isCollapsed && (
            <motion.div
              key="content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="flex-1 min-h-0 overflow-hidden"
            >
              <div className="h-full p-3 overflow-auto">
                <Suspense fallback={<div className="h-full w-full rounded-xl bg-muted/50 animate-pulse" />}>
                  <Component />
                </Suspense>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Expand dialog — portaled, doesn't affect layout */}
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] h-[80vh]">
          <div className="flex items-center gap-2 mb-4">
            <Icon size={20} className="text-muted-foreground" />
            <h2 className="text-lg font-semibold">{definition.title}</h2>
          </div>
          <div className="flex-1 overflow-auto">
            <Suspense fallback={<div className="h-full rounded-xl bg-muted/50 animate-pulse" />}>
              <Component />
            </Suspense>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
