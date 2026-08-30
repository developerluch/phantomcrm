import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  IconBrandDiscord,
  IconUserCheck,
  IconServer,
  IconShieldLock,
  IconActivity,
  IconFilter,
  IconChevronDown,
} from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { tabContentVariants } from '@/lib/motion'
import { usePendingJoinCount } from '../hooks/usePendingJoins'
import { useServers } from '../hooks/useServers'
import { useGuildStore } from '../store/guild-store'
import ApprovalQueueContent from '../components/discord-hub/ApprovalQueueContent'
import ServerManagementContent from '../components/discord-hub/ServerManagementContent'
import GuildSelector from '../components/discord-hub/GuildSelector'
import ActivityContent from '../components/discord-hub/ActivityContent'

// ── Tab definitions ──────────────────────────────────────────────────────────
interface Tab {
  id: string
  label: string
  icon: typeof IconUserCheck
  color: string
}

const TABS: Tab[] = [
  { id: 'approvals', label: 'Approvals', icon: IconUserCheck, color: '#22c55e' },
  { id: 'servers', label: 'Servers', icon: IconServer, color: '#3b82f6' },
  { id: 'roles', label: 'Roles', icon: IconShieldLock, color: '#f59e0b' },
  { id: 'activity', label: 'Activity', icon: IconActivity, color: '#8b5cf6' },
]

// ── Placeholder pages for upcoming features ──────────────────────────────────
function RolesPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <IconShieldLock size={40} className="text-amber-500/30 mb-3" />
      <h3 className="text-lg font-semibold text-foreground mb-1">Role Management</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Manage Discord roles, auto-role assignments, and permission hierarchies. Coming soon.
      </p>
    </div>
  )
}

// ── Activity filter (shown in header when Activity tab is active) ────────────
const ACTION_FILTER_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'agent_created', label: 'Agent Created' },
  { value: 'stage_change', label: 'Stage Change' },
  { value: 'message_sent', label: 'Message Sent' },
  { value: 'sale_created', label: 'Sale Created' },
  { value: 'recruit_created', label: 'Recruit Created' },
  { value: 'license_added', label: 'License Added' },
  { value: 'got_licensed', label: 'Got Licensed' },
  { value: 'need_help', label: 'Needs Help' },
  { value: 'member_joined', label: 'Member Joined' },
  { value: 'on_track', label: 'On Track' },
]

function ActivityFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8">
          <IconFilter size={14} />
          {ACTION_FILTER_OPTIONS.find(o => o.value === value)?.label ?? 'All actions'}
          <IconChevronDown size={14} className="opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {ACTION_FILTER_OPTIONS.map(option => (
          <DropdownMenuItem key={option.value} onClick={() => onChange(option.value)}>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Main Discord Hub Page ────────────────────────────────────────────────────
export default function DiscordHubPage() {
  const [activeTab, setActiveTab] = useState('approvals')
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right')
  const [actionFilter, setActionFilter] = useState('')

  const handleTabChange = (tabId: string) => {
    const currentIndex = TABS.findIndex((t) => t.id === activeTab)
    const nextIndex = TABS.findIndex((t) => t.id === tabId)
    setSlideDirection(nextIndex > currentIndex ? 'right' : 'left')
    setActiveTab(tabId)
  }

  const { selectedGuildId } = useGuildStore()
  const { data: servers = [] } = useServers()

  const selectedServer = servers.find((s) => s.id === selectedGuildId)
  const discordGuildId = selectedServer?.discordGuildId

  const pendingCount = usePendingJoinCount(discordGuildId)

  // Badge values by tab
  const badgeCounts: Record<string, number> = {
    approvals: pendingCount,
  }

  const direction = slideDirection === 'right' ? 1 : -1

  return (
    <div className="flex flex-col -mt-6 pt-6">
      {/* Sticky header banner with rounded bottom shelf */}
      <div className="shrink-0 sticky -top-6 z-20 -mx-6">
        <div
          className="px-6 pt-6 pb-3 rounded-b-3xl"
          style={{
            background: 'linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--card)) 100%)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.15), 0 1px 0 hsl(var(--border) / 0.2) inset',
          }}
        >
          {/* Top row: title + selectors */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, #5865F2, #7289DA)',
                  boxShadow: '0 0 16px rgba(88,101,242,0.15)',
                }}
              >
                <IconBrandDiscord size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground leading-tight">Discord Hub</h1>
                <p className="text-xs text-muted-foreground">
                  Manage servers, approvals, roles, and activity
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'activity' && (
                <ActivityFilter value={actionFilter} onChange={setActionFilter} />
              )}
              <GuildSelector />
            </div>
          </div>

          {/* Tab bar — sits at the bottom of the rounded shelf */}
          <div className="flex items-center justify-center gap-1.5">
            {TABS.map((tab) => {
              const isActive = tab.id === activeTab
              const Icon = tab.icon
              const badge = badgeCounts[tab.id] ?? 0
              return (
                <Button
                  key={tab.id}
                  variant="ghost"
                  onClick={() => handleTabChange(tab.id)}
                  className="relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap text-muted-foreground hover:text-foreground hover:bg-white/[0.06] h-auto"
                >
                  {isActive && (
                    <motion.div
                      layoutId="discord-hub-active-tab"
                      className="absolute inset-0 rounded-lg bg-white/[0.08] border border-white/[0.08]"
                      style={{ boxShadow: `0 0 12px ${tab.color}15` }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon
                      size={16}
                      style={{ color: isActive ? tab.color : undefined }}
                      className={isActive ? '' : 'opacity-60'}
                    />
                    {tab.label}
                    {badge > 0 && (
                      <Badge
                        variant="warning"
                        className="text-[10px] h-4 min-w-[16px] px-1 ml-0.5"
                      >
                        {badge}
                      </Badge>
                    )}
                  </span>
                </Button>
              )
            })}
          </div>
        </div>

        {/* Approval banner — outside the rounded shelf, below it */}
        {activeTab === 'approvals' && pendingCount > 0 && (
          <div className="flex items-center gap-2 mx-6 mt-3 px-3 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs text-amber-400/80">{pendingCount} member{pendingCount !== 1 ? 's' : ''} waiting for approval</span>
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="mt-5 rounded-xl border border-border/40 bg-card/30 p-5 min-h-[400px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            variants={tabContentVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            {activeTab === 'approvals' && <ApprovalQueueContent guildId={discordGuildId} />}
            {activeTab === 'servers' && <ServerManagementContent />}
            {activeTab === 'roles' && <RolesPlaceholder />}
            {activeTab === 'activity' && <ActivityContent guildId={discordGuildId} actionFilter={actionFilter} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
