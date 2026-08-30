// One-time renderer-side migration: copy any localStorage keys with the
// legacy `synvelo-` prefix to the new `phantom-` prefix, then remove the old.
//
// Runs at app boot before any auth/state code reads localStorage. Idempotent —
// the `phantom-ls-migrated-v1` flag prevents re-runs on subsequent boots.
//
// Out of scope:
//   - vipa-* keys (auth tokens; phased out separately via the safeStorage migration)
//   - electron-store data (lives in main process, not renderer localStorage)
//
// Why a separate module: matches the existing one-off cleanup pattern in
// main.tsx legacy-account purge, so future migrations can follow this shape.

const MIGRATION_FLAG = 'phantom-ls-migrated-v1'
const LEGACY_PREFIX = 'synvelo-'
const NEW_PREFIX = 'phantom-'

export function migrateSynveloLocalStorage(): { migrated: number; skipped: boolean } {
  try {
    if (localStorage.getItem(MIGRATION_FLAG) === 'true') {
      return { migrated: 0, skipped: true }
    }

    // Snapshot keys first — modifying localStorage while iterating is undefined.
    const legacyKeys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(LEGACY_PREFIX)) {
        legacyKeys.push(key)
      }
    }

    let migrated = 0
    for (const oldKey of legacyKeys) {
      const value = localStorage.getItem(oldKey)
      if (value === null) continue
      const newKey = NEW_PREFIX + oldKey.slice(LEGACY_PREFIX.length)
      // Don't clobber a phantom-* value that already exists (defensive).
      if (localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, value)
      }
      localStorage.removeItem(oldKey)
      migrated++
    }

    localStorage.setItem(MIGRATION_FLAG, 'true')
    return { migrated, skipped: false }
  } catch {
    // localStorage can throw in privacy modes / Safari quotas. Fail open —
    // app continues to boot, just without migration.
    return { migrated: 0, skipped: true }
  }
}
