import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  IconUser,
  IconShield,
  IconAdjustments,
  IconBuilding,
  IconUsers,
  IconBriefcase,
  IconCreditCard,
  IconBrandDiscord,
  IconPhone,
  IconCalendar,
  IconShieldCheck,
  IconBell,
  IconPalette,
  IconDatabaseExport,
  IconColorSwatch,
  IconWebhook,
  IconMail,
  IconRobot,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import ProfileSettings from '@/components/settings/ProfileSettings'
import SecuritySettings from '@/components/settings/SecuritySettings'
import PreferencesSettings from '@/components/settings/PreferencesSettings'
import OrgGeneralSettings from '@/components/settings/OrgGeneralSettings'
import TeamRolesSettings from '@/components/settings/TeamRolesSettings'
import AgenciesSettings from '@/components/settings/AgenciesSettings'
import BillingSettings from '@/components/settings/BillingSettings'
import DiscordIntegrationSettings from '@/components/settings/DiscordIntegrationSettings'
import WavvIntegrationSettings from '@/components/settings/WavvIntegrationSettings'
import CalendarIntegrationSettings from '@/components/settings/CalendarIntegrationSettings'
import PolicyHQSettings from '@/components/settings/PolicyHQSettings'
import WebhookSettings from '@/components/settings/WebhookSettings'
import PostableSettings from '@/components/settings/PostableSettings'
import NotificationSettings from '@/components/settings/NotificationSettings'
import AppearanceSettings from '@/components/settings/AppearanceSettings'
import PipelineConfigSettings from '@/components/settings/PipelineConfigSettings'
import DataExportSettings from '@/components/settings/DataExportSettings'
import CalendarColorSettings from '@/components/settings/CalendarColorSettings'
import AIAssistantSettings from '@/components/settings/AIAssistantSettings'

const WAVV_INTEGRATION_ENABLED = import.meta.env.VITE_WAVV_INTEGRATION === 'true'
const POLICY_HQ_INTEGRATION_ENABLED = import.meta.env.VITE_POLICY_HQ_INTEGRATION === 'true'
const WEBHOOKS_INTEGRATION_ENABLED = import.meta.env.VITE_WEBHOOKS_INTEGRATION === 'true'
const POSTABLE_INTEGRATION_ENABLED = import.meta.env.VITE_POSTABLE_INTEGRATION === 'true'

const SETTINGS_SECTIONS = [
  {
    title: 'My Account',
    items: [
      { key: 'profile', label: 'Profile', icon: IconUser },
      { key: 'security', label: 'Security', icon: IconShield },
      { key: 'preferences', label: 'Preferences', icon: IconAdjustments },
    ],
  },
  {
    title: 'Organization',
    items: [
      { key: 'org-general', label: 'General', icon: IconBuilding },
      { key: 'team-roles', label: 'Team & Roles', icon: IconUsers },
      { key: 'agencies', label: 'Agencies', icon: IconBriefcase },
      { key: 'billing', label: 'Billing & Plan', icon: IconCreditCard },
    ],
  },
  {
    title: 'Integrations',
    items: [
      { key: 'discord', label: 'Discord', icon: IconBrandDiscord },
      { key: 'wavv', label: 'WAVV', icon: IconPhone, enabled: WAVV_INTEGRATION_ENABLED },
      { key: 'calendars', label: 'Calendars', icon: IconCalendar },
      { key: 'policy-hq', label: 'PolicyHQ', icon: IconShieldCheck, enabled: POLICY_HQ_INTEGRATION_ENABLED },
      { key: 'webhooks', label: 'Webhooks', icon: IconWebhook, enabled: WEBHOOKS_INTEGRATION_ENABLED },
      { key: 'postable', label: 'Postable', icon: IconMail, enabled: POSTABLE_INTEGRATION_ENABLED },
    ],
  },
  {
    title: 'Notifications',
    items: [
      { key: 'notifications', label: 'Preferences', icon: IconBell },
    ],
  },
  {
    title: 'App Settings',
    items: [
      { key: 'appearance', label: 'Appearance', icon: IconPalette },
      { key: 'calendar-colors', label: 'Calendar Colors', icon: IconColorSwatch },
      { key: 'pipeline', label: 'Pipeline Config', icon: IconAdjustments },
      { key: 'data-export', label: 'Data & Export', icon: IconDatabaseExport },
      { key: 'ai-assistant', label: 'AI Assistant', icon: IconRobot },
    ],
  },
]

function isSettingsItemEnabled(item: { enabled?: boolean }) {
  return item.enabled !== false
}

const ENABLED_TAB_KEYS = new Set(
  SETTINGS_SECTIONS.flatMap((section) =>
    section.items.filter(isSettingsItemEnabled).map((item) => item.key),
  ),
)

const TAB_COMPONENTS: Record<string, React.ComponentType> = {
  'profile': ProfileSettings,
  'security': SecuritySettings,
  'preferences': PreferencesSettings,
  'org-general': OrgGeneralSettings,
  'team-roles': TeamRolesSettings,
  'agencies': AgenciesSettings,
  'billing': BillingSettings,
  'discord': DiscordIntegrationSettings,
  'wavv': WavvIntegrationSettings,
  'calendars': CalendarIntegrationSettings,
  'policy-hq': PolicyHQSettings,
  'webhooks': WebhookSettings,
  'postable': PostableSettings,
  'notifications': NotificationSettings,
  'appearance': AppearanceSettings,
  'calendar-colors': CalendarColorSettings,
  'pipeline': PipelineConfigSettings,
  'data-export': DataExportSettings,
  'ai-assistant': AIAssistantSettings,
}

export default function SettingsPage() {
  const [searchParams] = useSearchParams()
  const initialTab = searchParams.get('tab')
  const [activeTab, setActiveTab] = useState(
    initialTab && ENABLED_TAB_KEYS.has(initialTab) && TAB_COMPONENTS[initialTab] ? initialTab : 'profile',
  )

  const ActiveComponent = TAB_COMPONENTS[activeTab]
  const visibleSections = SETTINGS_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(isSettingsItemEnabled),
  })).filter((section) => section.items.length > 0)

  return (
    <div className="-mx-6 -mb-6 flex h-full min-h-0 gap-0 overflow-hidden pt-6">
      {/* Left nav */}
      <div className="min-h-0 w-56 shrink-0 overflow-y-auto border-r border-border/50 px-3 py-4">
        {visibleSections.map((section) => (
          <div key={section.title}>
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-2.5 pt-4 pb-1.5 first:pt-1">
              {section.title}
            </p>
            {section.items.map((item) => {
              const Icon = item.icon
              return (
                <Button
                  key={item.key}
                  variant="ghost"
                  onClick={() => setActiveTab(item.key)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors justify-start h-auto',
                    activeTab === item.key
                      ? 'bg-white/[0.06] text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.03]',
                  )}
                >
                  <Icon size={16} className={activeTab === item.key ? 'text-primary' : ''} />
                  {item.label}
                </Button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Right content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl">
          {ActiveComponent && <ActiveComponent />}
        </div>
      </div>
    </div>
  )
}
