import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { openNiprVerificationWindow } from './niprVerificationWindow.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow
let store
let fnMonitorProcess = null
let closeConfirmed = false

// Hostnames the renderer is allowed to hand off to the OS browser via
// shell.openExternal (#6). Anything else — user-controlled URLs, unknown
// redirect targets, exotic protocols — is denied and logged.
const ALLOWED_EXTERNAL_HOSTS = new Set([
  'discord.com',
  'canary.discord.com',
  'ptb.discord.com',
  'cdn.discordapp.com',
  'accounts.google.com',
  'calendar.google.com',
  'meet.google.com',
  'cal.com',
  'phantom-api-production-e27f.up.railway.app',
  'github.com',
  'www.github.com',
])

function isAllowedExternalUrl(urlStr) {
  try {
    const u = new URL(urlStr)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    if (ALLOWED_EXTERNAL_HOSTS.has(u.hostname)) return true
    // Allow any *.discord.com and *.cal.com subdomain
    if (u.hostname.endsWith('.discord.com')) return true
    if (u.hostname.endsWith('.cal.com')) return true
    return false
  } catch {
    return false
  }
}
async function initStore() {
  const { default: Store } = await import('electron-store')
  store = new Store({
    name: 'vipa-auth',
    encryptionKey: 'vipa-recruit-dashboard-v1',
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1900,
    height: 1000,
    minWidth: 1200,
    minHeight: 700,
    show: true,
    title: 'Phantom CRM',
    backgroundColor: '#0a0a0a',
    titleBarStyle: 'hiddenInset',
    titleBarOverlay: {
      color: '#0a0a0a',
      symbolColor: '#ffffff',
      height: 36,
    },
    trafficLightPosition: { x: 16, y: 12 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,        // #6 — renderer can't call raw Node; preload is sandbox-safe (ipcRenderer + contextBridge only)
      webviewTag: false,    // #6 — no <webview> anywhere in the app; disable the attack surface
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // In dev, load from Vite dev server; in prod, load built files
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(process.resourcesPath, 'dist', 'index.html'))
  }

  // #6 — deny window.open by default; route allow-listed URLs to the user's browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // #6 — block cross-origin navigations on the main window.
  // Same-origin nav (including HashRouter #/ changes — hash changes don't fire
  // will-navigate anyway, but pushState same-origin nav does) stays allowed.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const target = new URL(url)
      const current = new URL(mainWindow.webContents.getURL())
      if (target.origin === current.origin) return // same-origin, permit
    } catch { /* fall through to deny */ }
    event.preventDefault()
  })

  mainWindow.on('close', (e) => {
    if (closeConfirmed) return
    e.preventDefault()
    mainWindow?.webContents.send('confirm-close')
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/**
 * Initializes the electron-updater auto-update system.
 * Forwards update lifecycle events to the renderer via IPC
 * and registers handlers for user-initiated actions.
 */
async function initAutoUpdater() {
  try {
    // Dynamic import — electron-updater may not be available in dev
    const { autoUpdater } = await import('electron-updater')

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    // Forward update events to the renderer process
    autoUpdater.on('checking-for-update', () => {
      mainWindow?.webContents.send('update-status', { status: 'checking' })
    })

    autoUpdater.on('update-available', (info) => {
      mainWindow?.webContents.send('update-status', {
        status: 'available',
        version: info.version,
      })
    })

    autoUpdater.on('download-progress', (progress) => {
      mainWindow?.webContents.send('update-status', {
        status: 'downloading',
        percent: progress.percent,
      })
    })

    autoUpdater.on('update-downloaded', () => {
      mainWindow?.webContents.send('update-status', { status: 'ready' })
    })

    autoUpdater.on('error', (err) => {
      mainWindow?.webContents.send('update-status', {
        status: 'error',
        message: err.message,
      })
    })

    // IPC handlers for renderer-initiated update actions
    ipcMain.handle('download-update', () => autoUpdater.downloadUpdate())
    ipcMain.handle('install-update', () => autoUpdater.quitAndInstall())
    ipcMain.handle('check-for-updates', () => autoUpdater.checkForUpdates())

    // Check for updates 3 seconds after launch, then every 4 hours
    setTimeout(() => {
      autoUpdater.checkForUpdates()
    }, 3_000)

    setInterval(() => {
      autoUpdater.checkForUpdates()
    }, 4 * 60 * 60 * 1_000)
  } catch (err) {
    console.log('Auto-updater not available:', err.message)
  }
}

function registerIpcHandlers() {
  ipcMain.handle('confirm-close-response', (_event, shouldClose) => {
    if (shouldClose && mainWindow && !mainWindow.isDestroyed()) {
      closeConfirmed = true
      mainWindow.close()
    }
  })

  ipcMain.handle('get-token', () => {
    return store?.get('accessToken', null) ?? null
  })

  ipcMain.handle('set-token', (_event, token) => {
    store?.set('accessToken', token)
  })

  ipcMain.handle('clear-token', () => {
    store?.delete('accessToken')
    store?.delete('refreshToken')
  })

  ipcMain.handle('get-refresh-token', () => {
    return store?.get('refreshToken', null) ?? null
  })

  ipcMain.handle('set-refresh-token', (_event, token) => {
    store?.set('refreshToken', token)
  })

  ipcMain.handle('open-external', (_event, url) => {
    // #6 — only allow-listed hosts may reach the OS browser. Anything else
    // (malicious URL injection via XSS, stray javascript:, file:, etc.) is dropped.
    if (!isAllowedExternalUrl(url)) {
      return false
    }
    return shell.openExternal(url)
  })

  ipcMain.handle('open-chat-window', () => {
    const chatWin = new BrowserWindow({
      width: 420,
      height: 680,
      minWidth: 400,
      minHeight: 500,
      frame: true,
      alwaysOnTop: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
      },
    })
    // Load the same app URL with a chat query param
    const mainUrl = mainWindow.webContents.getURL()
    const chatUrl = new URL(mainUrl)
    chatUrl.searchParams.set('chat', 'detached')
    chatWin.loadURL(chatUrl.toString())
    return true
  })

  ipcMain.handle('discord-oauth', async (_event, oauthUrl) => {
    return new Promise((resolve) => {
      const authWindow = createAuthWindow(mainWindow, 'Sign in with Discord — Phantom')
      let handled = false

      function handleNavigation(url) {
        if (handled) return true
        try {
          const parsed = new URL(url)
          if (
            parsed.pathname?.includes('/auth/discord/callback') ||
            url.startsWith('vipa://')
          ) {
            const code = parsed.searchParams.get('code')
            handled = true
            if (code) {
              mainWindow.webContents.send('auth-callback', code)
            }
            authWindow.close()
            resolve(code || null)
            return true
          }
        } catch {}
        return false
      }

      authWindow.webContents.on('will-redirect', (event, url) => {
        if (handleNavigation(url)) event.preventDefault()
      })

      authWindow.webContents.on('will-navigate', (event, url) => {
        if (handleNavigation(url)) event.preventDefault()
      })

      authWindow.on('closed', () => resolve(null))
      authWindow.loadURL(oauthUrl)
    })
  })

  ipcMain.handle('google-oauth', async (_event, oauthUrl) => {
    return new Promise((resolve) => {
      const authWindow = createAuthWindow(mainWindow, 'Sign in with Google — Phantom')
      let handled = false

      function handleNavigation(url) {
        if (handled) return true
        try {
          const parsed = new URL(url)
          if (parsed.pathname?.includes('/auth/google/callback')) {
            const code = parsed.searchParams.get('code')
            handled = true
            if (code) {
              mainWindow.webContents.send('auth-callback-google', code)
            }
            authWindow.close()
            resolve(code || null)
            return true
          }
        } catch {}
        return false
      }

      authWindow.webContents.on('will-redirect', (event, url) => {
        if (handleNavigation(url)) event.preventDefault()
      })

      authWindow.webContents.on('will-navigate', (event, url) => {
        if (handleNavigation(url)) event.preventDefault()
      })

      authWindow.on('closed', () => resolve(null))
      authWindow.loadURL(oauthUrl)
    })
  })

  ipcMain.handle('nipr:open-verification', async (event) => {
    const parent = BrowserWindow.fromWebContents(event.sender)
    if (!parent) return { error: 'No parent window — cannot open NIPR verification.' }
    return openNiprVerificationWindow(parent)
  })
}

/**
 * Creates a detached, non-modal OAuth popup offset from the main window.
 * Designed to feel like a standard browser window — separate OS window with
 * standard title bar, so users see it as a distinct sign-in surface.
 */
function createAuthWindow(parentWindow, title = 'Sign in — Phantom') {
  const mainBounds = parentWindow.getBounds()
  const authWindow = new BrowserWindow({
    width: 500,
    height: 720,
    x: mainBounds.x + 80,
    y: mainBounds.y + 40,
    // parent intentionally omitted → separate OS window, not a child
    modal: false,
    show: false,
    backgroundColor: '#0a0a0a',
    autoHideMenuBar: true,
    title,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })
  authWindow.once('ready-to-show', () => authWindow.show())
  authWindow.setMenuBarVisibility(false)
  return authWindow
}

function registerProtocolHandler() {
  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('vipa', process.execPath, [
        path.resolve(process.argv[1]),
      ])
    }
  } else {
    app.setAsDefaultProtocolClient('vipa')
  }

  // Handle the vipa:// protocol on macOS
  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleAuthCallback(url)
  })

  // Handle the vipa:// protocol on Windows/Linux (second-instance)
  const gotTheLock = app.requestSingleInstanceLock()
  if (!gotTheLock) {
    app.quit()
  } else {
    app.on('second-instance', (_event, commandLine) => {
      const url = commandLine.find((arg) => arg.startsWith('vipa://'))
      if (url) {
        handleAuthCallback(url)
      }
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.focus()
      }
    })
  }
}

function handleAuthCallback(url) {
  if (!mainWindow) return
  try {
    const parsed = new URL(url)
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

    // Password reset deep-link: vipa://reset?token=XXX
    // The URL host is 'reset' (e.g. vipa://reset?token=...)
    const isReset =
      parsed.host === 'reset' ||
      parsed.hostname === 'reset' ||
      parsed.pathname === '/reset' ||
      parsed.pathname === 'reset'
    if (isReset) {
      const token = parsed.searchParams.get('token')
      if (!token) return
      if (isDev) {
        mainWindow.loadURL(
          `http://localhost:5173/#/reset-password?token=${encodeURIComponent(token)}`
        )
      } else {
        mainWindow.webContents.send('deep-link', { type: 'reset', token })
      }
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      return
    }

    // Google auth callback (detect by path)
    if (parsed.pathname?.includes('/auth/google/callback')) {
      const gcode = parsed.searchParams.get('code')
      if (gcode) {
        if (isDev) {
          mainWindow.loadURL(`http://localhost:5173/auth/google/callback?code=${encodeURIComponent(gcode)}`)
        } else {
          mainWindow.webContents.send('auth-callback-google', gcode)
        }
      }
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      return
    }

    // Discord auth callback
    const code = parsed.searchParams.get('code')
    if (code) {
      if (isDev) {
        mainWindow.loadURL(`http://localhost:5173/auth/discord/callback?code=${encodeURIComponent(code)}`)
      } else {
        mainWindow.webContents.send('auth-callback', code)
      }
    }
  } catch {
    // Invalid URL, ignore
  }
}

function startFnMonitor() {
  if (process.platform !== 'darwin') return
  if (fnMonitorProcess) return

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
  const binaryPath = isDev
    ? path.join(__dirname, 'native', 'bin', 'fn-monitor')
    : path.join(process.resourcesPath, 'fn-monitor')

  if (!fs.existsSync(binaryPath)) {
    console.log('fn-monitor binary not found at', binaryPath)
    return
  }

  try {
    fnMonitorProcess = spawn(binaryPath, [], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let buffer = ''
    fnMonitorProcess.stdout.on('data', (data) => {
      buffer += data.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop()

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line)
          if (event.event === 'fn-down') {
            if (mainWindow?.isFocused()) {
              mainWindow.webContents.send('fn-key', { pressed: true })
            }
          } else if (event.event === 'fn-up') {
            if (mainWindow?.isFocused()) {
              mainWindow.webContents.send('fn-key', { pressed: false })
            }
          } else if (event.event === 'error' && event.message === 'accessibility_permission_required') {
            mainWindow?.webContents.send('fn-key', { error: 'accessibility_permission_required' })
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    })

    fnMonitorProcess.stderr.on('data', (data) => {
      console.error('fn-monitor stderr:', data.toString())
    })

    fnMonitorProcess.on('exit', (code) => {
      console.log('fn-monitor exited with code:', code)
      fnMonitorProcess = null
    })
  } catch (err) {
    console.error('Failed to start fn-monitor:', err.message)
  }
}

function stopFnMonitor() {
  if (fnMonitorProcess) {
    fnMonitorProcess.kill('SIGTERM')
    fnMonitorProcess = null
  }
}

// #6 — globally veto <webview> attachment on every WebContents Electron spawns.
// The main window already sets webviewTag: false; this catches auth popups,
// chat window, anything else that might forget.
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })
})

app.whenReady().then(async () => {
  await initStore()
  registerIpcHandlers()
  registerProtocolHandler()
  createWindow()
  startFnMonitor()
  initAutoUpdater()
})

app.on('will-quit', () => {
  stopFnMonitor()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
  startFnMonitor()
})
