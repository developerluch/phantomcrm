// Single canonical backend. Multi-server ServerAccount abstraction was removed
// along with the legacy SetupScreen / ApiKeysSettings surface — phantomcrm-api
// is the only backend the app talks to in prod.
const CANONICAL_API_URL = 'https://phantom-api-production-e27f.up.railway.app'

/**
 * Returns the API base URL for all backend calls.
 * Resolution:
 *   Dev mode → '' (relative, Vite proxy handles it)
 *   Prod     → VITE_API_URL override → canonical phantomcrm-api URL
 */
export function getApiBaseUrl(): string {
  // In Vite dev mode, always use relative paths so the dev proxy handles CORS
  const isDev = (import.meta as any).env?.DEV
  if (isDev) return ''

  const envUrl = (import.meta as any).env?.VITE_API_URL
  if (envUrl) return envUrl.replace(/\/$/, '')

  return CANONICAL_API_URL
}

/**
 * Returns the Discord OAuth redirect URI.
 * Both dev and Electron prod use the localhost callback — Discord doesn't
 * support custom protocol redirects (vipa://) for the Authorization Code flow.
 * The Electron BrowserWindow intercepts the navigation before it hits localhost.
 */
export function getDiscordRedirectUri(): string {
  return 'http://localhost:5173/auth/discord/callback'
}

export function getDiscordClientId(): string {
  return (import.meta as any).env?.VITE_DISCORD_CLIENT_ID || ''
}

export function getDiscordInviteUrl(): string {
  return (import.meta as any).env?.VITE_DISCORD_INVITE_URL || ''
}

/**
 * Google OAuth redirect URI. Same localhost convention as Discord —
 * the Electron BrowserWindow intercepts the navigation before it hits localhost.
 */
export function getGoogleRedirectUri(): string {
  return 'http://localhost:5173/auth/google/callback'
}

export function getGoogleClientId(): string {
  return (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || ''
}
