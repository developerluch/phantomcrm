const KEY = 'inbox.mockMode'

export function isMockMode(): boolean {
  if (!import.meta.env.DEV) return false
  try {
    return localStorage.getItem(KEY) === 'true'
  } catch {
    return false
  }
}

export function enableMockMode(): void {
  if (!import.meta.env.DEV) return
  try {
    localStorage.setItem(KEY, 'true')
  } catch {
    // ignore — Safari private mode or similar
  }
}

export function disableMockMode(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
