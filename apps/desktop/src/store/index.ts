import { create } from 'zustand'
import type { VerificationState } from '../types/portal'

export interface AuthUser {
  id: string
  agentId: string
  email: string
  discordId: string
  displayName: string
  avatarUrl: string
  orgId: string
  roleId: string
  permissions: string[]
}

interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  verification: VerificationState | null
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void
  setAccessToken: (token: string) => void
  setVerification: (v: VerificationState) => void
  clearVerification: () => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  verification: null,
  setAuth: (user, accessToken, refreshToken) =>
    set({
      user,
      accessToken,
      refreshToken,
      isAuthenticated: true,
    }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setVerification: (verification) => set({ verification }),
  clearVerification: () => set({ verification: null }),
  clearAuth: () =>
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, verification: null }),
}))
