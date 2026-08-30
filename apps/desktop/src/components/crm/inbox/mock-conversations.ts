import type {
  Contact,
  Conversation,
  ConversationDetailResponse,
  Message,
  MessageStatus,
} from '@/types/portal'

const now = () => Date.now()
const minsAgo = (n: number) => new Date(now() - n * 60_000).toISOString()
const hoursAgo = (n: number) => new Date(now() - n * 3_600_000).toISOString()
const daysAgo = (n: number) => new Date(now() - n * 86_400_000).toISOString()

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: 'mock-001',
    contactId: 'Jordan Reyes',
    channel: 'sms',
    provider: 'twilio',
    status: 'open',
    unreadCount: 3,
    lastInboundAt: minsAgo(2),
    createdAt: daysAgo(3),
    updatedAt: minsAgo(2),
  },
  {
    id: 'mock-002',
    contactId: 'Priya Shah',
    channel: 'whatsapp',
    provider: 'meta',
    status: 'open',
    unreadCount: 1,
    lastInboundAt: minsAgo(18),
    createdAt: daysAgo(1),
    updatedAt: minsAgo(18),
  },
  {
    id: 'mock-003',
    contactId: 'Marcus Lee',
    channel: 'email',
    provider: 'gmail',
    status: 'open',
    unreadCount: 0,
    lastInboundAt: hoursAgo(2),
    createdAt: daysAgo(5),
    updatedAt: hoursAgo(2),
  },
  {
    id: 'mock-004',
    contactId: 'Sofia Alvarez',
    channel: 'sms',
    provider: 'twilio',
    status: 'open',
    unreadCount: 2,
    lastInboundAt: hoursAgo(6),
    createdAt: daysAgo(2),
    updatedAt: hoursAgo(6),
  },
  {
    id: 'mock-005',
    contactId: 'David Chen',
    channel: 'voice',
    provider: 'telnyx',
    status: 'open',
    unreadCount: 1,
    lastInboundAt: hoursAgo(14),
    createdAt: daysAgo(4),
    updatedAt: hoursAgo(14),
  },
  {
    id: 'mock-006',
    contactId: 'Ava Martin',
    channel: 'email',
    provider: 'gmail',
    status: 'snoozed',
    unreadCount: 0,
    lastInboundAt: daysAgo(1),
    snoozeUntil: new Date(now() + 3_600_000 * 6).toISOString(),
    createdAt: daysAgo(7),
    updatedAt: daysAgo(1),
  },
  {
    id: 'mock-007',
    contactId: 'Liam OBrien',
    channel: 'whatsapp',
    provider: 'meta',
    status: 'open',
    unreadCount: 0,
    lastInboundAt: daysAgo(2),
    createdAt: daysAgo(10),
    updatedAt: daysAgo(2),
  },
  {
    id: 'mock-008',
    contactId: 'Zoe Patel',
    channel: 'sms',
    provider: 'twilio',
    status: 'open',
    unreadCount: 5,
    lastInboundAt: daysAgo(4),
    createdAt: daysAgo(12),
    updatedAt: daysAgo(4),
  },
]

/** Synthesize a conversation-detail payload for a mock thread id. Returns null
 *  for unknown ids so the caller can fall through to the real API. Messages are
 *  shaped to exercise the F.1-F.5 bubble features: mixed statuses including
 *  one `failed` (Retry button), email `subject` on email threads, whatsapp
 *  `templateId` on the first outbound of whatsapp threads, and createdAt
 *  timestamps spaced minutes apart for the relative-time renderer. */
export function getMockConversationDetail(
  id: string,
): ConversationDetailResponse | null {
  const conversation = MOCK_CONVERSATIONS.find((c) => c.id === id)
  if (!conversation) return null
  return { conversation, messages: buildMockMessages(conversation) }
}

const EMAIL_SUBJECTS: Record<string, string> = {
  'Marcus Lee': 'Quote follow-up — coverage options',
  'Ava Martin': 'Renewal reminder — policy #A-44219',
}

function buildMockMessages(c: Conversation): Message[] {
  const subject =
    c.channel === 'email'
      ? EMAIL_SUBJECTS[c.contactId] ?? 'Following up'
      : undefined
  const templateId = c.channel === 'whatsapp' ? 'tmpl_followup_v3' : undefined

  const base = new Date(c.updatedAt).getTime()
  const at = (mins: number) => new Date(base - mins * 60_000).toISOString()

  const inbound = (i: number, body: string, mins: number): Message => ({
    id: `${c.id}-msg-${i}`,
    conversationId: c.id,
    contactId: c.contactId,
    direction: 'inbound',
    channel: c.channel,
    provider: c.provider,
    body,
    subject,
    status: 'delivered',
    createdAt: at(mins),
  })

  const outbound = (
    i: number,
    body: string,
    mins: number,
    status: MessageStatus,
    withTemplate = false,
  ): Message => ({
    id: `${c.id}-msg-${i}`,
    conversationId: c.id,
    contactId: c.contactId,
    direction: 'outbound',
    channel: c.channel,
    provider: c.provider,
    body,
    subject,
    templateId: withTemplate ? templateId : undefined,
    status,
    createdAt: at(mins),
  })

  const openingByChannel: Record<Conversation['channel'], string> = {
    sms: 'Hey — quick question about my coverage.',
    whatsapp: 'Hi! Following up on the quote you sent over.',
    email:
      'Thanks for the call earlier. Wanted to put a few things in writing so we have a record.',
    voice: '[voicemail] Hi, leaving a quick voicemail re: my application.',
    imessage: 'Hey — got a sec to talk through the policy?',
  }

  const replyByChannel: Record<Conversation['channel'], string> = {
    sms: 'Thanks for the message — pulling those numbers now.',
    whatsapp: 'Sending the latest pricing breakdown — let me know what works.',
    email:
      'Appreciate the note — attaching the updated coverage comparison below.',
    voice: 'Got your voicemail — calling you back this afternoon.',
    imessage: 'On it — give me 10 min and I’ll send the breakdown.',
  }

  return [
    inbound(0, openingByChannel[c.channel], 32),
    outbound(1, replyByChannel[c.channel], 26, 'read', true),
    inbound(
      2,
      'Got it. One more — how does the deductible work for the home policy?',
      18,
    ),
    outbound(3, 'Just sent the deductible schedule.', 9, 'failed'),
    outbound(
      4,
      'Re-sent — should be through now.',
      2,
      c.channel === 'email' ? 'sent' : 'delivered',
    ),
  ]
}

const MOCK_PHONE_BY_NAME: Record<string, string> = {
  'Jordan Reyes': '+15555550101',
  'Priya Shah': '+15555550102',
  'Marcus Lee': '+15555550103',
  'Sofia Alvarez': '+15555550104',
  'David Chen': '+15555550105',
  'Ava Martin': '+15555550106',
  'Liam OBrien': '+15555550107',
  'Zoe Patel': '+15555550108',
}

const MOCK_EMAIL_BY_NAME: Record<string, string> = {
  'Marcus Lee': 'marcus.lee@example.com',
  'Ava Martin': 'ava.martin@example.com',
}

/** Synthesize a Contact for a mock thread. Returns null when the id doesn't
 *  match any seeded mock conversation so callers can fall through to the API.
 *  Mock conversations use the contact's display name as the id (see
 *  MOCK_CONVERSATIONS), so we look up by name and stuff the name into both
 *  `id` and `fullName`. */
export function getMockContact(contactId: string): Contact | null {
  const conversation = MOCK_CONVERSATIONS.find((c) => c.contactId === contactId)
  if (!conversation) return null
  const name = contactId
  const [firstName = null, ...rest] = name.split(/\s+/)
  const lastName = rest.length > 0 ? rest.join(' ') : null
  return {
    id: name,
    sourceType: 'manual',
    sourceId: null,
    ownerAgentDiscordId: null,
    sharedWithAgentDiscordIds: [],
    firstName,
    lastName,
    fullName: name,
    email: MOCK_EMAIL_BY_NAME[name] ?? null,
    phone: MOCK_PHONE_BY_NAME[name] ?? null,
    phoneNormalized: MOCK_PHONE_BY_NAME[name] ?? null,
    dob: null,
    lifecycleStage: 'lead',
    status: 'active',
    doNotSms: false,
    doNotEmail: false,
    doNotCall: false,
    customFields: {},
    tags: [],
    addresses: [],
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    lastActivityAt: conversation.updatedAt,
  }
}
