import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store'
import { getApiBaseUrl, getGoogleRedirectUri } from '../services/config'
import { Button } from '@/components/ui/button'
import {
  setAccessToken as vaultSetAccessToken,
  setRefreshToken as vaultSetRefreshToken,
} from '../services/tokenVault'

// Module-level flag survives React StrictMode unmount/remount cycle.
// Google OAuth codes are single-use — a second call always fails.
let exchangeInFlight = false

export default function GoogleCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [error, setError] = useState<string | null>(null)
  const hasStarted = useRef(false)

  useEffect(() => {
    if (exchangeInFlight || hasStarted.current) {
      if (import.meta.env.DEV) console.log('[auth] skipping duplicate google exchange (already in flight)')
      return
    }
    hasStarted.current = true
    exchangeInFlight = true

    const code = searchParams.get('code')
    if (!code) {
      exchangeInFlight = false
      setError('No authorization code received from Google.')
      return
    }

    async function exchangeCode() {
      try {
        const baseUrl = getApiBaseUrl()
        const redirectUri = getGoogleRedirectUri()
        if (import.meta.env.DEV) console.log('[auth] exchanging google code, redirectUri:', redirectUri, 'baseUrl:', baseUrl)
        const res = await fetch(`${baseUrl}/api/v1/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirectUri }),
        })

        if (import.meta.env.DEV) console.log('[auth] google response status:', res.status)

        if (!res.ok) {
          const body = await res.json().catch(() => null)
          if (import.meta.env.DEV) console.error('[auth] google error body:', body)
          throw new Error(body?.error ?? `Authentication failed (${res.status})`)
        }

        const data = await res.json()
        const { user, accessToken, refreshToken } = data

        await vaultSetAccessToken(accessToken)
        await vaultSetRefreshToken(refreshToken)

        setAuth(user, accessToken, refreshToken)
        navigate('/')
      } catch (err: unknown) {
        if (import.meta.env.DEV) console.error('[auth] google exchange error:', err)
        setError(err instanceof Error ? err.message : 'Authentication failed')
      } finally {
        setTimeout(() => {
          exchangeInFlight = false
        }, 3000)
      }
    }

    exchangeCode()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-full max-w-sm mx-4 rounded-xl border border-red-500/30 bg-popover p-6 text-center space-y-3">
          <p className="text-sm text-red-400 font-semibold">Authentication Failed</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button
            variant="ghost"
            onClick={() => navigate('/login')}
            className="block mx-auto text-xs text-muted-foreground hover:text-foreground transition-colors mt-2 h-auto px-2 py-1"
          >
            Back to Login
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-3">
        <div className="h-6 w-6 mx-auto animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        <p className="text-sm text-muted-foreground">Signing in with Google…</p>
      </div>
    </div>
  )
}
