import { useState } from 'react'
import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { IconFileSpreadsheet, IconFileText } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import CsvImportTab from './CsvImportTab'
import DocumentImportTab from './DocumentImportTab'
import { useSalesAgentDirectory } from '@/hooks/useSales'

type ImportMethod = 'csv' | 'document'

interface BusinessImportTabProps {
  onClose: () => void
}

export default function BusinessImportTab({ onClose }: BusinessImportTabProps) {
  const [method, setMethod] = useState<ImportMethod>('csv')
  const { data: agents = [], isLoading: agentsLoading } = useSalesAgentDirectory()

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <MethodCard
          active={method === 'csv'}
          icon={<IconFileSpreadsheet size={18} />}
          title="Import Spreadsheet"
          description="Best for bulk policy imports from CSV exports."
          onClick={() => setMethod('csv')}
        />
        <MethodCard
          active={method === 'document'}
          icon={<IconFileText size={18} />}
          title="Upload Documents"
          description="Best for PDFs and policy docs that need AI extraction."
          onClick={() => setMethod('document')}
        />
      </div>

      <div className="min-h-0 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={method}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="min-h-0"
          >
            {method === 'csv' ? (
              <CsvImportTab onClose={onClose} agents={agents} agentsLoading={agentsLoading} />
            ) : (
              <DocumentImportTab onClose={onClose} agents={agents} agentsLoading={agentsLoading} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function MethodCard({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean
  icon: ReactNode
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.99 }}
      transition={{ duration: 0.12 }}
    >
      <Card
        className={`border p-3 transition-colors ${
        active ? 'border-primary bg-primary/5' : 'border-border/60 bg-card/40'
      }`}
      >
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full justify-start gap-3 p-0 text-left hover:bg-transparent"
          onClick={onClick}
        >
          <motion.span
            animate={{ scale: active ? 1.04 : 1 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background"
          >
            {icon}
          </motion.span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{title}</span>
            <span className="block text-xs font-normal text-muted-foreground">{description}</span>
          </span>
        </Button>
      </Card>
    </motion.div>
  )
}
