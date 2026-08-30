import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useAuthStore } from '../store'
import { WidgetGrid } from '../components/widgets/WidgetGrid'
import { DashboardToolbar } from '../components/widgets/DashboardToolbar'
import { WidgetProvider } from '@/contexts/WidgetContext'
import { useLayoutStore } from '@/store/layout-store'
import { usePolicyLayoutStore } from '@/store/policy-layout-store'
import { widgetRegistry } from '@/lib/widget-registry'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24, mass: 0.8 } },
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

export default function DashboardPage() {
  const user = useAuthStore(s => s.user)
  const store = useLayoutStore()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0, rootMargin: '0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Phase 7 — clean up orphaned `isEditing` flag from a previous force-quit.
  // Zustand persist middleware's hydration is async, but since we call
  // `setEditing(false)` via the store's action (not via re-setting persisted
  // fields), this is safe to run on mount regardless of hydration order.
  useEffect(() => {
    const layoutEditing = useLayoutStore.getState().isEditing
    const policyEditing = usePolicyLayoutStore.getState().isEditing
    if (layoutEditing || policyEditing) {
      if (layoutEditing) useLayoutStore.getState().setEditing(false)
      if (policyEditing) usePolicyLayoutStore.getState().setEditing(false)
      toast.info('Exited edit mode from previous session')
    }
  }, [])

  // Phase 7 — handle Electron window close while in edit mode.
  // Main fires `confirm-close` on window close (after preventDefault); we
  // either let it through immediately or open the AlertDialog so the user
  // can Discard / Stay / Save.
  useEffect(() => {
    const api = typeof window !== 'undefined' ? window.electronAPI : undefined
    if (!api?.onConfirmClose) return
    const unsubscribe = api.onConfirmClose(() => {
      const editing =
        useLayoutStore.getState().isEditing ||
        usePolicyLayoutStore.getState().isEditing
      if (!editing) {
        void api.respondToCloseConfirm?.(true)
        return
      }
      setCloseDialogOpen(true)
    })
    return () => {
      unsubscribe?.()
    }
  }, [])

  const respondClose = (shouldClose: boolean) => {
    void window.electronAPI?.respondToCloseConfirm?.(shouldClose)
  }

  const handleDiscard = () => {
    useLayoutStore.getState().setEditing(false)
    usePolicyLayoutStore.getState().setEditing(false)
    setCloseDialogOpen(false)
    respondClose(true)
  }

  const handleStay = () => {
    setCloseDialogOpen(false)
    respondClose(false)
  }

  // No explicit "save current layout" action exists — layouts are persisted
  // on every updateLayouts call via zustand/persist, so "Save" here means
  // "commit the current edit state and close": clear editing flags, allow close.
  const handleSave = () => {
    useLayoutStore.getState().setEditing(false)
    usePolicyLayoutStore.getState().setEditing(false)
    setCloseDialogOpen(false)
    respondClose(true)
  }

  return (
    <WidgetProvider value={{ ...store, registry: widgetRegistry }}>
      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        <div ref={sentinelRef} aria-hidden className="h-px -mb-px" />
        {/* Title Row — title left, toolbar buttons right (same line) */}
        <motion.div
          variants={itemVariants}
          className={cn(
            'flex items-center justify-between sticky top-0 z-30',
            'bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60',
            'border-b border-border/40 -mx-6 px-6 pt-4 pb-4 mb-5',
            'transition-shadow duration-200',
            scrolled && 'shadow-[0_4px_12px_-6px_rgba(0,0,0,0.4)]',
          )}
        >
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Good {getTimeOfDay()}, {user?.displayName || user?.email?.split('@')[0] || 'there'}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Here&apos;s what&apos;s happening across your agency
            </p>
          </div>
          <DashboardToolbar />
        </motion.div>

        {/* Widget Grid */}
        <motion.div variants={itemVariants}>
          <WidgetGrid />
        </motion.div>
      </motion.div>

      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You&apos;re still editing your dashboard</AlertDialogTitle>
            <AlertDialogDescription>
              Save the current layout before closing, discard edit mode, or
              stay in the app to keep editing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="destructive" onClick={handleDiscard}>
              Discard
            </Button>
            <Button variant="outline" onClick={handleStay}>
              Stay
            </Button>
            <Button variant="default" onClick={handleSave}>
              Save
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WidgetProvider>
  )
}
