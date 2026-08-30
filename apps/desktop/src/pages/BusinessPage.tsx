import { useState } from 'react'
import { getAnnualizedPremium } from '@/lib/premium'
import { motion, AnimatePresence } from 'framer-motion'
import { IconBook2 } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useSales } from '../hooks/useSales'
import { containerVariants, itemVariants, tabContentVariants } from '../lib/motion'
import { fmt$ } from '../components/charts/chart-constants'
import BusinessDashboardTab from '../components/business/BusinessDashboardTab'
import SubmittedBusinessTab from '../components/business/SubmittedBusinessTab'

export default function BusinessPage() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useSales()
  const sales = data?.sales ?? []
  const total = data?.total ?? 0

  const totalAP = sales.reduce((sum, s) => sum + getAnnualizedPremium(s), 0)

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="pt-6"
    >
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1) }}>
        {/* Sticky header */}
        <div
          className="sticky -top-6 z-20 -mx-6 px-6 pt-6 pb-4 space-y-4"
          style={{ background: 'linear-gradient(to bottom, hsl(var(--background)) 85%, transparent)' }}
        >
          <motion.div variants={itemVariants} className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <IconBook2 size={24} />
                Book of Business
              </h1>
              <div className="flex items-center gap-3 mt-1.5">
                <Badge variant="outline">{total} policies</Badge>
                <Badge variant="outline" className="text-[#7DD3FC] border-[#7DD3FC]/30">
                  {fmt$(totalAP)} AP
                </Badge>
              </div>
            </div>
          </motion.div>

          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="submitted">Submitted Business</TabsTrigger>
          </TabsList>
        </div>

        {/* Tab content */}
        <div className="mt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={tabContentVariants}
              initial="enter"
              animate="center"
              exit="exit"
              custom={1}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && (
                <BusinessDashboardTab sales={sales} isLoading={isLoading} />
              )}
              {activeTab === 'submitted' && (
                <SubmittedBusinessTab
                  sales={sales}
                  total={total}
                  page={page}
                  onPageChange={setPage}
                  isLoading={isLoading}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </Tabs>
    </motion.div>
  )
}
