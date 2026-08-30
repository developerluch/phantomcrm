import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { matchPath, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import AICommandBar from './AICommandBar'
import FnVoiceMode from './FnVoiceMode'
import UpdateBanner from './UpdateBanner'
import RouteProgressBar from './RouteProgressBar'
import { AgentSidebar } from './sidebar/AgentSidebar'
import { PhantomMark } from './brand/PhantomMark'
import { WebSocketProvider } from '../contexts/WebSocketContext'
import { useAIStore } from '../store/ai-store'
import { SidebarProvider } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

type ShellPageMeta = {
  title: string
  section: string
  fixedChrome?: boolean
}

const DEFAULT_PAGE_META: ShellPageMeta = {
  title: 'Dashboard',
  section: 'Workspace',
}

const PAGE_META: Array<{ path: string; end?: boolean; meta: ShellPageMeta }> = [
  { path: '/', end: true, meta: { title: 'Dashboard', section: 'Workspace' } },
  { path: '/ai-chat', meta: { title: 'AI Chat', section: 'Workspace', fixedChrome: true } },
  { path: '/calendar', meta: { title: 'Calendar', section: 'Workspace' } },
  { path: '/crm/inbox/*', meta: { title: 'Inbox', section: 'CRM', fixedChrome: true } },
  { path: '/crm/contacts/*', meta: { title: 'Contacts', section: 'CRM', fixedChrome: true } },
  { path: '/policy-hq', end: true, meta: { title: 'Policy Dashboard', section: 'Policy Tracker' } },
  { path: '/policy-hq/book', meta: { title: 'Book of Business', section: 'Policy Tracker', fixedChrome: true } },
  { path: '/expenses', meta: { title: 'Lead Spend & Finances', section: 'Policy Tracker', fixedChrome: true } },
  { path: '/recruits', meta: { title: 'Recruiting', section: 'Agencies', fixedChrome: true } },
  { path: '/agents/:discordId', meta: { title: 'Agent Profile', section: 'Agencies' } },
  { path: '/agents', meta: { title: 'Agents & Reps', section: 'Agencies' } },
  { path: '/sales', meta: { title: 'Sales', section: 'Policy Tracker' } },
  { path: '/org-chart', meta: { title: 'Agency Org Chart', section: 'Agencies', fixedChrome: true } },
  { path: '/comp-tiers', meta: { title: 'Comp Tiers', section: 'Agencies' } },
  { path: '/licenses', meta: { title: 'Licenses', section: 'Agencies' } },
  { path: '/admin/licenses', meta: { title: 'Admin Licenses', section: 'Agencies' } },
  { path: '/appointments', meta: { title: 'Appointments', section: 'Agencies' } },
  { path: '/lock-ins/:id', meta: { title: 'Lock-In Workspace', section: 'Agencies', fixedChrome: true } },
  { path: '/lock-ins', meta: { title: 'Lock-Ins', section: 'Agencies' } },
  { path: '/discord', meta: { title: 'Discord Hub', section: 'Outreach', fixedChrome: true } },
  { path: '/servers', meta: { title: 'Servers', section: 'Outreach' } },
  { path: '/approvals', meta: { title: 'Approval Queue', section: 'Outreach' } },
  { path: '/campaigns', meta: { title: 'Campaigns', section: 'Outreach' } },
  { path: '/wavv-tracker', meta: { title: 'WAVV Tracker', section: 'System' } },
  { path: '/settings', end: true, meta: { title: 'Settings', section: 'System', fixedChrome: true } },
  { path: '/settings/*', meta: { title: 'Settings', section: 'System' } },
  { path: '/misc', meta: { title: 'Misc', section: 'System' } },
  { path: '/notifications', meta: { title: 'Notifications', section: 'System' } },
  { path: '/reports', meta: { title: 'Reports', section: 'System' } },
  { path: '/audit-log', meta: { title: 'Audit Log', section: 'System' } },
  { path: '/documents', meta: { title: 'Document Vault', section: 'System' } },
  { path: '/users-roles', meta: { title: 'Users & Roles', section: 'System' } },
]

function getShellPageMeta(pathname: string): ShellPageMeta {
  return PAGE_META.find(({ path, end }) => matchPath({ path, end: end ?? false }, pathname))?.meta ?? DEFAULT_PAGE_META
}

function PhantomBackgroundLayer() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-40 dark:opacity-25" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(118deg, hsl(var(--background) / 0.88) 0%, hsl(var(--background) / 0.42) 48%, hsl(var(--background) / 0.9) 100%)',
        }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
      <PhantomMark
        variant="static"
        size={520}
        className="absolute -right-28 -bottom-44"
        style={{ color: 'hsl(var(--foreground) / 0.025)' }}
      />
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const aiMode = useAIStore((s) => s.mode)
  const location = useLocation()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const pageMeta = useMemo(() => getShellPageMeta(location.pathname), [location.pathname])
  const usesFixedPageChrome = pageMeta.fixedChrome === true

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    document.title = `${pageMeta.title} | Phantom CRM`
  }, [pageMeta.title])

  return (
    <WebSocketProvider>
      <SidebarProvider>
        <div
          className={cn(
            'flex h-screen min-h-0 w-full flex-col overflow-hidden bg-background transition-shadow duration-500',
            aiMode === 'bar' || aiMode === 'fn-voice' ? 'ai-glow-active' : '',
          )}
        >
          <RouteProgressBar />
          <UpdateBanner />
          {/* Custom title bar drag region */}
          <div
            className="h-9 w-full shrink-0 flex items-center select-none"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
          >
            <div className="pl-20" />
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 tracking-wide">
              <PhantomMark variant="static" size={11} className="text-zinc-500" />
              <span>Phantom CRM</span>
              <span className="text-zinc-300 dark:text-zinc-600">/</span>
              <span className="text-zinc-500 dark:text-zinc-400">{pageMeta.section}</span>
              <span className="text-zinc-300 dark:text-zinc-600">/</span>
              <span className="text-zinc-700 dark:text-zinc-300">{pageMeta.title}</span>
            </span>
            {!isOnline && (
              <span className="ml-2 text-[10px] text-amber-400 flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Offline
              </span>
            )}
          </div>
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            <Sidebar />
            <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
              <PhantomBackgroundLayer />
              <div
                className={cn(
                  'relative z-10 flex-1 min-h-0 px-6 pb-6 scroll-pt-20',
                  usesFixedPageChrome ? 'overflow-hidden' : 'overflow-y-auto',
                )}
              >
                <div className="h-full min-h-0">
                  {children}
                </div>
              </div>
            </main>
            <motion.div
              aria-hidden
              className="absolute inset-0 pointer-events-none z-50 backdrop-blur-[2px] bg-background/40"
              initial={false}
              animate={{ opacity: aiMode !== 'closed' ? 1 : 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 30 }}
            />
          </div>

          <AgentSidebar />
          <AICommandBar />
          <FnVoiceMode />
        </div>
      </SidebarProvider>
    </WebSocketProvider>
  )
}

export default AppShell
