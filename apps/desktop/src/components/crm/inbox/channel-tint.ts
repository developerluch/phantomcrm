import {
  IconBrandApple,
  IconBrandWhatsapp,
  IconMail,
  IconMessageCircle,
  IconPhone,
} from '@tabler/icons-react'
import type { Channel, Provider } from '@/types/portal'

// Maps each channel to a CSS-var-backed tint and a Tabler icon component.
// Both ThreadRow's avatar and ThreadListPanel's channel-filter popover read
// from this module so the visual binding stays consistent.
export const CHANNEL_TINT: Record<Channel, string> = {
  sms: 'hsl(var(--chart-1))',
  whatsapp: 'hsl(var(--chart-2))',
  imessage: 'hsl(var(--chart-5))',
  email: 'hsl(var(--chart-3))',
  voice: 'hsl(var(--chart-4))',
}

export const CHANNEL_ICON: Record<Channel, typeof IconMessageCircle> = {
  sms: IconMessageCircle,
  whatsapp: IconBrandWhatsapp,
  imessage: IconBrandApple,
  email: IconMail,
  voice: IconPhone,
}

export const CHANNEL_LABEL: Record<Channel, string> = {
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  imessage: 'iMessage',
  email: 'Email',
  voice: 'Voice',
}

export const CHANNEL_ORDER: Channel[] = ['sms', 'whatsapp', 'imessage', 'email', 'voice']

// Default Provider for a given Channel. Composer uses this when the user
// switches tabs mid-thread — the conversation's stored provider may not
// match the channel the user is now sending on.
//
// email → 'meta' is a placeholder until M2B picks a real email provider
// literal ('sendgrid' / 'ses'); Provider's `(string & {})` arm permits it.
export function getDefaultProvider(channel: Channel): Provider {
  switch (channel) {
    case 'sms':      return 'twilio'
    case 'voice':    return 'twilio'
    case 'whatsapp': return 'meta'
    case 'imessage': return 'twilio'
    case 'email':    return 'meta'
  }
}
