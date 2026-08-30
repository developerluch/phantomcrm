import { HOUR_HEIGHT_PX } from './constants'
import type { CalendarEvent } from './constants'

// ── Drag payload for HTML5 dataTransfer ─────────────────────
export interface DragEventPayload {
  eventId: string
  source: CalendarEvent['source']
  startTime: string
  endTime: string
  googleEventId?: string
  accountId?: string
  grabOffsetY: number
}

export const DRAG_MIME = 'application/x-calendar-event'

export function serializeDragPayload(payload: DragEventPayload): string {
  return JSON.stringify(payload)
}

export function parseDragPayload(data: string): DragEventPayload | null {
  try {
    return JSON.parse(data) as DragEventPayload
  } catch {
    return null
  }
}

// ── Module-level grabOffsetY (HTML5 dragOver can't read dataTransfer) ───
let _grabOffsetY = 0
export function setGrabOffsetY(y: number) { _grabOffsetY = y }
export function getGrabOffsetY(): number { return _grabOffsetY }

// ── Time snapping to 15-minute increments ───────────────────
export function snapToQuarter(minutes: number): number {
  return Math.round(minutes / 15) * 15
}

// ── Pixel to minutes conversion ─────────────────────────────
export function pxToMinutes(px: number): number {
  return (px / HOUR_HEIGHT_PX) * 60
}

// ── Calculate new times from drop position ──────────────────
export function computeNewTimes(
  dropDate: Date,
  offsetYInColumn: number,
  grabOffsetY: number,
  originalStartTime: string,
  originalEndTime: string,
): { newStart: Date; newEnd: Date } {
  const rawMinutes = pxToMinutes(offsetYInColumn - grabOffsetY)
  const snappedMinutes = snapToQuarter(Math.max(0, Math.min(rawMinutes, 24 * 60 - 15)))

  const durationMs = new Date(originalEndTime).getTime() - new Date(originalStartTime).getTime()

  const newStart = new Date(dropDate)
  newStart.setHours(0, 0, 0, 0)
  newStart.setMinutes(snappedMinutes)

  const newEnd = new Date(newStart.getTime() + durationMs)

  return { newStart, newEnd }
}

// ── Snap indicator position for blue line ───────────────────
export function computeSnapIndicatorTop(
  offsetYInColumn: number,
  grabOffsetY: number,
): number {
  const rawMinutes = pxToMinutes(offsetYInColumn - grabOffsetY)
  const snapped = snapToQuarter(Math.max(0, Math.min(rawMinutes, 24 * 60 - 15)))
  return (snapped / 60) * HOUR_HEIGHT_PX
}

// ── Draggability check ──────────────────────────────────────
export function isDraggableSource(source: CalendarEvent['source']): boolean {
  return source === 'google' || source === 'manual'
}
