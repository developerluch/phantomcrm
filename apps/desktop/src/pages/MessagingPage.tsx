import { useState, useMemo } from 'react'
import { useSmsHistory, useSendSms, useAllWhatsAppConversations, useWhatsAppMessages, useSendWhatsApp, useLinkConversationToRecruit } from '../hooks/useMessaging'
import { useRecruits } from '../hooks/useRecruits'
import ConversationList from '../components/messaging/ConversationList'
import MessageThread from '../components/messaging/MessageThread'
import { toast } from 'sonner'
import { IconMessageCircle, IconAlertCircle } from '@tabler/icons-react'
import EmptyState from '../components/EmptyState'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import { Skeleton } from '../components/Skeleton'
import type { RecruitStage } from '../types/portal'

// TODO(rebrand): change to https://cal.com/phantom/discovery once the cal.com
// handle is reserved or a redirect is in place. Leaving as 'synvelo' so the
// link doesn't 404 in production until the rename is coordinated externally.
const CAL_COM_URL = 'https://cal.com/synvelo/discovery'

type Tab = 'sms' | 'whatsapp'

// ── Animation Variants ──────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24, mass: 0.8 } },
}

export default function MessagingPage() {
  const [tab, setTab] = useState<Tab>('sms')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [linkingConversationId, setLinkingConversationId] = useState<string | null>(null)

  // SMS
  const { data: smsData, isLoading: smsLoading, isError: smsError, refetch: refetchSms } = useSmsHistory({ perPage: 100 })
  const sendSms = useSendSms()

  // WhatsApp — use unified endpoint that includes Twilio-direct conversations
  const { data: waConversations = [], isLoading: waConversationsLoading, isError: waError, refetch: refetchWa } = useAllWhatsAppConversations()
  const { data: waMessages = [], isLoading: waLoading } = useWhatsAppMessages(
    tab === 'whatsapp' ? selectedId : null
  )
  const sendWhatsApp = useSendWhatsApp()
  const linkToRecruit = useLinkConversationToRecruit()

  // Recruits for linking and stage display
  const { data: recruitsData } = useRecruits({ perPage: 200 })

  // Build a map of recruitId → stage for conversation badges
  const recruitStages = useMemo(() => {
    const map: Record<string, RecruitStage> = {}
    if (recruitsData?.recruits) {
      for (const r of recruitsData.recruits) {
        map[r.id] = r.stage
      }
    }
    return map
  }, [recruitsData])

  // Find recruit info for the selected conversation
  const selectedConversation = useMemo(() => {
    if (tab !== 'whatsapp' || !selectedId) return null
    return waConversations.find((c) => c.id === selectedId) ?? null
  }, [tab, selectedId, waConversations])

  const selectedRecruitInfo = useMemo(() => {
    const rid = selectedConversation?.recruitId
    if (!rid || !recruitsData?.recruits) return null
    const recruit = recruitsData.recruits.find((r) => r.id === rid)
    if (!recruit) return null
    return { id: recruit.id, name: `${recruit.firstName} ${recruit.lastName}`, stage: recruit.stage }
  }, [selectedConversation, recruitsData])

  // Group SMS messages by agent into conversations
  const smsConversations = useMemo(() => {
    const msgs = smsData?.messages ?? []
    const map: Record<string, { agentId: string; lastMessage: string; lastAt: string; messages: typeof msgs }> = {}
    for (const msg of msgs) {
      const key = msg.agentId || msg.toNumber
      if (!map[key]) {
        map[key] = { agentId: key, lastMessage: msg.body, lastAt: msg.createdAt, messages: [] }
      }
      map[key].messages.push(msg)
    }
    return Object.values(map).sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())
  }, [smsData])

  const selectedSmsMessages = useMemo(() => {
    if (tab !== 'sms' || !selectedId) return []
    const conv = smsConversations.find((c) => c.agentId === selectedId)
    return conv?.messages ?? []
  }, [tab, selectedId, smsConversations])

  const handleSend = (message: string) => {
    if (!selectedId) return

    if (tab === 'sms') {
      sendSms.mutate(
        { agentId: selectedId, message },
        {
          onSuccess: () => toast.success('SMS sent'),
          onError: () => toast.error('Failed to send SMS'),
        }
      )
    } else {
      sendWhatsApp.mutate(
        { to: selectedId, body: message, recruitId: selectedConversation?.recruitId ?? undefined },
        {
          onSuccess: () => toast.success('WhatsApp sent'),
          onError: () => toast.error('Failed to send'),
        }
      )
    }
  }

  const handleLinkRecruit = (recruitId: string) => {
    const convId = linkingConversationId || selectedId
    if (!convId) return
    linkToRecruit.mutate(
      { conversationId: convId, recruitId },
      {
        onSuccess: () => {
          toast.success('Conversation linked to recruit')
          setLinkingConversationId(null)
        },
        onError: () => toast.error('Failed to link conversation'),
      }
    )
  }

  const threadMessages = tab === 'sms'
    ? selectedSmsMessages.map((m) => ({ id: m.id, body: m.body, direction: m.direction, createdAt: m.createdAt }))
    : waMessages.map((m) => ({ id: m.id, body: m.body, direction: m.isFromContact ? 'inbound' : 'outbound', createdAt: m.sentAt || m.createdAt || '' }))

  // ── Loading skeleton ──────────────────────────────────────

  const isInitialLoading = (tab === 'sms' && smsLoading) || (tab === 'whatsapp' && waConversationsLoading)

  if (isInitialLoading) {
    return (
      <div className="space-y-4 h-[calc(100vh-120px)]">
        <div>
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-3 w-56 mt-2" />
        </div>
        <div className="flex h-[calc(100%-60px)] rounded-xl border border-border overflow-hidden">
          {/* Sidebar skeleton */}
          <div className="w-80 border-r border-border p-3 space-y-3">
            <Skeleton className="h-9 w-full rounded-lg" />
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`skel-conv-${i}`} className="flex items-center gap-3 p-2">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2 w-full" />
                </div>
              </div>
            ))}
          </div>
          {/* Main panel skeleton */}
          <div className="flex-1 p-6 space-y-4">
            <Skeleton className="h-5 w-48" />
            <div className="space-y-3 mt-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`skel-msg-${i}`} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                  <Skeleton className={`h-10 rounded-xl ${i % 2 === 0 ? 'w-2/5' : 'w-1/3'}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Error state ───────────────────────────────────────────

  if ((tab === 'sms' && smsError) || (tab === 'whatsapp' && waError)) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="h-[calc(100vh-120px)] pt-6">
        <motion.div variants={itemVariants} className="mb-4">
          <h1 className="text-xl font-bold text-foreground">Messaging</h1>
          <p className="text-xs text-muted-foreground mt-0.5">SMS and WhatsApp conversations</p>
        </motion.div>
        <motion.div variants={itemVariants} className="flex items-center justify-center h-[calc(100%-60px)] rounded-xl border border-border">
          <div className="text-center">
            <IconAlertCircle size={40} className="mx-auto mb-3 text-muted-foreground opacity-20" />
            <p className="text-sm text-muted-foreground">Failed to load {tab === 'sms' ? 'SMS' : 'WhatsApp'} data</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => tab === 'sms' ? refetchSms() : refetchWa()}
              className="mt-2 text-xs text-blue-400"
            >
              Retry
            </Button>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  // ── Empty state ───────────────────────────────────────────

  const noConversations = smsConversations.length === 0 && waConversations.length === 0

  if (noConversations) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="h-[calc(100vh-120px)]">
        <motion.div variants={itemVariants} className="mb-4">
          <h1 className="text-xl font-bold text-foreground">Messaging</h1>
          <p className="text-xs text-muted-foreground mt-0.5">SMS and WhatsApp conversations</p>
        </motion.div>
        <motion.div variants={itemVariants} className="flex items-center justify-center h-[calc(100%-60px)] rounded-xl border border-border">
          <EmptyState
            icon={IconMessageCircle}
            title="No conversations yet"
            description="Conversations will appear here once you send or receive SMS and WhatsApp messages."
          />
        </motion.div>
      </motion.div>
    )
  }

  // ── Main layout ───────────────────────────────────────────

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="h-[calc(100vh-120px)]">
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-4">
        <h1 className="text-xl font-bold text-foreground">Messaging</h1>
        <p className="text-xs text-muted-foreground mt-0.5">SMS and WhatsApp conversations</p>
      </motion.div>

      <motion.div variants={itemVariants} className="flex h-[calc(100%-60px)] rounded-xl border border-border overflow-hidden">
        {/* Left: Conversation List */}
        <div className="w-80 border-r border-border flex flex-col bg-card/50">
          {/* Tab Bar */}
          <div className="p-2 border-b border-border shrink-0">
            <Tabs value={tab} onValueChange={(v) => { setTab(v as Tab); setSelectedId(null) }}>
              <TabsList className="w-full">
                <TabsTrigger value="sms" className="flex-1">SMS</TabsTrigger>
                <TabsTrigger value="whatsapp" className="flex-1">WhatsApp</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <ConversationList
              tab={tab}
              smsConversations={smsConversations}
              whatsappConversations={waConversations}
              selectedId={selectedId}
              onSelect={setSelectedId}
              recruitStages={recruitStages}
              onLinkRecruit={(convId) => {
                setSelectedId(convId)
                setLinkingConversationId(convId)
              }}
            />
          </div>
        </div>

        {/* Right: Thread */}
        <div className="flex-1 bg-card/30">
          {selectedId ? (
            <MessageThread
              title={tab === 'sms' ? `SMS — ${selectedId}` : `WhatsApp — ${selectedConversation?.contactName || selectedConversation?.contactPhone || selectedId}`}
              messages={threadMessages}
              isLoading={tab === 'whatsapp' && waLoading}
              isSending={tab === 'sms' ? sendSms.isPending : sendWhatsApp.isPending}
              onSend={handleSend}
              recruitInfo={selectedRecruitInfo}
              calComUrl={tab === 'whatsapp' ? CAL_COM_URL : undefined}
              showLinkRecruit={tab === 'whatsapp' && !selectedConversation?.recruitId}
              recruits={recruitsData?.recruits}
              onLinkRecruit={handleLinkRecruit}
              isLinking={linkToRecruit.isPending}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <IconMessageCircle size={40} className="mx-auto mb-3 opacity-20" />
                <p className="text-sm">Select a conversation</p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
