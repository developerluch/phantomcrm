import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createRecruitSchema, type CreateRecruitFormData } from '../../lib/schemas'
import { useCreateRecruit } from '../../hooks/useRecruits'
import { toast } from 'sonner'
import { IconUserPlus, IconLoader2 } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'

interface Props {
  open: boolean
  onClose: () => void
}

export default function CreateRecruitModal({ open, onClose }: Props) {
  const createRecruit = useCreateRecruit()

  const form = useForm<CreateRecruitFormData>({
    resolver: zodResolver(createRecruitSchema),
    mode: 'onChange',
  })

  const handleClose = () => {
    form.reset()
    onClose()
  }

  const onValid = (data: CreateRecruitFormData) => {
    createRecruit.mutate(
      {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: data.email.trim(),
        phone: data.phone?.trim() || undefined,
        city: data.city?.trim() || undefined,
        source: data.source?.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Recruit added successfully')
          handleClose()
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : 'Failed to create recruit')
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <IconUserPlus size={20} className="text-blue-400" />
            </div>
            <div>
              <DialogTitle>Add Recruit</DialogTitle>
              <DialogDescription>Add a new recruit to the pipeline</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onValid)} className="space-y-4">
            {[
              {
                type: 'grid',
                fields: [
                  { label: 'First Name *', name: 'firstName' as const, placeholder: 'John' },
                  { label: 'Last Name *', name: 'lastName' as const, placeholder: 'Doe' },
                ],
              },
              {
                type: 'single',
                fields: [{ label: 'Email *', name: 'email' as const, placeholder: 'john@example.com', inputType: 'email' }],
              },
              {
                type: 'grid',
                fields: [
                  { label: 'Phone', name: 'phone' as const, placeholder: '+1 555 123 4567' },
                  { label: 'City', name: 'city' as const, placeholder: 'Miami' },
                ],
              },
              {
                type: 'single',
                fields: [{ label: 'Source', name: 'source' as const, placeholder: 'e.g. Facebook, Referral' }],
              },
            ].map((group, gi) => (
              <div
                key={gi}
                className={group.type === 'grid' ? 'grid grid-cols-2 gap-3' : ''}
              >
                {group.fields.map((field) => (
                  <FormField
                    key={field.name}
                    control={form.control}
                    name={field.name}
                    render={({ field: rField }) => (
                      <FormItem>
                        <FormLabel className="text-sm text-muted-foreground font-medium">{field.label}</FormLabel>
                        <FormControl>
                          <Input
                            type={(field as any).inputType || 'text'}
                            {...rField}
                            placeholder={field.placeholder}
                          />
                        </FormControl>
                        <FormMessage className="text-xs text-red-400 mt-1" />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            ))}

            <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
              <Button type="button" variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
              <Button
                type="submit"
                size="sm"
                disabled={!form.formState.isValid || createRecruit.isPending}
                className="min-w-[100px]"
              >
              {createRecruit.isPending ? (
                <span className="flex items-center gap-2">
                  <IconLoader2 size={14} className="animate-spin" />
                  Adding...
                </span>
              ) : (
                'Add Recruit'
              )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
