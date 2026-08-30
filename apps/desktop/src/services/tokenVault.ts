// Renderer-side single chokepoint for auth token I/O.
//
// Tokens live in Electron main's safeStorage-backed electron-store (PR #7).
// This module routes every renderer read/write through IPC, so the tokens
// never touch window.localStorage where any injected script could exfiltrate
// them. scrubLocalStorageOnce() migrates users upgrading from pre-PR #11
// builds without logging them out.

const LS_ACCESS_KEY = 'vipa-access-token'
const LS_REFRESH_KEY = 'vipa-refresh-token'
const LS_MIGRATION_FLAG = 'vipa-ls-token-migrated-v1'

const IS_DEV = import.meta.env.DEV
const SHOULD_DEBUG_DEV_FALLBACK = import.meta.env.VITE_TOKEN_VAULT_DEBUG === 'true'

// Dev-only fallback for pure `npm run dev` (no Electron preload).
// In-memory Map only — no persistence, no storage leak. Wiped on full reload.
const devMemoryVault = new Map<'access' | 'refresh', string>()

function hasElectronApi(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI
}

let loggedDevFallback = false

// Returns true when Electron's secure storage is available.
// Returns false when running pure `vite dev` without an Electron host. That
// browser-only mode is expected during frontend development, so the fallback is
// silent by default and can be traced with VITE_TOKEN_VAULT_DEBUG=true.
// Throws fail-closed in any production build —
// the in-memory dev fallback must NEVER silently engage in prod, even if
// the bundle is somehow served outside Electron (web build, misconfigured
// CI, etc.). This is defense-in-depth: in practice IS_DEV gating already
// keeps the dev branch out of packaged builds.
function ensureSecureStorageOrFail(): boolean {
  if (hasElectronApi()) return true
  if (!IS_DEV) {
    throw new Error('tokenVault: secure storage unavailable in production build')
  }
  if (SHOULD_DEBUG_DEV_FALLBACK && !loggedDevFallback) {
    loggedDevFallback = true
    // eslint-disable-next-line no-console
    console.debug('[tokenVault] using in-memory dev fallback (no Electron host detected)')
  }
  return false
}

export async function getAccessToken(): Promise<string | null> {
  if (ensureSecureStorageOrFail()) {
    return (await window.electronAPI!.getToken()) ?? null
  }
  return devMemoryVault.get('access') ?? null
}

export async function setAccessToken(token: string): Promise<void> {
  if (ensureSecureStorageOrFail()) {
    await window.electronAPI!.setToken(token)
    return
  }
  devMemoryVault.set('access', token)
}

export async function getRefreshToken(): Promise<string | null> {
  if (ensureSecureStorageOrFail()) {
    return (await window.electronAPI!.getRefreshToken()) ?? null
  }
  return devMemoryVault.get('refresh') ?? null
}

export async function setRefreshToken(token: string): Promise<void> {
  if (ensureSecureStorageOrFail()) {
    await window.electronAPI!.setRefreshToken(token)
    return
  }
  devMemoryVault.set('refresh', token)
}

export async function clearTokens(): Promise<void> {
  if (ensureSecureStorageOrFail()) {
    await window.electronAPI!.clearToken()
    return
  }
  devMemoryVault.clear()
}

// Idempotent one-time migration for users upgrading from pre-PR #11 builds.
// Reads any leftover localStorage tokens, copies them into the vault via IPC,
// verifies the IPC write round-tripped, then removes the localStorage entries.
// On any failure (missing electronAPI, IPC write mismatch) leaves localStorage
// intact and does NOT set the flag, so the next boot retries.
//
// Called from both AuthGate boot AND api.ts doRefresh(). The flag short-circuits
// the second+ call to a single localStorage.getItem — free belt-and-suspenders
// protection against races where background refetches fire before AuthGate mounts.
export async function scrubLocalStorageOnce(): Promise<void> {
  if (typeof window === 'undefined') return
  if (window.localStorage.getItem(LS_MIGRATION_FLAG) === 'true') return
  if (!hasElectronApi()) return // No vault to migrate into — retry next boot

  const realAccess = window.localStorage.getItem(LS_ACCESS_KEY)
  const realRefresh = window.localStorage.getItem(LS_REFRESH_KEY)

  try {
    if (realAccess) await window.electronAPI!.setToken(realAccess)
    if (realRefresh) await window.electronAPI!.setRefreshToken(realRefresh)

    // Verify-then-delete: only scrub localStorage if IPC round-tripped
    const accessOk = realAccess
      ? (await window.electronAPI!.getToken()) === realAccess
      : true
    const refreshOk = realRefresh
      ? (await window.electronAPI!.getRefreshToken()) === realRefresh
      : true

    if (!accessOk || !refreshOk) return // Leave legacy in place; retry next boot

    if (realAccess) window.localStorage.removeItem(LS_ACCESS_KEY)
    if (realRefresh) window.localStorage.removeItem(LS_REFRESH_KEY)
    window.localStorage.setItem(LS_MIGRATION_FLAG, 'true')
  } catch {
    // IPC threw — leave localStorage untouched so next boot can retry
  }
}
