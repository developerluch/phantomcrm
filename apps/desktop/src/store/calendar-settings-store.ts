import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { EventCategory } from '@/components/calendar/constants'
import { DEFAULT_EVENT_CATEGORY_COLORS } from '@/components/calendar/constants'

interface CalendarSettingsState {
  eventColors: Record<EventCategory, string>
  hiddenCategories: Set<EventCategory>
  setEventColor: (category: EventCategory, color: string) => void
  resetColors: () => void
  toggleCategory: (category: EventCategory) => void
}

export const useCalendarSettingsStore = create<CalendarSettingsState>()(
  persist(
    (set) => ({
      eventColors: { ...DEFAULT_EVENT_CATEGORY_COLORS },
      hiddenCategories: new Set<EventCategory>(),
      setEventColor: (category, color) =>
        set((state) => ({
          eventColors: { ...state.eventColors, [category]: color },
        })),
      resetColors: () =>
        set({ eventColors: { ...DEFAULT_EVENT_CATEGORY_COLORS } }),
      toggleCategory: (category) =>
        set((state) => {
          const next = new Set(state.hiddenCategories)
          if (next.has(category)) next.delete(category)
          else next.add(category)
          return { hiddenCategories: next }
        }),
    }),
    {
      name: 'vipa-calendar-settings',
      partialize: (state) => ({
        eventColors: state.eventColors,
        hiddenCategories: [...state.hiddenCategories],
      }),
      merge: (persisted, current) => {
        const p = persisted as { eventColors?: Record<EventCategory, string>; hiddenCategories?: EventCategory[] }
        return {
          ...current,
          eventColors: p?.eventColors ?? current.eventColors,
          hiddenCategories: new Set(p?.hiddenCategories ?? []),
        }
      },
    }
  )
)
