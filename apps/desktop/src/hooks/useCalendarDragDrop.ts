import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useUpdateGoogleEvent } from './useGoogleCalendar'
import { useRescheduleAppointment } from './useAppointments'
import type { DragEventPayload } from '@/components/calendar/drag-utils'

export function useCalendarDragDrop() {
  const updateGoogle = useUpdateGoogleEvent()
  const rescheduleManual = useRescheduleAppointment()
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    payload: DragEventPayload
    newStart: Date
    newEnd: Date
  } | null>(null)

  const executeDrop = useCallback(
    (payload: DragEventPayload, newStart: Date, newEnd: Date) => {
      const newStartISO = newStart.toISOString()
      const newEndISO = newEnd.toISOString()
      const timeLabel = format(newStart, 'EEE, MMM d @ h:mm a')

      if (payload.source === 'google' && payload.googleEventId) {
        updateGoogle.mutate(
          {
            accountId: payload.accountId,
            eventId: payload.googleEventId,
            updates: { startTime: newStartISO, endTime: newEndISO },
          },
          {
            onSuccess: () => toast.success(`Event rescheduled to ${timeLabel}`),
            onError: () => toast.error('Failed to update Google event'),
          },
        )
      } else if (payload.source === 'manual') {
        rescheduleManual.mutate(
          { id: payload.eventId, startTime: newStartISO, endTime: newEndISO },
          {
            onSuccess: () => toast.success(`Event rescheduled to ${timeLabel}`),
            onError: () => toast.error('Failed to reschedule appointment'),
          },
        )
      }
    },
    [updateGoogle, rescheduleManual],
  )

  const handleDrop = useCallback(
    (payload: DragEventPayload, newStart: Date, newEnd: Date) => {
      if (payload.source === 'google') {
        setPendingConfirmation({ payload, newStart, newEnd })
      } else {
        executeDrop(payload, newStart, newEnd)
      }
    },
    [executeDrop],
  )

  const confirmDrop = useCallback(() => {
    if (pendingConfirmation) {
      executeDrop(
        pendingConfirmation.payload,
        pendingConfirmation.newStart,
        pendingConfirmation.newEnd,
      )
      setPendingConfirmation(null)
    }
  }, [pendingConfirmation, executeDrop])

  const cancelDrop = useCallback(() => {
    setPendingConfirmation(null)
  }, [])

  return {
    handleDrop,
    pendingConfirmation,
    confirmDrop,
    cancelDrop,
    isUpdating: updateGoogle.isPending || rescheduleManual.isPending,
  }
}
