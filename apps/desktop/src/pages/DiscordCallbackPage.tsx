import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store'
import { getApiBaseUrl, getDiscordRedirectUri, getDiscordInviteUrl } from '../services/config'
import { Button } from '@/components/ui/button'
import {
  setAccessToken as vaultSetAccessToken,
  setRefreshToken as vaultSetRefreshToken,
} from '../services/tokenVault'

// Module-level flag survives React StrictMode unmount/remount cycle.
// Discord OAuth codes are single-use — a second call always fails.
let exchangeInFlight = false

export default function DiscordCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [error, setError] = useState<string | null>(null)
  const [guildError, setGuildError] = useState(false)
  const hasStarted = useRef(false)

  useEffect(() => {
    // Guard: module-level flag prevents StrictMode double-fire AND HMR re-fire
    if (exchangeInFlight || hasStarted.current) {
      if (import.meta.env.DEV) console.log('[auth] skipping duplicate exchange (already in flight)')
      return
    }
    hasStarted.current = true
    exchangeInFlight = true

    const code = searchParams.get('code')
    if (!code) {
      exchangeInFlight = false
      setError('No authorization code received from Discord.')
      return
    }

    async function exchangeCode() {
      try {
        const baseUrl = getApiBaseUrl()
        const redirectUri = getDiscordRedirectUri()
        if (import.meta.env.DEV) console.log('[auth] exchanging code, redirectUri:', redirectUri, 'baseUrl:', baseUrl)
        const res = await fetch(`${baseUrl}/api/v1/auth/discord`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirectUri }),
        })

        if (import.meta.env.DEV) console.log('[auth] response status:', res.status)

        if (!res.ok) {
          const body = await res.json().catch(() => null)
          if (import.meta.env.DEV) console.error('[auth] error body:', body)
          if (res.status === 403) {
            setGuildError(true)
            return
          }
          throw new Error(body?.error ?? `Authentication failed (${res.status})`)
        }

        const data = await res.json()
        const { user, accessToken, refreshToken } = data

        await vaultSetAccessToken(accessToken)
        await vaultSetRefreshToken(refreshToken)

        setAuth(user, accessToken, refreshToken)
        navigate('/')
      } catch (err: unknown) {
        if (import.meta.env.DEV) console.error('[auth] exchange error:', err)
        setError(err instanceof Error ? err.message : 'Authentication failed')
      } finally {
        // Reset after a delay so navigating back to this page works
        setTimeout(() => { exchangeInFlight = false }, 3000)
      }
    }

    exchangeCode()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const discordInviteUrl = getDiscordInviteUrl()

  if (guildError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-full max-w-sm mx-4 rounded-xl border border-amber-500/30 bg-popover p-6 text-center space-y-3">
          <p className="text-sm text-amber-400 font-semibold">Server Membership Required</p>
          <p className="text-xs text-muted-foreground">
            You must be a member of the VIPA Discord server to access this dashboard.
          </p>
          {discordInviteUrl && (
            <a
              href={discordInviteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              Join Discord Server
            </a>
          )}
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
        <p className="text-sm text-muted-foreground">Signing in with Discord...</p>
      </div>
    </div>
  )
}
