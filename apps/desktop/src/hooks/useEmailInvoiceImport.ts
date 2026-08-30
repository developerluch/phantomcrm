import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ApiError,
  api,
} from '@/services/api'
import type {
  ApproveImportedInvoiceRequest,
  CreateMailboxConnectionRequest,
  ImportedInvoice,
  UpdateImportedInvoiceRequest,
  UpdateMailboxConnectionRequest,
} from '@/types/portal'
import {
  approveLocalImportedInvoice,
  deleteLocalMailbox,
  getLocalImportedInvoices,
  getLocalMailboxes,
  rejectLocalImportedInvoice,
  saveLocalMailbox,
  updateLocalImportedInvoice,
  updateLocalMailboxStatus,
} from '@/lib/email-invoice-import-local'

function isMissingEndpoint(error: unknown) {
  return error instanceof ApiError && error.status === 404
}

export const EMAIL_INVOICE_IMPORT_BACKEND_ENABLED = import.meta.env.VITE_EMAIL_INVOICE_IMPORT_BACKEND === 'true'

export function useMailboxes() {
  return useQuery({
    queryKey: ['mailboxes'],
    queryFn: async () => {
      if (!EMAIL_INVOICE_IMPORT_BACKEND_ENABLED) return getLocalMailboxes()
      try {
        return await api.getMailboxes()
      } catch (error) {
        if (isMissingEndpoint(error)) return getLocalMailboxes()
        throw error
      }
    },
    retry: false,
  })
}

export function useCreateMailbox() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: CreateMailboxConnectionRequest) => {
      if (!EMAIL_INVOICE_IMPORT_BACKEND_ENABLED) return saveLocalMailbox(data)
      try {
        return await api.createMailbox(data)
      } catch (error) {
        if (isMissingEndpoint(error)) return saveLocalMailbox(data)
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] })
    },
  })
}

export function useUpdateMailbox() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateMailboxConnectionRequest }) => {
      if (!EMAIL_INVOICE_IMPORT_BACKEND_ENABLED) return updateLocalMailboxStatus(id, data) ?? Promise.reject(new Error('Mailbox not found'))
      try {
        return await api.updateMailbox(id, data)
      } catch (error) {
        if (isMissingEndpoint(error)) return updateLocalMailboxStatus(id, data) ?? Promise.reject(error)
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] })
    },
  })
}

export function useDeleteMailbox() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!EMAIL_INVOICE_IMPORT_BACKEND_ENABLED) {
        deleteLocalMailbox(id)
        return
      }
      try {
        await api.deleteMailbox(id)
      } catch (error) {
        if (!isMissingEndpoint(error)) throw error
        deleteLocalMailbox(id)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] })
    },
  })
}

export function useTestMailbox() {
  return useMutation({
    mutationFn: async (data: string | CreateMailboxConnectionRequest) => {
      if (!EMAIL_INVOICE_IMPORT_BACKEND_ENABLED) {
        return {
          ok: false,
          message: 'Email invoice import is running in local prototype mode. No backend credentials were tested or stored.',
        }
      }
      try {
        return await api.testMailbox(data)
      } catch (error) {
        if (isMissingEndpoint(error)) {
          return {
            ok: false,
            message: 'Mailbox backend endpoints are not deployed yet. Credentials were not stored locally.',
          }
        }
        throw error
      }
    },
  })
}

export function useSyncMailbox() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!EMAIL_INVOICE_IMPORT_BACKEND_ENABLED) {
        updateLocalMailboxStatus(id, {
          status: 'needs_attention',
          failedCount: 0,
          errorMessage: 'Local prototype mode: backend mailbox sync is disabled.',
        })
        return {
          importedCount: 0,
          duplicateCount: 0,
          failedCount: 0,
          message: 'Local prototype mode: backend mailbox sync is disabled.',
        }
      }
      try {
        return await api.syncMailbox(id)
      } catch (error) {
        if (isMissingEndpoint(error)) {
          updateLocalMailboxStatus(id, {
            status: 'needs_attention',
            failedCount: 1,
            errorMessage: 'Mailbox sync endpoint is not deployed yet.',
          })
          return {
            importedCount: 0,
            duplicateCount: 0,
            failedCount: 1,
            message: 'Mailbox sync endpoint is not deployed yet.',
          }
        }
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mailboxes'] })
      queryClient.invalidateQueries({ queryKey: ['imported-invoices'] })
    },
  })
}

export function useImportedInvoices(params?: { status?: string; mailboxId?: string }) {
  return useQuery({
    queryKey: ['imported-invoices', params],
    queryFn: async () => {
      if (!EMAIL_INVOICE_IMPORT_BACKEND_ENABLED) {
        const invoices = getLocalImportedInvoices().filter((invoice) => {
          if (params?.status && invoice.status !== params.status) return false
          if (params?.mailboxId && invoice.mailboxId !== params.mailboxId) return false
          return true
        })
        return { invoices, total: invoices.length }
      }
      try {
        return await api.getImportedInvoices(params)
      } catch (error) {
        if (isMissingEndpoint(error)) {
          const invoices = getLocalImportedInvoices().filter((invoice) => {
            if (params?.status && invoice.status !== params.status) return false
            if (params?.mailboxId && invoice.mailboxId !== params.mailboxId) return false
            return true
          })
          return { invoices, total: invoices.length }
        }
        throw error
      }
    },
    retry: false,
  })
}

export function useUpdateImportedInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateImportedInvoiceRequest }) => {
      if (!EMAIL_INVOICE_IMPORT_BACKEND_ENABLED) return updateLocalImportedInvoice(id, data) ?? Promise.reject(new Error('Imported invoice not found'))
      try {
        return await api.updateImportedInvoice(id, data)
      } catch (error) {
        if (isMissingEndpoint(error)) return updateLocalImportedInvoice(id, data) ?? Promise.reject(error)
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imported-invoices'] })
    },
  })
}

export function useApproveImportedInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data, approvedRecordId }: { id: string; data: ApproveImportedInvoiceRequest; approvedRecordId?: string }) => {
      if (!EMAIL_INVOICE_IMPORT_BACKEND_ENABLED) return approveLocalImportedInvoice(id, data, approvedRecordId) as ImportedInvoice
      try {
        return await api.approveImportedInvoice(id, data)
      } catch (error) {
        if (isMissingEndpoint(error)) return approveLocalImportedInvoice(id, data, approvedRecordId) as ImportedInvoice
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imported-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['finance-summary'] })
    },
  })
}

export function useRejectImportedInvoice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      if (!EMAIL_INVOICE_IMPORT_BACKEND_ENABLED) return rejectLocalImportedInvoice(id) as ImportedInvoice
      try {
        return await api.rejectImportedInvoice(id)
      } catch (error) {
        if (isMissingEndpoint(error)) return rejectLocalImportedInvoice(id) as ImportedInvoice
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imported-invoices'] })
    },
  })
}
