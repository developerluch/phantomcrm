const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getToken: () => ipcRenderer.invoke('get-token'),
  setToken: (token) => ipcRenderer.invoke('set-token', token),
  clearToken: () => ipcRenderer.invoke('clear-token'),
  getRefreshToken: () => ipcRenderer.invoke('get-refresh-token'),
  setRefreshToken: (token) => ipcRenderer.invoke('set-refresh-token', token),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  discordOAuth: (url) => ipcRenderer.invoke('discord-oauth', url),
  onAuthCallback: (callback) => {
    const handler = (_event, url) => callback(url)
    ipcRenderer.on('auth-callback', handler)
    // Return unsubscribe function so React can clean up
    return () => ipcRenderer.removeListener('auth-callback', handler)
  },
  removeAllAuthCallbacks: () => ipcRenderer.removeAllListeners('auth-callback'),

  googleOAuth: (url) => ipcRenderer.invoke('google-oauth', url),
  onAuthCallbackGoogle: (callback) => {
    const handler = (_event, url) => callback(url)
    ipcRenderer.on('auth-callback-google', handler)
    return () => ipcRenderer.removeListener('auth-callback-google', handler)
  },
  removeAllAuthCallbacksGoogle: () => ipcRenderer.removeAllListeners('auth-callback-google'),
  platform: process.platform,

  // Auto-update API
  onUpdateStatus: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('update-status', handler)
    return () => ipcRenderer.removeListener('update-status', handler)
  },
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

  // Fn key monitoring (macOS native)
  onFnKey: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('fn-key', handler)
    return () => ipcRenderer.removeListener('fn-key', handler)
  },

  // Deep link handler (vipa:// protocol)
  onDeepLink: (callback) => {
    const handler = (_event, data) => callback(data)
    ipcRenderer.on('deep-link', handler)
    return () => ipcRenderer.removeListener('deep-link', handler)
  },

  // Window close confirmation
  onConfirmClose: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('confirm-close', handler)
    return () => ipcRenderer.removeListener('confirm-close', handler)
  },
  respondToCloseConfirm: (shouldClose) => ipcRenderer.invoke('confirm-close-response', shouldClose),
})

contextBridge.exposeInMainWorld('nipr', {
  openVerification: () => ipcRenderer.invoke('nipr:open-verification'),
})
