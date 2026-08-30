// Harness for the renderer-side scrubLocalStorageOnce migration shipped
// alongside the localStorage token-mirror removal (PR #11). Runs in plain
// Node — no browser, no Electron — with mocked window.localStorage +
// window.electronAPI. Copies the production logic verbatim from
// src/services/tokenVault.ts (keep in sync).
//
// Exit 0 on PASS, 1 on FAIL.

let passed = 0
let failed = 0
function assert(name, cond, detail = '') {
  if (cond) {
    passed += 1
    console.log(`  PASS  ${name}`)
  } else {
    failed += 1
    console.error(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`)
  }
}

function mockLocalStorage() {
  const store = new Map()
  return {
    _store: store,
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)) },
    removeItem: (k) => { store.delete(k) },
  }
}

function mockElectronApi({ throwOnSet = false, dropWrites = false } = {}) {
  const vault = { access: null, refresh: null }
  return {
    _vault: vault,
    getToken: async () => vault.access,
    setToken: async (t) => {
      if (throwOnSet) throw new Error('mock ipc failure')
      if (!dropWrites) vault.access = t
    },
    getRefreshToken: async () => vault.refresh,
    setRefreshToken: async (t) => {
      if (throwOnSet) throw new Error('mock ipc failure')
      if (!dropWrites) vault.refresh = t
    },
    clearToken: async () => { vault.access = null; vault.refresh = null },
  }
}

// Production logic — kept in sync with src/services/tokenVault.ts
const LS_ACCESS_KEY = 'vipa-access-token'
const LS_REFRESH_KEY = 'vipa-refresh-token'
const LS_MIGRATION_FLAG = 'vipa-ls-token-migrated-v1'
const DEV_BYPASS_SENTINEL = 'dev-bypass-token'

async function scrubLocalStorageOnce(window) {
  if (typeof window === 'undefined') return
  if (window.localStorage.getItem(LS_MIGRATION_FLAG) === 'true') return
  if (!window.electronAPI) return

  const legacyAccess = window.localStorage.getItem(LS_ACCESS_KEY)
  const legacyRefresh = window.localStorage.getItem(LS_REFRESH_KEY)
  const realAccess =
    legacyAccess && legacyAccess !== DEV_BYPASS_SENTINEL ? legacyAccess : null
  const realRefresh =
    legacyRefresh && legacyRefresh !== DEV_BYPASS_SENTINEL ? legacyRefresh : null

  try {
    if (realAccess) await window.electronAPI.setToken(realAccess)
    if (realRefresh) await window.electronAPI.setRefreshToken(realRefresh)

    const accessOk = realAccess
      ? (await window.electronAPI.getToken()) === realAccess
      : true
    const refreshOk = realRefresh
      ? (await window.electronAPI.getRefreshToken()) === realRefresh
      : true
    if (!accessOk || !refreshOk) return

    if (realAccess) window.localStorage.removeItem(LS_ACCESS_KEY)
    if (realRefresh) window.localStorage.removeItem(LS_REFRESH_KEY)
    window.localStorage.setItem(LS_MIGRATION_FLAG, 'true')
  } catch {
    // leave localStorage alone; retry next boot
  }
}
// --- end production logic ----------------------------------------------------

async function case1_freshInstall() {
  console.log('\ncase1: fresh install (no tokens in localStorage)')
  const win = { localStorage: mockLocalStorage(), electronAPI: mockElectronApi() }
  await scrubLocalStorageOnce(win)
  assert('flag set', win.localStorage.getItem(LS_MIGRATION_FLAG) === 'true')
  assert('no access leaked into vault', win.electronAPI._vault.access === null)
  assert('no refresh leaked into vault', win.electronAPI._vault.refresh === null)
  assert('localStorage still empty for access', win.localStorage.getItem(LS_ACCESS_KEY) === null)
}

async function case2_upgradeBothTokens() {
  console.log('\ncase2: upgrade from pre-PR #11 build with both tokens')
  const win = { localStorage: mockLocalStorage(), electronAPI: mockElectronApi() }
  win.localStorage.setItem(LS_ACCESS_KEY, 'legacy-access-xyz')
  win.localStorage.setItem(LS_REFRESH_KEY, 'legacy-refresh-xyz')
  await scrubLocalStorageOnce(win)
  assert('access moved to vault', win.electronAPI._vault.access === 'legacy-access-xyz')
  assert('refresh moved to vault', win.electronAPI._vault.refresh === 'legacy-refresh-xyz')
  assert('access removed from localStorage', win.localStorage.getItem(LS_ACCESS_KEY) === null)
  assert('refresh removed from localStorage', win.localStorage.getItem(LS_REFRESH_KEY) === null)
  assert('flag set', win.localStorage.getItem(LS_MIGRATION_FLAG) === 'true')
}

async function case3_upgradeAccessOnly() {
  console.log('\ncase3: upgrade with only access token present')
  const win = { localStorage: mockLocalStorage(), electronAPI: mockElectronApi() }
  win.localStorage.setItem(LS_ACCESS_KEY, 'only-access')
  await scrubLocalStorageOnce(win)
  assert('access moved to vault', win.electronAPI._vault.access === 'only-access')
  assert('refresh stays null', win.electronAPI._vault.refresh === null)
  assert('localStorage access scrubbed', win.localStorage.getItem(LS_ACCESS_KEY) === null)
  assert('flag set', win.localStorage.getItem(LS_MIGRATION_FLAG) === 'true')
}

async function case4_idempotent() {
  console.log('\ncase4: second call is a no-op (flag-gated)')
  const win = { localStorage: mockLocalStorage(), electronAPI: mockElectronApi() }
  win.localStorage.setItem(LS_ACCESS_KEY, 'first-run')
  await scrubLocalStorageOnce(win)
  const firstVaultAccess = win.electronAPI._vault.access

  // Now inject a new stale value into localStorage — migration must NOT re-run
  win.localStorage.setItem(LS_ACCESS_KEY, 'should-be-ignored')
  await scrubLocalStorageOnce(win)
  assert('vault unchanged on 2nd call', win.electronAPI._vault.access === firstVaultAccess)
  assert('stale ls value preserved (no re-migration)', win.localStorage.getItem(LS_ACCESS_KEY) === 'should-be-ignored')
}

async function case5_noElectronAPI() {
  console.log('\ncase5: electronAPI missing — no-op, no flag')
  const win = { localStorage: mockLocalStorage(), electronAPI: undefined }
  win.localStorage.setItem(LS_ACCESS_KEY, 'leftover')
  await scrubLocalStorageOnce(win)
  assert('flag NOT set', win.localStorage.getItem(LS_MIGRATION_FLAG) === null)
  assert('localStorage untouched', win.localStorage.getItem(LS_ACCESS_KEY) === 'leftover')
}

async function case6_devBypassPreserved() {
  console.log('\ncase6: dev-bypass-token sentinel stays in localStorage')
  const win = { localStorage: mockLocalStorage(), electronAPI: mockElectronApi() }
  win.localStorage.setItem(LS_ACCESS_KEY, DEV_BYPASS_SENTINEL)
  win.localStorage.setItem(LS_REFRESH_KEY, DEV_BYPASS_SENTINEL)
  await scrubLocalStorageOnce(win)
  assert('vault never sees sentinel', win.electronAPI._vault.access === null)
  assert('access sentinel preserved', win.localStorage.getItem(LS_ACCESS_KEY) === DEV_BYPASS_SENTINEL)
  assert('refresh sentinel preserved', win.localStorage.getItem(LS_REFRESH_KEY) === DEV_BYPASS_SENTINEL)
  assert('flag still set', win.localStorage.getItem(LS_MIGRATION_FLAG) === 'true')
}

async function case7_ipcWriteThrows() {
  console.log('\ncase7: IPC setToken throws — legacy stays, no flag')
  const win = {
    localStorage: mockLocalStorage(),
    electronAPI: mockElectronApi({ throwOnSet: true }),
  }
  win.localStorage.setItem(LS_ACCESS_KEY, 'legacy-access')
  win.localStorage.setItem(LS_REFRESH_KEY, 'legacy-refresh')
  await scrubLocalStorageOnce(win)
  assert('flag NOT set', win.localStorage.getItem(LS_MIGRATION_FLAG) === null)
  assert('legacy access preserved', win.localStorage.getItem(LS_ACCESS_KEY) === 'legacy-access')
  assert('legacy refresh preserved', win.localStorage.getItem(LS_REFRESH_KEY) === 'legacy-refresh')
}

async function case8_ipcWriteRoundTripMismatch() {
  console.log('\ncase8: IPC drops writes silently — verify-then-delete catches it')
  const win = {
    localStorage: mockLocalStorage(),
    electronAPI: mockElectronApi({ dropWrites: true }),
  }
  win.localStorage.setItem(LS_ACCESS_KEY, 'legacy-access')
  await scrubLocalStorageOnce(win)
  assert('flag NOT set on mismatch', win.localStorage.getItem(LS_MIGRATION_FLAG) === null)
  assert('legacy token preserved on mismatch', win.localStorage.getItem(LS_ACCESS_KEY) === 'legacy-access')
}

async function main() {
  await case1_freshInstall()
  await case2_upgradeBothTokens()
  await case3_upgradeAccessOnly()
  await case4_idempotent()
  await case5_noElectronAPI()
  await case6_devBypassPreserved()
  await case7_ipcWriteThrows()
  await case8_ipcWriteRoundTripMismatch()

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('[harness] uncaught', err)
  process.exit(1)
})
