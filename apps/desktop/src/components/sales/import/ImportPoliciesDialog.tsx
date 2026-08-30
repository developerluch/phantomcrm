import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { IconBriefcase, IconUpload, IconPencil } from '@tabler/icons-react'
import BusinessImportTab from './BusinessImportTab'
import ManualEntryTab from './ManualEntryTab'
import type { SubmitBusinessMode } from '../PoliciesToolbar'

interface ImportPoliciesDialogProps {
  open: boolean
  onClose: () => void
  initialTab?: SubmitBusinessMode
}

export default function ImportPoliciesDialog({ open, onClose, initialTab = 'manual' }: ImportPoliciesDialogProps) {
  const [activeTab, setActiveTab] = useState<SubmitBusinessMode>(initialTab)

  useEffect(() => {
    if (open) setActiveTab(initialTab)
  }, [initialTab, open])

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="max-h-[calc(100vh-2rem)] w-[min(92vw,64rem)] max-w-[92vw] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-muted border border-border">
              <IconBriefcase size={20} className="text-foreground" />
            </div>
            <div>
              <DialogTitle>Submit Business</DialogTitle>
              <DialogDescription>Submit one policy manually or import business from a spreadsheet or document.</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SubmitBusinessMode)} className="flex-1 min-h-0 overflow-hidden flex flex-col mt-2">
          <TabsList className="self-start">
            <TabsTrigger value="manual">
              <IconPencil size={14} className="mr-1.5" />
              Manual Entry
            </TabsTrigger>
            <TabsTrigger value="import">
              <IconUpload size={14} className="mr-1.5" />
              Import Business
            </TabsTrigger>
          </TabsList>
          <TabsContent value="manual" className="flex-1 min-h-0 mt-4 overflow-y-auto overflow-x-hidden data-[state=inactive]:hidden">
            <AnimatePresence mode="wait">
              {activeTab === 'manual' && (
                <motion.div
                  key="manual-entry"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="min-h-0 w-full overflow-x-hidden"
                >
                  <ManualEntryTab onClose={onClose} />
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>
          <TabsContent value="import" className="flex-1 min-h-0 mt-4 overflow-y-auto overflow-x-hidden data-[state=inactive]:hidden">
            <AnimatePresence mode="wait">
              {activeTab === 'import' && (
                <motion.div
                  key="import-business"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  className="min-h-0 w-full overflow-x-hidden"
                >
                  <BusinessImportTab onClose={onClose} />
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
