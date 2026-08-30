import { motion } from 'framer-motion'
import { WidgetProvider } from '@/contexts/WidgetContext'
import { usePolicyLayoutStore } from '@/store/policy-layout-store'
import { policyWidgetRegistry } from '@/lib/policy-widget-registry'
import { WidgetGrid } from '@/components/widgets/WidgetGrid'
import { DashboardToolbar } from '@/components/widgets/DashboardToolbar'
import PolicyPageSwitcher from '@/components/sales/PolicyPageSwitcher'
import { containerVariants, itemVariants } from '@/lib/motion'

export default function PolicyDashboardPage() {
  const store = usePolicyLayoutStore()

  return (
    <WidgetProvider value={{ ...store, registry: policyWidgetRegistry }}>
      <motion.div
        className="space-y-5"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 sticky top-0 z-10 bg-background -mx-6 px-6 pt-4 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Policy Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Track your premium, active policies, and team performance.</p>
          </div>
          <div className="justify-self-center">
            <PolicyPageSwitcher />
          </div>
          <div className="justify-self-end">
            <DashboardToolbar />
          </div>
        </motion.div>

        {/* Widget Grid */}
        <motion.div variants={itemVariants}>
          <WidgetGrid />
        </motion.div>
      </motion.div>
    </WidgetProvider>
  )
}
