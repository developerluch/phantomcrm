import { create } from 'zustand'

export type AIMode = 'closed' | 'popup' | 'bar' | 'fn-voice'

interface AIState {
  mode: AIMode
  setMode: (mode: AIMode) => void
  toggle: (target: 'popup' | 'bar' | 'fn-voice') => void
}

export const useAIStore = create<AIState>((set, get) => ({
  mode: 'closed',
  setMode: (mode) => set({ mode }),
  toggle: (target) => set({ mode: get().mode === target ? 'closed' : target }),
}))
