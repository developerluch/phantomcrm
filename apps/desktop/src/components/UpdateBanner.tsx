import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

/** Shape of the update-status IPC payload from the main process. */
interface UpdateStatus {
  status: 'checking' | 'available' | 'downloading' | 'ready' | 'error'
  version?: string
  percent?: number
  message?: string
}

/**
 * A top-of-screen banner that communicates auto-update lifecycle to the user.
 * Only renders inside an Electron environment (checks `window.electronAPI`).
 */
export default function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const api = (window as any).electronAPI // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!api?.onUpdateStatus) return

    const unsubscribe = api.onUpdateStatus((data: UpdateStatus) => {
      setDismissed(false)
      setUpdate(data)
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [])

  // Nothing to show
  if (!update || dismissed) return null
  // Hide the "checking" state -- it is transient noise
  if (update.status === 'checking') return null

  // -- Available: blue banner with version + Download button --
  if (update.status === 'available') {
    return (
      <div className="w-full bg-blue-600 text-white text-sm px-4 py-2 flex items-center justify-between shrink-0">
        <span>
          A new version{update.version ? ` (v${update.version})` : ''} is
          available.
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (window as any).electronAPI?.downloadUpdate()} // eslint-disable-line @typescript-eslint/no-explicit-any
          className="ml-4 bg-white/20 hover:bg-white/30 text-white font-medium"
        >
          Download
        </Button>
      </div>
    )
  }

  // -- Downloading: progress bar with percentage --
  if (update.status === 'downloading') {
    const pct = Math.round(update.percent ?? 0)
    return (
      <div className="w-full bg-blue-600 text-white text-sm px-4 py-2 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span>Downloading update... {pct}%</span>
        </div>
        <Progress value={pct} className="h-1.5 bg-white/20" />
      </div>
    )
  }

  // -- Ready: green banner with Restart button --
  if (update.status === 'ready') {
    return (
      <div className="w-full bg-emerald-600 text-white text-sm px-4 py-2 flex items-center justify-between shrink-0">
        <span>Update downloaded. Restart to apply.</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (window as any).electronAPI?.installUpdate()} // eslint-disable-line @typescript-eslint/no-explicit-any
          className="ml-4 bg-white/20 hover:bg-white/30 text-white font-medium"
        >
          Restart
        </Button>
      </div>
    )
  }

  // -- Error: red banner, dismissible --
  if (update.status === 'error') {
    return (
      <div className="w-full bg-red-600 text-white text-sm px-4 py-2 flex items-center justify-between shrink-0">
        <span>Update error: {update.message ?? 'Unknown error'}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDismissed(true)}
          className="ml-4 bg-white/20 hover:bg-white/30 text-white font-medium"
        >
          Dismiss
        </Button>
      </div>
    )
  }

  return null
}
