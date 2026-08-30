import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

/** Phantom Dialer entry point. Backend (phantom-dialer-api, Telnyx primary,
 *  recording opt-in) lands in M4 — see project_dialer_sibling_service.md.
 *  Until then, this surface only toasts the intent. */
export function usePlaceCall() {
  return useMutation<void, Error, { contactId: string; phone?: string }>({
    mutationFn: async ({ phone }) => {
      toast.message(`Calling ${phone ?? 'contact'}… (Phantom Dialer — coming in M4)`)
    },
  })
}
