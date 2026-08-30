import { create } from 'zustand'
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, startOfYear, endOfYear,
  subWeeks, subMonths, subQuarters, subYears,
  format,
} from 'date-fns'

export type PresetPeriod =
  | 'this-week' | 'last-week'
  | 'this-month' | 'last-month'
  | 'this-quarter' | 'last-quarter'
  | 'this-year' | 'last-year'
  | 'custom'

export interface DateRange {
  from: string // YYYY-MM-DD
  to: string   // YYYY-MM-DD
}

interface DateState {
  preset: PresetPeriod
  current: DateRange
  comparison: DateRange
  setPreset: (preset: PresetPeriod) => void
  setCustomRange: (current: DateRange, comparison: DateRange) => void
}

function fmt(d: Date) { return format(d, 'yyyy-MM-dd') }

function calcRanges(preset: PresetPeriod): { current: DateRange; comparison: DateRange } {
  const now = new Date()

  switch (preset) {
    case 'this-week': {
      const s = startOfWeek(now, { weekStartsOn: 1 })
      const e = endOfWeek(now, { weekStartsOn: 1 })
      const ps = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
      const pe = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
      return { current: { from: fmt(s), to: fmt(e) }, comparison: { from: fmt(ps), to: fmt(pe) } }
    }
    case 'last-week': {
      const s = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
      const e = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
      const ps = startOfWeek(subWeeks(now, 2), { weekStartsOn: 1 })
      const pe = endOfWeek(subWeeks(now, 2), { weekStartsOn: 1 })
      return { current: { from: fmt(s), to: fmt(e) }, comparison: { from: fmt(ps), to: fmt(pe) } }
    }
    case 'this-month': {
      const s = startOfMonth(now)
      const e = endOfMonth(now)
      const ps = startOfMonth(subMonths(now, 1))
      const pe = endOfMonth(subMonths(now, 1))
      return { current: { from: fmt(s), to: fmt(e) }, comparison: { from: fmt(ps), to: fmt(pe) } }
    }
    case 'last-month': {
      const s = startOfMonth(subMonths(now, 1))
      const e = endOfMonth(subMonths(now, 1))
      const ps = startOfMonth(subMonths(now, 2))
      const pe = endOfMonth(subMonths(now, 2))
      return { current: { from: fmt(s), to: fmt(e) }, comparison: { from: fmt(ps), to: fmt(pe) } }
    }
    case 'this-quarter': {
      const s = startOfQuarter(now)
      const e = endOfQuarter(now)
      const ps = startOfQuarter(subQuarters(now, 1))
      const pe = endOfQuarter(subQuarters(now, 1))
      return { current: { from: fmt(s), to: fmt(e) }, comparison: { from: fmt(ps), to: fmt(pe) } }
    }
    case 'last-quarter': {
      const s = startOfQuarter(subQuarters(now, 1))
      const e = endOfQuarter(subQuarters(now, 1))
      const ps = startOfQuarter(subQuarters(now, 2))
      const pe = endOfQuarter(subQuarters(now, 2))
      return { current: { from: fmt(s), to: fmt(e) }, comparison: { from: fmt(ps), to: fmt(pe) } }
    }
    case 'this-year': {
      const s = startOfYear(now)
      const e = endOfYear(now)
      const ps = startOfYear(subYears(now, 1))
      const pe = endOfYear(subYears(now, 1))
      return { current: { from: fmt(s), to: fmt(e) }, comparison: { from: fmt(ps), to: fmt(pe) } }
    }
    case 'last-year': {
      const s = startOfYear(subYears(now, 1))
      const e = endOfYear(subYears(now, 1))
      const ps = startOfYear(subYears(now, 2))
      const pe = endOfYear(subYears(now, 2))
      return { current: { from: fmt(s), to: fmt(e) }, comparison: { from: fmt(ps), to: fmt(pe) } }
    }
    default: {
      const s = startOfMonth(now)
      const e = endOfMonth(now)
      const ps = startOfMonth(subMonths(now, 1))
      const pe = endOfMonth(subMonths(now, 1))
      return { current: { from: fmt(s), to: fmt(e) }, comparison: { from: fmt(ps), to: fmt(pe) } }
    }
  }
}

const initialRanges = calcRanges('this-month')

export const useDateStore = create<DateState>((set) => ({
  preset: 'this-month',
  current: initialRanges.current,
  comparison: initialRanges.comparison,
  setPreset: (preset) => {
    const ranges = calcRanges(preset)
    set({ preset, ...ranges })
  },

  setCustomRange: (current, comparison) => {
    set({ preset: 'custom', current, comparison })
  },
}))
