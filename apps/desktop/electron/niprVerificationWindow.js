import { BrowserWindow, session } from 'electron'

const NIPR_PARTITION = 'persist:nipr-verification'
const NIPR_USER_INFO_URL = 'https://hub.app.nipr.com/my-nipr/api/user-info.json'
const NIPR_IDENTIFY_URL = 'https://hub.app.nipr.com/my-nipr/frontend/identify-licensee'
const NIPR_AUTH_HOSTS = new Set(['prod.auth.nipr.com'])
const SSN_PATTERNS = [/\b\d{9}\b/g, /\b\d{3}-\d{2}-\d{4}\b/g]
const HARD_TIMEOUT_MS = 10 * 60 * 1000

function isNiprAuthUrl(urlStr) {
  try {
    const url = new URL(urlStr)
    return url.protocol === 'https:' && NIPR_AUTH_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

function scrub(value) {
  let s = typeof value === 'string' ? value : String(value)
  for (const re of SSN_PATTERNS) s = s.replace(re, '[REDACTED-SSN]')
  return s
}

export function openNiprVerificationWindow(parentWindow) {
  return new Promise((resolve) => {
    const partitionSession = session.fromPartition(NIPR_PARTITION, { cache: true })

    const win = new BrowserWindow({
      parent: parentWindow,
      modal: true,
      width: 1100,
      height: 800,
      title: 'Verify your NPN with NIPR',
      webPreferences: {
        partition: NIPR_PARTITION,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        // NO preload — we don't want any renderer hooks inside NIPR's session.
      },
    })

    let promotedAuthUrl = null
    let promotedAuthTimer = null
    let promotedAuthAttempts = 0

    function errorMessage(err) {
      return scrub(err?.message ?? err)
    }

    function isAbortError(err) {
      return errorMessage(err).includes('ERR_ABORTED')
    }

    function isExpectedInitialLoadAbort(err) {
      return isAbortError(err) && promotedAuthUrl !== null
    }

    win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame && isNiprAuthUrl(validatedURL)) {
        loadTopLevel(validatedURL)
        return
      }
      if (isMainFrame) {
        console.error('[nipr] did-fail-load:', {
          errorCode,
          errorDescription: scrub(errorDescription),
          url: scrub(validatedURL),
        })
      }
    })

    function loadTopLevel(url) {
      resetTimeout()
      if (promotedAuthUrl === url && promotedAuthTimer) return
      promotedAuthUrl = url
      promotedAuthAttempts = 0

      const tryLoad = () => {
        if (resolved || win.isDestroyed()) return
        promotedAuthTimer = null
        promotedAuthAttempts += 1

        win.loadURL(url).catch((err) => {
          if (isAbortError(err) && promotedAuthAttempts < 3) {
            promotedAuthTimer = setTimeout(tryLoad, 150)
            return
          }

          console.error('[nipr] top-level navigation failed:', errorMessage(err))
          settle({ error: 'Could not open NIPR sign-in.' })
        })
      }

      promotedAuthTimer = setTimeout(tryLoad, 0)
    }

    win.webContents.on('will-frame-navigate', (event) => {
      if (event.isMainFrame || !isNiprAuthUrl(event.url)) return
      event.preventDefault()
      loadTopLevel(event.url)
    })

    win.webContents.setWindowOpenHandler(({ url }) => {
      if (isNiprAuthUrl(url)) loadTopLevel(url)
      return { action: 'deny' }
    })

    let resolved = false
    const pendingUserInfoRequestIds = new Set()
    let timeoutHandle = null

    function settle(result) {
      if (resolved) return
      resolved = true
      cleanup().finally(() => resolve(result))
    }

    function resetTimeout() {
      if (timeoutHandle) clearTimeout(timeoutHandle)
      timeoutHandle = setTimeout(() => {
        settle({ error: 'Verification timed out — please try again.' })
      }, HARD_TIMEOUT_MS)
    }

    async function cleanup() {
      if (timeoutHandle) clearTimeout(timeoutHandle)
      if (promotedAuthTimer) clearTimeout(promotedAuthTimer)
      try { win.webContents.debugger.detach() } catch { /* ignore */ }
      try {
        await partitionSession.clearStorageData({
          storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage'],
        })
      } catch (err) {
        console.error('[nipr] clearStorageData failed:', scrub(err?.message ?? err))
      }
      if (!win.isDestroyed()) win.close()
    }

    function onDebuggerMessage(_event, method, params) {
      try {
        if (method === 'Network.responseReceived') {
          const { response, requestId } = params
          if (response?.url === NIPR_USER_INFO_URL && response.status === 200) {
            pendingUserInfoRequestIds.add(requestId)
            resetTimeout()
          } else if (response?.url?.startsWith('https://hub.app.nipr.com/')) {
            // Reset timeout on any NIPR traffic so slow flows don't trip it.
            resetTimeout()
          }
        } else if (method === 'Network.loadingFinished' && pendingUserInfoRequestIds.has(params.requestId)) {
          const requestId = params.requestId
          pendingUserInfoRequestIds.delete(requestId)
          win.webContents.debugger.sendCommand('Network.getResponseBody', { requestId })
            .then((body) => {
              let raw = body?.body ?? ''
              if (body?.base64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8')
              let parsed
              try {
                parsed = JSON.parse(raw)
              } catch {
                console.warn('[nipr] ignored unparsable user-info response')
                return
              }
              const uid = parsed?.uid
              const npn = parsed?.npn
              const name = parsed?.name
              if (typeof uid !== 'string' || !/^P:I:\d+$/.test(uid)) {
                console.warn('[nipr] ignored user-info response without producer uid')
                return
              }
              if (typeof npn !== 'string' || typeof name !== 'string') {
                console.warn('[nipr] ignored user-info response missing npn or name')
                return
              }
              settle({ npn, canonical_name: name, uid })
            })
            .catch((err) => {
              console.warn('[nipr] ignored unreadable user-info response:', scrub(err?.message ?? err))
            })
        } else if (method === 'Network.loadingFailed') {
          pendingUserInfoRequestIds.delete(params.requestId)
        }
      } catch (err) {
        console.error('[nipr] debugger message handler error:', scrub(err?.message ?? err))
      }
    }

    win.on('closed', () => {
      if (!resolved) {
        resolved = true
        if (timeoutHandle) clearTimeout(timeoutHandle)
        try { win.webContents?.debugger?.detach?.() } catch { /* ignore */ }
        partitionSession.clearStorageData({
          storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage'],
        }).catch(() => {})
        resolve({ cancelled: true })
      }
    })

    try {
      win.webContents.debugger.attach('1.3')
    } catch (err) {
      console.error('[nipr] debugger.attach failed:', scrub(err?.message ?? err))
      settle({ error: 'Could not initialise NIPR verification window.' })
      return
    }

    win.webContents.debugger.on('message', onDebuggerMessage)

    function enableNetworkCapture() {
      win.webContents.debugger
        .sendCommand('Network.enable')
        .catch((err) => {
          console.error('[nipr] Network.enable failed:', scrub(err?.message ?? err))
          settle({ error: 'Could not initialise NIPR verification capture.' })
        })
    }

    win.webContents.once('dom-ready', enableNetworkCapture)

    resetTimeout()
    win.loadURL(NIPR_IDENTIFY_URL)
      .catch((err) => {
        if (isExpectedInitialLoadAbort(err)) return
        console.error('[nipr] loadURL failed:', errorMessage(err))
        settle({ error: 'Could not open NIPR Hub.' })
      })
  })
}
