import { useState, Fragment } from 'react'
import { NavLink } from 'react-router-dom'
import NotificationBell from './NotificationBell'
import { usePendingJoinCount } from '../hooks/usePendingJoins'
import { useRecruitStats } from '../hooks/useRecruits'
import BugReportModal from './BugReportModal'
import { useWebSocketContext } from '../contexts/WebSocketContext'
import { useThemeStore, type Theme } from '../store/theme-store'
import { useAuthStore } from '../store'
import { clearTokens as vaultClearTokens } from '../services/tokenVault'
import { PhantomMark } from '@/components/brand/PhantomMark'
import { cn } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@radix-ui/react-collapsible'
import {
  IconLayoutDashboard,
  IconSettings,
  IconChevronLeft,
  IconChevronRight,
  IconChevronDown,
  IconUser,
  IconBriefcase,
  IconUserPlus,
  IconReceipt,
  IconCalendar,
  IconFolderOpen,
  IconSpeakerphone,
  IconLogout,
  IconBug,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconCalendarStats,
  IconRobot,
  IconBrandDiscord,
  IconShieldCheck,
  IconChartPie,
  IconAddressBook,
  IconUsers,
  IconInbox,
} from '@tabler/icons-react'

// ── Nav item types ──────────────────────────────────────────────────────────
type NavItem = { to: string; label: string; icon: typeof IconLayoutDashboard; badge?: boolean; section?: string }
type NavGroup =
  | { type: 'top'; item: NavItem }
  | { type: 'collapsible'; label: string; icon: typeof IconLayoutDashboard; items: NavItem[] }

// Feature flag — read once at module scope. Gates the CRM nav group behind VITE_CRM_M1=true.
const CRM_M1_ENABLED = (import.meta as any).env?.VITE_CRM_M1 === 'true'

const crmGroup: NavGroup = {
  type: 'collapsible',
  label: 'CRM',
  icon: IconAddressBook,
  items: [
    { to: '/crm/inbox', label: 'Inbox', icon: IconInbox },
    { to: '/crm/contacts', label: 'Contacts', icon: IconUsers },
  ],
}

const navStructure: NavGroup[] = [
  { type: 'top', item: { to: '/', label: 'Dashboard', icon: IconLayoutDashboard } },
  { type: 'top', item: { to: '/ai-chat', label: 'AI Chat', icon: IconRobot } },
  { type: 'top', item: { to: '/calendar', label: 'Calendar', icon: IconCalendar } },

  ...(CRM_M1_ENABLED ? [crmGroup] : []),

  {
    type: 'collapsible',
    label: 'Policy Tracker',
    icon: IconShieldCheck,
    items: [
      { to: '/policy-hq', label: 'Dashboard', icon: IconChartPie },
      { to: '/policy-hq/book', label: 'Book of Business', icon: IconShieldCheck },
      { to: '/expenses', label: 'Lead Spend & Finances', icon: IconReceipt },
    ],
  },

  {
    type: 'collapsible',
    label: 'Agencies',
    icon: IconBriefcase,
    items: [
      { to: '/recruits', label: 'Recruiting', icon: IconUserPlus, badge: true },
      { to: '/agents', label: 'Agents & Reps', icon: IconUsers },
      { to: '/org-chart', label: 'Agency Org Chart', icon: IconAddressBook },
      { to: '/comp-tiers', label: 'Comp Tiers', icon: IconChartPie },
      { to: '/lock-ins', label: 'Lock-Ins', icon: IconCalendarStats },
    ],
  },

  {
    type: 'collapsible',
    label: 'Outreach',
    icon: IconSpeakerphone,
    items: [
      { to: '/discord', label: 'Discord Hub', icon: IconBrandDiscord, badge: true },
      { to: '/campaigns', label: 'Campaigns', icon: IconSpeakerphone },
    ],
  },
]

const bottomNav: NavItem[] = [
  { to: '/settings', label: 'Settings', icon: IconSettings },
  { to: '/misc', label: 'Misc', icon: IconFolderOpen },
]

const DEFAULT_GROUP_OPEN = navStructure.reduce<Record<string, boolean>>((acc, group) => {
  if (group.type === 'collapsible') acc[group.label] = true
  return acc
}, {})

// ── Logo Area ────────────────────────────────────────────────────────────────
function LogoArea() {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          variant="ghost"
          className={cn(
            'w-full h-auto rounded-lg border border-white/[0.06] bg-white/[0.03] text-foreground hover:bg-white/[0.06] hover:text-foreground',
            collapsed ? 'justify-center p-1.5' : 'justify-start px-2.5 py-2',
          )}
        >
          <NavLink to="/" aria-label="PhantomCRM dashboard">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-black/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <PhantomMark variant="static" size={18} />
            </span>
            {!collapsed && (
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold leading-tight tracking-wide">PhantomCRM</span>
                <span className="block truncate text-[10px] font-medium leading-tight text-muted-foreground">Agency command</span>
              </span>
            )}
          </NavLink>
        </Button>
      </TooltipTrigger>
      {collapsed && <TooltipContent side="right">PhantomCRM</TooltipContent>}
    </Tooltip>
  )
}


// ── Profile Section ───────────────────────────────────────────────────────────
const STATUS_DOT_CLASS: Record<string, string> = {
  connected: 'bg-emerald-500',
  reconnecting: 'bg-amber-500 animate-pulse',
  disconnected: 'bg-red-500',
}

const STATUS_LABEL: Record<string, string> = {
  connected: 'Connected',
  reconnecting: 'Reconnecting...',
  disconnected: 'Disconnected — click to reconnect',
}

function ProfileSection() {
  const { state } = useSidebar()
  const collapsed = state === 'collapsed'
  const { user, clearAuth } = useAuthStore()
  const { status: wsStatus, reconnect } = useWebSocketContext()

  const displayName = user?.displayName || 'Your Name'
  const avatarUrl = user?.avatarUrl || null
  const roleLabel = user?.roleId || 'Member'

  async function handleSignOut() {
    try { await vaultClearTokens() } catch { /* ignore */ }
    clearAuth()
    window.location.href = window.location.origin + '/#/login'
  }

  const initials = displayName
    .split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) || '?'

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={cn(
                'w-full flex items-center gap-2.5 py-2 rounded-lg hover:bg-white/[0.04] transition-colors group h-auto',
                collapsed ? 'justify-center px-1.5' : 'px-2',
              )}
            >
              <div className="relative shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                    {initials === '?' ? <IconUser size={13} /> : initials}
                  </div>
                )}
                <span
                  className={cn('absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-[1.5px] border-background', STATUS_DOT_CLASS[wsStatus])}
                  onClick={(e) => { e.stopPropagation(); if (wsStatus === 'disconnected') reconnect() }}
                />
              </div>

              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[12px] font-medium text-foreground truncate leading-tight">
                    {displayName}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate leading-tight capitalize">
                    {roleLabel}
                  </p>
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        {collapsed && <TooltipContent side="right">{displayName}</TooltipContent>}
      </Tooltip>

      <DropdownMenuContent
        side={collapsed ? 'right' : 'top'}
        align="start"
        className="w-56"
      >
        <div className="flex items-center gap-3 px-2 py-2">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {initials === '?' ? <IconUser size={16} /> : initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-foreground truncate">{displayName}</p>
            <p className="text-[10px] text-muted-foreground truncate">{user?.email || ''}</p>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <NavLink
            to="/settings"
            className="flex items-center gap-2 text-[11px]"
          >
            <IconSettings size={13} />
            Settings
          </NavLink>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleSignOut}
          className="text-red-400 focus:text-red-400 focus:bg-red-500/10"
        >
          <IconLogout size={13} />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Sidebar (exported) ───────────────────────────────────────────────────────
export function AppSidebar() {
  const [showBugReport, setShowBugReport] = useState(false)
  const { theme, setTheme } = useThemeStore()
  const pendingJoinCount = usePendingJoinCount()
  const { data: recruitStats } = useRecruitStats()
  const newLeadCount = recruitStats?.byStage?.NEW_LEAD ?? 0

  const { state, toggleSidebar } = useSidebar()
  const collapsed = state === 'collapsed'

  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(DEFAULT_GROUP_OPEN)

  const cycleTheme = () => {
    const order: Theme[] = ['dark', 'light', 'system']
    const next = order[(order.indexOf(theme) + 1) % order.length]
    setTheme(next)
  }

  const setDarkMode = (checked: boolean) => {
    setTheme(checked ? 'dark' : 'light')
  }

  const ThemeIcon = theme === 'dark' ? IconMoon : theme === 'light' ? IconSun : IconDeviceDesktop

  return (
    <>
      <Sidebar variant="inset" collapsible="icon" className="border-r border-border/20">
        <SidebarHeader className={cn('pt-4 pb-2', collapsed ? 'px-2' : 'px-3')}>
          <div className={cn('flex items-center gap-2', collapsed ? 'flex-col items-center' : '')}>
            <div className={cn('min-w-0', collapsed ? '' : 'flex-1')}>
              <LogoArea />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  className={cn(
                    'w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors shrink-0',
                    collapsed ? 'mx-auto mt-1' : 'mt-1',
                  )}
                >
                  {collapsed ? <IconChevronRight size={12} /> : <IconChevronLeft size={12} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</TooltipContent>
            </Tooltip>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarMenu>
              {navStructure.map((group) => {
                if (group.type === 'top') {
                  const item = group.item
                  const Icon = item.icon
                  const hasBadge = item.badge && (item.to === '/recruits' ? newLeadCount : pendingJoinCount) > 0
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild tooltip={item.label}>
                        <NavLink
                          to={item.to}
                          end={item.to === '/'}
                          className={({ isActive }) =>
                            cn(
                              'transition-all duration-150',
                              isActive
                                ? '!bg-white/[0.06] !text-foreground font-medium shadow-[inset_3px_0_0_0_hsl(var(--foreground)/0.5)]'
                                : 'text-zinc-500 hover:!text-zinc-300 hover:!bg-white/[0.04]',
                            )
                          }
                        >
                          <Icon />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                      {hasBadge && (
                        <SidebarMenuBadge>{item.to === '/recruits' ? newLeadCount : pendingJoinCount}</SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  )
                }

                // Collapsible Group
                const GroupIcon = group.icon
                const groupIsOpen = !collapsed && (groupOpen[group.label] ?? true)
                return (
                  <Collapsible
                    key={group.label}
                    open={groupIsOpen}
                    onOpenChange={(open) => setGroupOpen(prev => ({ ...prev, [group.label]: open }))}
                    className="group/collapsible"
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton
                          tooltip={group.label}
                          aria-label={group.label}
                          className={cn(
                            '!text-muted-foreground/45 font-medium hover:!text-muted-foreground/80 hover:!bg-white/[0.03]',
                            collapsed ? 'justify-center' : '!text-[10px] uppercase tracking-[0.15em]',
                          )}
                        >
                          <GroupIcon />
                          {!collapsed && (
                            <>
                              <span>{group.label}</span>
                              <IconChevronDown size={10} className="ml-auto opacity-30 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" />
                            </>
                          )}
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {group.items.map((item) => {
                            const hasBadge = item.badge && (item.to === '/recruits' ? newLeadCount : pendingJoinCount) > 0
                            return (
                              <Fragment key={item.to}>
                                {item.section && (
                                  <li className="px-2 pt-3 pb-1">
                                    <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/40">
                                      {item.section}
                                    </span>
                                  </li>
                                )}
                                <SidebarMenuSubItem>
                                  <SidebarMenuSubButton asChild>
                                    <NavLink
                                      to={item.to}
                                      end={item.to === '/' || item.to === '/policy-hq'}
                                      className={({ isActive }) =>
                                        cn(
                                          'transition-all duration-150',
                                          isActive
                                            ? '!bg-white/[0.06] !text-foreground font-medium'
                                            : 'text-zinc-500 hover:!text-zinc-300 hover:!bg-white/[0.04]',
                                        )
                                      }
                                    >
                                      <item.icon />
                                      <span>{item.label}</span>
                                    </NavLink>
                                  </SidebarMenuSubButton>
                                  {hasBadge && (
                                    <SidebarMenuBadge>{item.to === '/recruits' ? newLeadCount : pendingJoinCount}</SidebarMenuBadge>
                                  )}
                                </SidebarMenuSubItem>
                              </Fragment>
                            )
                          })}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>

        </SidebarContent>

        <SidebarFooter className="border-t border-border/10 pt-1.5 pb-2 mt-auto">
          <SidebarMenu>
            <SidebarMenuItem>
              <NotificationBell collapsed={collapsed} />
            </SidebarMenuItem>
            {bottomNav.map((item) => (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton asChild tooltip={item.label}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'transition-all duration-150',
                        isActive
                          ? '!bg-white/[0.06] !text-foreground font-medium shadow-[inset_3px_0_0_0_hsl(var(--foreground)/0.5)]'
                          : 'text-zinc-500 hover:!text-zinc-300 hover:!bg-white/[0.04]',
                      )
                    }
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setShowBugReport(true)} tooltip="Report Bug" className="text-zinc-500 hover:text-zinc-300">
                <IconBug />
                <span>Report Bug</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {!collapsed && (
              <li className="px-2 py-1">
                <Separator className="bg-border/40" />
              </li>
            )}
            <SidebarMenuItem>
              <div className={cn('flex items-center gap-2', collapsed ? 'justify-center' : 'px-1')}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size={collapsed ? 'icon' : 'sm'}
                      onClick={cycleTheme}
                      aria-label={`Theme: ${theme}. Click to cycle theme.`}
                      className={cn(
                        'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]',
                        collapsed ? 'h-8 w-8' : 'h-8 flex-1 justify-start px-2',
                      )}
                    >
                      <ThemeIcon size={17} />
                      {!collapsed && (
                        <span className="text-[13px] font-medium capitalize">{theme} mode</span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side={collapsed ? 'right' : 'top'}>Theme: {theme} (click to cycle)</TooltipContent>
                </Tooltip>
                {!collapsed && (
                  <Switch
                    checked={theme === 'dark'}
                    onCheckedChange={setDarkMode}
                    aria-label="Toggle dark mode"
                    className={cn(
                      theme === 'system' ? 'opacity-60' : '',
                    )}
                  />
                )}
              </div>
            </SidebarMenuItem>
            <SidebarMenuItem className="mt-2">
              <ProfileSection />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <BugReportModal open={showBugReport} onClose={() => setShowBugReport(false)} />
    </>
  )
}

export { AppSidebar as Sidebar }
