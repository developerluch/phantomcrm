import React, { Suspense, lazy, useEffect, type ReactNode } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { AuthGate } from './components/AuthGate'
import { AppShell } from './components/AppShell'
import { SplashGate } from './components/SplashGate'
import { ThemeProvider } from './components/ThemeProvider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ErrorBoundary } from './components/ErrorBoundary'
import CloseConfirmDialog from './components/CloseConfirmDialog'
import { useThemeStore } from './store/theme-store'

// Auth pages (eagerly loaded — critical path)
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DiscordCallbackPage from './pages/DiscordCallbackPage'
import GoogleCallbackPage from './pages/GoogleCallbackPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import MfaPlaceholderPage from './pages/MfaPlaceholderPage'

// Protected pages (lazy loaded — code-split)
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const AgentsPage = lazy(() => import('./pages/AgentsPage'))
const AgentDetailPage = lazy(() => import('./pages/AgentDetailPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const CompTiersPage = lazy(() => import('./pages/CompTiersPage'))
const PolicyDashboardPage = lazy(() => import('./pages/PolicyDashboardPage'))
const BookOfBusinessPage = lazy(() => import('./pages/BookOfBusinessPage'))
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'))
const RecruitsPage = lazy(() => import('./pages/RecruitsPage'))
const SalesPage = lazy(() => import('./pages/SalesPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const LicensesPage = lazy(() => import('./pages/LicensesPage'))
const AdminLicensesPage = lazy(() => import('./pages/AdminLicensesPage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'))
const ServersPage = lazy(() => import('./pages/ServersPage'))
const ApprovalQueuePage = lazy(() => import('./pages/ApprovalQueuePage'))
const WAVVTrackerPage = lazy(() => import('./pages/WAVVTrackerPage'))
const ReportsPage = lazy(() => import('./pages/ReportsPage'))
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const DocumentVaultPage = lazy(() => import('./pages/DocumentVaultPage'))
const CampaignManagerPage = lazy(() => import('./pages/CampaignManagerPage'))
const UsersRolesPage = lazy(() => import('./pages/UsersRolesPage'))
const LockInsPage = lazy(() => import('./pages/LockInsPage'))
const LockInWorkspacePage = lazy(() => import('./pages/LockInWorkspacePage'))
const OrgChartPage = lazy(() => import('./pages/OrgChartPage'))
const PipelineSettingsPage = lazy(() => import('./pages/PipelineSettingsPage'))
const AIChatPage = lazy(() => import('./pages/AIChatPage'))
const DiscordHubPage = lazy(() => import('./pages/DiscordHubPage'))
const MiscPage = lazy(() => import('./pages/MiscPage'))
const ContactsPage = lazy(() => import('./pages/crm/ContactsPage'))
const SmartListsPage = lazy(() => import('./pages/crm/SmartListsPage'))
const InboxPage = lazy(() => import('./pages/crm/InboxPage'))

// Module-level guards: only one auth-callback navigation at a time per provider
let authNavInFlight = false
let googleAuthNavInFlight = false

// Feature flag — read once at module scope. Gates the /crm/* routes behind VITE_CRM_M1=true.
// When unset, all CRM paths redirect to '/' so the group is unreachable even via direct URL.
const CRM_M1_ENABLED = (import.meta as any).env?.VITE_CRM_M1 === 'true'

function ElectronAuthListener() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!window.electronAPI?.onAuthCallback) return

    // Clear any stale listeners from previous mounts (StrictMode safety)
    window.electronAPI.removeAllAuthCallbacks?.()
    window.electronAPI.removeAllAuthCallbacksGoogle?.()

    const unsubscribe = window.electronAPI.onAuthCallback((codeOrUrl: string) => {
      // Prevent duplicate navigations from accumulated listeners
      if (authNavInFlight) return
      authNavInFlight = true

      let code = codeOrUrl
      if (codeOrUrl.includes('://')) {
        try {
          const parsed = new URL(codeOrUrl)
          code = parsed.searchParams.get('code') || codeOrUrl
        } catch {
          // use as-is
        }
      }
      navigate(`/auth/discord/callback?code=${encodeURIComponent(code)}`)

      // Reset after exchange has time to complete
      setTimeout(() => { authNavInFlight = false }, 5000)
    })

    const unsubscribeGoogle = window.electronAPI.onAuthCallbackGoogle?.((codeOrUrl: string) => {
      if (googleAuthNavInFlight) return
      googleAuthNavInFlight = true

      let code = codeOrUrl
      if (codeOrUrl.includes('://')) {
        try {
          const parsed = new URL(codeOrUrl)
          code = parsed.searchParams.get('code') || codeOrUrl
        } catch {
          // use as-is
        }
      }
      navigate(`/auth/google/callback?code=${encodeURIComponent(code)}`)

      setTimeout(() => { googleAuthNavInFlight = false }, 5000)
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
      if (typeof unsubscribeGoogle === 'function') unsubscribeGoogle()
    }
  }, [navigate])

  return null
}

function ElectronDeepLinkListener() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!window.electronAPI?.onDeepLink) return

    const unsubscribe = window.electronAPI.onDeepLink((data) => {
      if (data?.type === 'reset' && data.token) {
        navigate(`/reset-password?token=${encodeURIComponent(data.token)}`)
      }
    })

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [navigate])

  return null
}

function DynamicToaster() {
  const { theme } = useThemeStore()
  const resolved = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme
  return <Toaster theme={resolved} richColors />
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function PageRoute({ element }: { element: ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {element}
      </Suspense>
    </ErrorBoundary>
  )
}

function AuthWindowDragRegion() {
  return (
    <div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[100] h-9 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    />
  )
}

function PublicAuthRoute({ element }: { element: ReactNode }) {
  return (
    <>
      <AuthWindowDragRegion />
      {element}
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={300}>
      <HashRouter>
        <SplashGate>
        <ElectronAuthListener />
        <ElectronDeepLinkListener />
        <CloseConfirmDialog />
        <Routes>
          {/* Public auth routes */}
          <Route path="/login" element={<PublicAuthRoute element={<LoginPage />} />} />
          <Route path="/register" element={<PublicAuthRoute element={<RegisterPage />} />} />
          <Route path="/forgot-password" element={<PublicAuthRoute element={<ForgotPasswordPage />} />} />
          <Route path="/reset-password" element={<PublicAuthRoute element={<ResetPasswordPage />} />} />
          <Route path="/auth/mfa" element={<PublicAuthRoute element={<MfaPlaceholderPage />} />} />
          <Route path="/auth/discord/callback" element={<PublicAuthRoute element={<DiscordCallbackPage />} />} />
          <Route path="/auth/google/callback" element={<PublicAuthRoute element={<GoogleCallbackPage />} />} />

          {/* Protected app routes */}
          <Route
            path="/*"
            element={
              <AuthGate>
                <AppShell>
                  <Routes>
                    {/* Existing routes */}
                    <Route path="/" element={<PageRoute element={<DashboardPage />} />} />
                    <Route path="/recruits" element={<PageRoute element={<RecruitsPage />} />} />
                    <Route path="/agents" element={<PageRoute element={<AgentsPage />} />} />
                    <Route path="/agents/:discordId" element={<PageRoute element={<AgentDetailPage />} />} />
                    <Route path="/sales" element={<PageRoute element={<SalesPage />} />} />
                    <Route path="/comp-tiers" element={<PageRoute element={<CompTiersPage />} />} />
                    <Route path="/licenses" element={<PageRoute element={<LicensesPage />} />} />
                    <Route path="/admin/licenses" element={<PageRoute element={<AdminLicensesPage />} />} />
                    <Route path="/analytics" element={<PageRoute element={<AnalyticsPage />} />} />
                    {/* Legacy /messaging route — preserved as a redirect to the
                        unified /crm/inbox surface (M2A consolidation). Bookmarks
                        and deep links from older sessions still resolve cleanly. */}
                    <Route path="/messaging" element={<Navigate to="/crm/inbox" replace />} />
                    <Route path="/appointments" element={<PageRoute element={<AppointmentsPage />} />} />
                    <Route path="/policy-hq" element={<PageRoute element={<PolicyDashboardPage />} />} />
                    <Route path="/policy-hq/book" element={<PageRoute element={<BookOfBusinessPage />} />} />
                    <Route path="/expenses" element={<PageRoute element={<ExpensesPage />} />} />
                    <Route path="/discord" element={<PageRoute element={<DiscordHubPage />} />} />
                    <Route path="/servers" element={<PageRoute element={<ServersPage />} />} />
                    <Route path="/approvals" element={<PageRoute element={<ApprovalQueuePage />} />} />
                    <Route path="/notifications" element={<PageRoute element={<NotificationsPage />} />} />
                    <Route path="/settings" element={<PageRoute element={<SettingsPage />} />} />

                    {/* New routes */}
                    <Route path="/wavv-tracker" element={<PageRoute element={<WAVVTrackerPage />} />} />
                    <Route path="/reports" element={<PageRoute element={<ReportsPage />} />} />
                    <Route path="/audit-log" element={<PageRoute element={<AuditLogPage />} />} />
                    <Route path="/calendar" element={<PageRoute element={<CalendarPage />} />} />
                    <Route path="/documents" element={<PageRoute element={<DocumentVaultPage />} />} />
                    <Route path="/campaigns" element={<PageRoute element={<CampaignManagerPage />} />} />
                    <Route path="/users-roles" element={<PageRoute element={<UsersRolesPage />} />} />
                    <Route path="/lock-ins" element={<PageRoute element={<LockInsPage />} />} />
                    <Route path="/org-chart" element={<PageRoute element={<OrgChartPage />} />} />
                    <Route path="/lock-ins/:id" element={<PageRoute element={<LockInWorkspacePage />} />} />
                    <Route path="/finance" element={<Navigate to="/sales" replace />} />
                    <Route path="/settings/pipeline" element={<PageRoute element={<PipelineSettingsPage />} />} />
                    <Route path="/ai-chat" element={<PageRoute element={<AIChatPage />} />} />
                    <Route path="/misc" element={<PageRoute element={<MiscPage />} />} />

                    {/* CRM M1: Contacts + Smart Lists — gated on VITE_CRM_M1 */}
                    <Route path="/crm" element={CRM_M1_ENABLED ? <Navigate to="/crm/contacts" replace /> : <Navigate to="/" replace />} />
                    <Route path="/crm/contacts" element={CRM_M1_ENABLED ? <PageRoute element={<ContactsPage />} /> : <Navigate to="/" replace />} />
                    <Route path="/crm/contacts/:id" element={CRM_M1_ENABLED ? <PageRoute element={<ContactsPage />} /> : <Navigate to="/" replace />} />
                    {/* Smart Lists is no longer a standalone destination — it lives inside
                        Contacts as a left-rail view-mode (Phase 1 contacts hub unification).
                        Bare /crm/lists redirects; /crm/lists/:id is preserved so pinned
                        smart-list deep links still resolve into the Contacts page. */}
                    <Route path="/crm/lists" element={CRM_M1_ENABLED ? <Navigate to="/crm/contacts" replace /> : <Navigate to="/" replace />} />
                    <Route path="/crm/lists/:id" element={CRM_M1_ENABLED ? <PageRoute element={<ContactsPage />} /> : <Navigate to="/" replace />} />
                    {/* CRM M2A: Conversations Inbox */}
                    <Route path="/crm/inbox" element={CRM_M1_ENABLED ? <PageRoute element={<InboxPage />} /> : <Navigate to="/" replace />} />
                    <Route path="/crm/inbox/:threadId" element={CRM_M1_ENABLED ? <PageRoute element={<InboxPage />} /> : <Navigate to="/" replace />} />
                  </Routes>
                </AppShell>
              </AuthGate>
            }
          />
        </Routes>
        <DynamicToaster />
        </SplashGate>
      </HashRouter>
      </TooltipProvider>
    </ThemeProvider>
  )
}
