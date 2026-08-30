const KEY = 'inbox.threadList.scrollTop'

export function loadInboxScroll(): number {
  try {
    const raw = sessionStorage.getItem(KEY)
    const n = raw ? Number(raw) : 0
    return Number.isFinite(n) && n >= 0 ? n : 0
  } catch {
    return 0
  }
}

export function saveInboxScroll(top: number): void {
  try {
    sessionStorage.setItem(KEY, String(Math.max(0, Math.round(top))))
  } catch {
    /* ignore */
  }
}
