import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from './services/api'
import App from './App'
import { migrateSynveloLocalStorage } from './lib/synveloToPhantomMigration'
import './index.css'

// One-time rebrand migration: copy synvelo-* localStorage keys to phantom-*
// and remove the originals. Idempotent (flag-gated). Runs before any state
// reads from localStorage.
migrateSynveloLocalStorage()

// HashRouter fix: Discord redirects to /auth/discord/callback?code=XXX (no hash).
// Convert it to /#/auth/discord/callback?code=XXX so HashRouter can match the route.
if (window.location.pathname === '/auth/discord/callback' && window.location.search) {
  window.location.replace(
    window.location.origin + '/#/auth/discord/callback' + window.location.search
  )
}

// HashRouter fix: Google redirects to /auth/google/callback?code=XXX (no hash) too.
// Same conversion or HashRouter renders LoginPage and the code is silently dropped.
if (window.location.pathname === '/auth/google/callback' && window.location.search) {
  window.location.replace(
    window.location.origin + '/#/auth/google/callback' + window.location.search
  )
}

// Multi-server accounts were removed. Clear their obsolete browser-storage
// records without embedding any historical credential value in public source.
try {
  localStorage.removeItem('vipa-accounts')
  localStorage.removeItem('vipa-active-account')
} catch { /* ignore */ }

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst',
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          // Don't retry 429s — the API client already handles backoff
          // Don't retry 401s — the API client already handles refresh + retry
          // Don't retry 5xx — server errors won't self-resolve on retry
          if (error.status === 429 || error.status === 401 || error.status >= 500) return false
        }
        // When offline, don't retry — serve cached data
        if (!navigator.onLine) return false
        return failureCount < 2
      },
      staleTime: 30000, // 30 seconds
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
)
