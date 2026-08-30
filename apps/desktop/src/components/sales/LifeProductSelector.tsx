import { useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { CreateSaleFormData } from '../../lib/schemas'
import { LIFE_LEAD_SOURCES, LIFE_CARRIER_PRODUCTS, LIFE_CARRIERS } from '../../lib/life-carriers'
import { motion, AnimatePresence } from 'framer-motion'
import { tabContentVariants } from '@/lib/motion'
import { IconCheck, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface LifeProductSelectorProps {
  form: UseFormReturn<CreateSaleFormData>
  onComplete: () => void
  onCancel: () => void
}

export default function LifeProductSelector({ form, onComplete, onCancel }: LifeProductSelectorProps) {
  const [subStep, setSubStep] = useState<1 | 2 | 3>(1)
  const [subDirection, setSubDirection] = useState(0)

  const [selectedLeadSource, setSelectedLeadSource] = useState('')
  const [otherLeadSourceText, setOtherLeadSourceText] = useState('')
  const [selectedCarrier, setSelectedCarrier] = useState('')
  const [otherCarrierText, setOtherCarrierText] = useState('')
  const [selectedProduct, setSelectedProduct] = useState('')
  const [otherProductText, setOtherProductText] = useState('')

  function advanceTo(step: 1 | 2 | 3) {
    setSubDirection(1)
    setSubStep(step)
  }

  function goBackTo(step: 1 | 2 | 3) {
    setSubDirection(-1)
    setSubStep(step)
  }

  function handleComplete() {
    const finalLeadSource = selectedLeadSource === 'Other' ? otherLeadSourceText : selectedLeadSource
    const finalCarrier = selectedCarrier === 'Other' ? otherCarrierText : selectedCarrier
    const finalProduct = selectedProduct === 'Other' ? otherProductText : selectedProduct

    form.setValue('leadSource', finalLeadSource)
    form.setValue('carrier', finalCarrier, { shouldValidate: true })
    form.setValue('productName', finalProduct)
    onComplete()
  }

  const isLeadSourceValid = selectedLeadSource !== '' && (selectedLeadSource !== 'Other' || otherLeadSourceText.trim() !== '')
  const isCarrierValid = selectedCarrier !== '' && (selectedCarrier !== 'Other' || otherCarrierText.trim() !== '')
  const isProductValid = selectedProduct !== '' && (selectedProduct !== 'Other' || otherProductText.trim() !== '')

  const carrierProducts = LIFE_CARRIER_PRODUCTS[selectedCarrier] ?? []
  const showFreeTextProduct = selectedCarrier === 'Other' || carrierProducts.length === 0

  return (
    <div className="space-y-3 py-2">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={subStep}
          custom={subDirection}
          variants={tabContentVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2 }}
        >
          {subStep === 1 && (
            <SubStepLeadSource
              selected={selectedLeadSource}
              otherText={otherLeadSourceText}
              onSelect={(v) => {
                setSelectedLeadSource(v)
                if (v !== 'Other') {
                  setOtherLeadSourceText('')
                  // Auto-advance for non-Other selections
                  advanceTo(2)
                }
              }}
              onOtherChange={setOtherLeadSourceText}
              onBack={onCancel}
              onNext={() => advanceTo(2)}
              isValid={isLeadSourceValid}
            />
          )}

          {subStep === 2 && (
            <SubStepCarrier
              selected={selectedCarrier}
              otherText={otherCarrierText}
              onSelect={(v) => {
                setSelectedCarrier(v)
                if (v !== 'Other') setOtherCarrierText('')
                setSelectedProduct('')
                setOtherProductText('')
              }}
              onOtherChange={setOtherCarrierText}
              onBack={() => goBackTo(1)}
              onNext={() => advanceTo(3)}
              isValid={isCarrierValid}
            />
          )}

          {subStep === 3 && (
            <SubStepProduct
              products={carrierProducts}
              showFreeText={showFreeTextProduct}
              selected={selectedProduct}
              otherText={otherProductText}
              onSelect={(v) => {
                setSelectedProduct(v)
                if (v !== 'Other') setOtherProductText('')
              }}
              onOtherChange={setOtherProductText}
              onBack={() => goBackTo(2)}
              onComplete={handleComplete}
              isValid={isProductValid}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ── Sub-step 1: Lead Source ─────────────────────────────

interface SubStepLeadSourceProps {
  selected: string
  otherText: string
  onSelect: (v: string) => void
  onOtherChange: (v: string) => void
  onBack: () => void
  onNext: () => void
  isValid: boolean
}

function SubStepLeadSource({ selected, otherText, onSelect, onOtherChange, onBack, onNext, isValid }: SubStepLeadSourceProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-foreground">What type of lead?</p>
      <Select value={selected || undefined} onValueChange={onSelect}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select lead source..." />
        </SelectTrigger>
        <SelectContent>
          {LIFE_LEAD_SOURCES.map((opt) => (
            <SelectItem key={opt} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selected === 'Other' && (
        <Input
          placeholder="Enter custom lead source"
          value={otherText}
          onChange={(e) => onOtherChange(e.target.value)}
          autoFocus
        />
      )}
      <div className="flex justify-between pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1 text-sm">
          <IconChevronLeft size={14} /> Back
        </Button>
        {selected === 'Other' && (
          <Button type="button" size="sm" onClick={onNext} disabled={!isValid} className="gap-1 text-sm">
            Next <IconChevronRight size={14} />
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Sub-step 2: Carrier ─────────────────────────────────

interface SubStepCarrierProps {
  selected: string
  otherText: string
  onSelect: (v: string) => void
  onOtherChange: (v: string) => void
  onBack: () => void
  onNext: () => void
  isValid: boolean
}

function SubStepCarrier({ selected, otherText, onSelect, onOtherChange, onBack, onNext, isValid }: SubStepCarrierProps) {
  const carriers = [...LIFE_CARRIERS, 'Other']

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-foreground">Which carrier?</p>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 max-h-48 overflow-y-auto pr-1">
        {carriers.map((carrier) => (
          <Card
            key={carrier}
            className={cn(
              'p-2.5 cursor-pointer transition-all',
              selected === carrier
                ? 'border-primary border-2 bg-primary/5'
                : 'border hover:border-muted-foreground/50'
            )}
            onClick={() => onSelect(carrier)}
          >
            <div className="flex justify-between items-center gap-1">
              <span className="font-medium text-sm leading-tight">{carrier}</span>
              {selected === carrier && <IconCheck size={14} className="text-primary shrink-0" />}
            </div>
          </Card>
        ))}
      </div>
      {selected === 'Other' && (
        <Input
          placeholder="Enter carrier name"
          value={otherText}
          onChange={(e) => onOtherChange(e.target.value)}
          autoFocus
        />
      )}
      <div className="flex justify-between pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1 text-sm">
          <IconChevronLeft size={14} /> Back
        </Button>
        <Button type="button" size="sm" onClick={onNext} disabled={!isValid} className="gap-1 text-sm">
          Next <IconChevronRight size={14} />
        </Button>
      </div>
    </div>
  )
}

// ── Sub-step 3: Product ─────────────────────────────────

interface SubStepProductProps {
  products: string[]
  showFreeText: boolean
  selected: string
  otherText: string
  onSelect: (v: string) => void
  onOtherChange: (v: string) => void
  onBack: () => void
  onComplete: () => void
  isValid: boolean
}

function SubStepProduct({ products, showFreeText, selected, otherText, onSelect, onOtherChange, onBack, onComplete, isValid }: SubStepProductProps) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-foreground">Which product?</p>
      {showFreeText ? (
        <Input
          placeholder="Enter product name"
          value={otherText}
          onChange={(e) => {
            onSelect('Other')
            onOtherChange(e.target.value)
          }}
          autoFocus
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 max-h-48 overflow-y-auto pr-1">
            {products.map((product) => (
              <Button
                key={product}
                type="button"
                variant={selected === product ? 'default' : 'outline'}
                size="sm"
                onClick={() => onSelect(product)}
                className="justify-between text-sm h-auto py-2 whitespace-normal text-left"
              >
                <span>{product}</span>
                {selected === product && <IconCheck size={14} className="ml-1.5 shrink-0" />}
              </Button>
            ))}
            <Button
              type="button"
              variant={selected === 'Other' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onSelect('Other')}
              className="justify-between text-sm h-auto py-2"
            >
              Other
              {selected === 'Other' && <IconCheck size={14} className="ml-1.5 shrink-0" />}
            </Button>
          </div>
          {selected === 'Other' && (
            <Input
              placeholder="Enter product name"
              value={otherText}
              onChange={(e) => onOtherChange(e.target.value)}
              autoFocus
            />
          )}
        </>
      )}
      <div className="flex justify-between pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1 text-sm">
          <IconChevronLeft size={14} /> Back
        </Button>
        <Button type="button" size="sm" onClick={onComplete} disabled={!isValid} className="gap-1 text-sm">
          Done <IconCheck size={14} />
        </Button>
      </div>
    </div>
  )
}
