import { useEffect, useState } from 'react'
import { useAuthStore } from '../store'
import LoginPage from '../pages/LoginPage'
import VerifyNpnPage from '../pages/VerifyNpnPage'
import { useNiprVerificationStatus } from '../hooks/useNiprVerification'
import { getApiBaseUrl } from '../services/config'
import type { AuthUser } from '../store'
import {
  getAccessToken as vaultGetAccessToken,
  getRefreshToken as vaultGetRefreshToken,
  setAccessToken as vaultSetAccessToken,
  setRefreshToken as vaultSetRefreshToken,
  clearTokens as vaultClearTokens,
  scrubLocalStorageOnce,
} from '../services/tokenVault'

type AuthCheckResult =
  | { authenticated: true; user: AuthUser; accessToken: string; refreshToken: string }
  | { authenticated: false }

let bootAuthPromise: Promise<AuthCheckResult> | null = null

function decodeJwtPayload(token: string): { exp?: number } | null {
  const [, payload] = token.split('.')
  if (!payload) return null
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    return JSON.parse(atob(padded)) as { exp?: number }
  } catch {
    return null
  }
}

function isExpiredJwt(token: string): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload?.exp) return true
  return payload.exp * 1000 <= Date.now() + 30_000
}

async function validateToken(
  token: string,
  baseUrl: string
): Promise<{ valid: boolean; user?: AuthUser }> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      const user = await res.json()
      return { valid: true, user }
    }
    return { valid: false }
  } catch {
    return { valid: false }
  }
}

async function repairMissingAgentId(
  token: string,
  baseUrl: string,
): Promise<{ accessToken: string; refreshToken: string; user: AuthUser } | null> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/auth/me/repair-agent-id`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    const data = await res.json() as {
      accessToken?: string
      refreshToken?: string
      user?: AuthUser
    }
    if (!data.accessToken || !data.user) return null
    if (data.refreshToken) {
      await vaultSetRefreshToken(data.refreshToken)
    }
    await vaultSetAccessToken(data.accessToken)
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? '',
      user: data.user,
    }
  } catch {
    return null
  }
}

async function refreshAccessToken(
  refreshToken: string,
  baseUrl: string
): Promise<{ accessToken: string; user: AuthUser } | null> {
  try {
    const res = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (res.ok) {
      const data = await res.json()
      return { accessToken: data.accessToken, user: data.user }
    }
    return null
  } catch {
    return null
  }
}

async function checkAuthSession(): Promise<AuthCheckResult> {
  if (bootAuthPromise) return bootAuthPromise

  bootAuthPromise = (async () => {
    await scrubLocalStorageOnce()

    const baseUrl = getApiBaseUrl()
    const token = await vaultGetAccessToken()
    const storedRefresh = await vaultGetRefreshToken()

    if (token && !isExpiredJwt(token)) {
      const result = await validateToken(token, baseUrl)
      if (result.valid && result.user) {
        if (!result.user.agentId) {
          const repaired = await repairMissingAgentId(token, baseUrl)
          if (repaired) {
            return {
              authenticated: true,
              user: repaired.user,
              accessToken: repaired.accessToken,
              refreshToken: repaired.refreshToken || storedRefresh || '',
            }
          }
        }
        return { authenticated: true, user: result.user, accessToken: token, refreshToken: storedRefresh || '' }
      }
    }

    if (storedRefresh) {
      const refreshed = await refreshAccessToken(storedRefresh, baseUrl)
      if (refreshed) {
        await vaultSetAccessToken(refreshed.accessToken)
        if (!refreshed.user.agentId) {
          const repaired = await repairMissingAgentId(refreshed.accessToken, baseUrl)
          if (repaired) {
            return {
              authenticated: true,
              user: repaired.user,
              accessToken: repaired.accessToken,
              refreshToken: repaired.refreshToken || storedRefresh,
            }
          }
        }
        return {
          authenticated: true,
          user: refreshed.user,
          accessToken: refreshed.accessToken,
          refreshToken: storedRefresh,
        }
      }
    }

    await vaultClearTokens()
    return { authenticated: false }
  })()

  try {
    return await bootAuthPromise
  } finally {
    bootAuthPromise = null
  }
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, setAuth, clearAuth } = useAuthStore()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const result = await checkAuthSession()
        if (cancelled) return
        if (result.authenticated) setAuth(result.user, result.accessToken, result.refreshToken)
        else clearAuth()
      } catch {
        if (cancelled) return
        clearAuth()
      } finally {
        if (!cancelled) setChecking(false)
      }
    }

    check()

    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: verification, isLoading: verLoading } = useNiprVerificationStatus(isAuthenticated)

  if (checking || (isAuthenticated && verLoading)) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  if (verification && !verification.npn_verified) {
    return <VerifyNpnPage />
  }

  return <>{children}</>
}
