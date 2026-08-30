import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../services/api'
import type {
  CreateLicenseRequest,
  UpdateLicenseRequest,
  CreateLicenseAppointmentRequest,
} from '../types/portal'

export function useLicenses(params?: { agentId?: string; state?: string; status?: string }) {
  return useQuery({
    queryKey: ['licenses', params],
    queryFn: () => api.getLicenses(params),
    retry: 1,
  })
}

export function useLicense(id: string | undefined) {
  return useQuery({
    queryKey: ['license', id],
    queryFn: () => api.getLicense(id as string),
    enabled: !!id,
    retry: 1,
  })
}

export function useLicenseStats(agentId?: string) {
  return useQuery({
    queryKey: ['license-stats', agentId ?? null],
    queryFn: () => api.getLicenseStats(agentId),
    retry: 1,
  })
}

export function useExpiringLicenses(days: number = 60) {
  return useQuery({
    queryKey: ['licenses-expiring', days],
    queryFn: () => api.getExpiringLicenses(days),
    retry: 1,
  })
}

export function useCreateLicense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateLicenseRequest) => api.createLicense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] })
      queryClient.invalidateQueries({ queryKey: ['license-stats'] })
    },
  })
}

export function useUpdateLicense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLicenseRequest }) =>
      api.updateLicense(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] })
      queryClient.invalidateQueries({ queryKey: ['license', updated.id] })
      queryClient.invalidateQueries({ queryKey: ['license-stats'] })
    },
  })
}

export function useDeleteLicense() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteLicense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] })
      queryClient.invalidateQueries({ queryKey: ['license-stats'] })
    },
  })
}

export function useLicenseAppointments(licenseId: string | undefined) {
  return useQuery({
    queryKey: ['license-appointments', licenseId],
    queryFn: () => api.listLicenseAppointments(licenseId as string),
    enabled: !!licenseId,
    retry: 1,
  })
}

export function useCreateLicenseAppointment(licenseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateLicenseAppointmentRequest) =>
      api.createLicenseAppointment(licenseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['license-appointments', licenseId] })
    },
  })
}

export function useDeleteLicenseAppointment(licenseId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (appointmentId: string) => api.deleteLicenseAppointment(licenseId, appointmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['license-appointments', licenseId] })
    },
  })
}

export function useLicenseDocuments(licenseId: string | undefined) {
  return useQuery({
    queryKey: ['license-documents', licenseId],
    queryFn: () => api.listLicenseDocuments(licenseId as string),
    enabled: !!licenseId,
    retry: 1,
  })
}
