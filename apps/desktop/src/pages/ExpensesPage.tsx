import { useState } from 'react'
import { motion } from 'framer-motion'
import { ExpensesTab } from '../components/finance/ExpensesTab'
import LeadSpendOperationsTab from '../components/finance/LeadSpendOperationsTab'
import PolicyPageSwitcher from '../components/sales/PolicyPageSwitcher'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { containerVariants, itemVariants } from '../lib/motion'

type ExpensePageTab = 'lead-spend' | 'receipts'

export default function ExpensesPage() {
  const [activeTab, setActiveTab] = useState<ExpensePageTab>('lead-spend')

  return (
    <motion.div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="sticky top-0 z-30 -mx-6 flex-shrink-0 space-y-5 border-b border-border/40 bg-background/80 px-6 pt-6 pb-5 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <motion.div variants={itemVariants} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Lead Spend & Finances</h1>
            <p className="text-sm text-muted-foreground mt-1">Track lead vendors, spend, receipts, and policy profitability.</p>
          </div>
          <div className="justify-self-center">
            <PolicyPageSwitcher />
          </div>
          <div aria-hidden />
        </motion.div>

        <motion.div variants={itemVariants}>
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ExpensePageTab)}>
            <TabsList>
              <TabsTrigger value="lead-spend">Lead Spend</TabsTrigger>
              <TabsTrigger value="receipts">Receipts</TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>
      </div>

      <motion.div variants={itemVariants} className="min-h-0 flex-1 overflow-hidden pt-5">
        {activeTab === 'lead-spend' ? <LeadSpendOperationsTab /> : <ExpensesTab />}
      </motion.div>
    </motion.div>
  )
}
