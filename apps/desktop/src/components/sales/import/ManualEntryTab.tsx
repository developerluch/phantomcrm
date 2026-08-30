import CreateSaleWizardForm from '../CreateSaleWizardForm'

interface ManualEntryTabProps {
  onClose: () => void
}

export default function ManualEntryTab({ onClose }: ManualEntryTabProps) {
  return <CreateSaleWizardForm onSuccess={onClose} onCancel={onClose} />
}
