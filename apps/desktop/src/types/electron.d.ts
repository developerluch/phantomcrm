export {}

declare global {
  interface Window {
    electronAPI?: {
      getToken: () => Promise<string | null>
      setToken: (token: string) => Promise<void>
      clearToken: () => Promise<void>
      getRefreshToken: () => Promise<string | null>
      setRefreshToken: (token: string) => Promise<void>
      openExternal: (url: string) => Promise<void>
      discordOAuth: (url: string) => Promise<string | null>
      onAuthCallback: (callback: (url: string) => void) => () => void
      removeAllAuthCallbacks: () => void
      googleOAuth: (url: string) => Promise<string | null>
      onAuthCallbackGoogle: (callback: (url: string) => void) => () => void
      removeAllAuthCallbacksGoogle: () => void
      platform: string

      // Auto-update API
      onUpdateStatus: (callback: (data: {
        status: 'checking' | 'available' | 'downloading' | 'ready' | 'error'
        version?: string
        percent?: number
        message?: string
      }) => void) => () => void
      downloadUpdate: () => Promise<void>
      installUpdate: () => Promise<void>
      checkForUpdates: () => Promise<void>

      // Fn key monitoring (macOS native)
      onFnKey: (callback: (data: {
        pressed?: boolean
        error?: string
      }) => void) => () => void

      // Deep link handler (vipa:// protocol)
      onDeepLink: (callback: (data: { type: string; token?: string }) => void) => () => void

      // Window close confirmation
      onConfirmClose: (callback: () => void) => () => void
      respondToCloseConfirm: (shouldClose: boolean) => Promise<void>
    }
    nipr?: {
      openVerification: () => Promise<
        | { npn: string; canonical_name: string; uid: string }
        | { cancelled: true }
        | { error: string }
      >
    }
  }
}

declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        src?: string
        allowpopups?: string
        preload?: string
        partition?: string
      },
      HTMLElement
    >
  }
}
