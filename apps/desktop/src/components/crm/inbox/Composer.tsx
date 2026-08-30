import { useState, useMemo, useEffect } from 'react'
import { IconSend, IconTemplate } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useSendMessage } from '@/hooks/useSendMessage'
import { useContact } from '@/hooks/useContacts'
import type { Channel, Contact, Conversation, SendMessageRequest } from '@/types/portal'
import {
  CHANNEL_ICON,
  CHANNEL_LABEL,
  CHANNEL_ORDER,
  CHANNEL_TINT,
  getDefaultProvider,
} from './channel-tint'
import { WhatsAppWindowBadge } from './WhatsAppWindowBadge'
import { TemplatePickerDialog } from './TemplatePickerDialog'

interface ComposerProps {
  conversation: Conversation
  contactId: string
}

// Whether a contact can receive on a given channel. Inferred from Contact's
// email/phone presence + DNC flags — there are no per-channel opt-in flags
// in the type yet (WhatsApp opt-in is implicit; iMessage capability isn't
// tracked at all).
function isReachableOn(channel: Channel, contact: Contact | undefined): boolean {
  if (!contact) return false
  switch (channel) {
    case 'sms':      return !!contact.phone && !contact.doNotSms
    case 'whatsapp': return !!contact.phone && !contact.doNotSms
    case 'imessage': return !!contact.phone
    case 'email':    return !!contact.email && !contact.doNotEmail
    case 'voice':    return !!contact.phone && !contact.doNotCall
  }
}

function unreachableReason(channel: Channel, contact: Contact | undefined): string {
  if (!contact) return 'Contact not loaded'
  switch (channel) {
    case 'sms':
      return contact.doNotSms ? 'Contact has SMS DNC enabled' : 'Contact has no phone on file'
    case 'whatsapp':
      return contact.doNotSms ? 'Contact has SMS/WhatsApp DNC enabled' : 'Contact has no phone on file'
    case 'imessage':
      return 'Contact has no phone on file'
    case 'email':
      return contact.doNotEmail ? 'Contact has Email DNC enabled' : 'Contact has no email on file'
    case 'voice':
      return 'Contact has no phone on file'
  }
}

const COMPOSER_CHANNELS: Channel[] = CHANNEL_ORDER.filter((c) => c === 'sms' || c === 'email')

function getSupportedChannel(channel: Channel): Channel {
  return COMPOSER_CHANNELS.includes(channel) ? channel : 'sms'
}

/** Conversation Composer. Renders a Tabs row that lets the user switch the
 *  outbound channel mid-thread (e.g., reply to a WhatsApp thread by email)
 *  + a Textarea + Send CTA. Channels the contact is not reachable on are
 *  rendered but disabled with a tooltip explaining why.
 *
 *  For WhatsApp: when the 24h window is closed (nil or past), the freeform
 *  Textarea is disabled and the user must pick an approved template via
 *  TemplatePickerDialog. Inside the window, freeform sends proceed normally
 *  and the WhatsAppWindowBadge shows the countdown. */
export function Composer({ conversation, contactId }: ComposerProps) {
  const [activeChannel, setActiveChannel] = useState<Channel>(getSupportedChannel(conversation.channel))
  const [body, setBody] = useState('')
  const [subject, setSubject] = useState('')
  const [templateOpen, setTemplateOpen] = useState(false)
  const sendMutation = useSendMessage()
  const { data: contact } = useContact(contactId)

  // Reset Composer state on thread swap. activeChannel snaps back to the
  // new conversation's stored channel, drafts clear.
  useEffect(() => {
    setActiveChannel(getSupportedChannel(conversation.channel))
    setBody('')
    setSubject('')
  }, [conversation.id, conversation.channel])

  const isWhatsApp = activeChannel === 'whatsapp'
  const isEmail = activeChannel === 'email'
  const waWindowOpen = useMemo(() => {
    if (!isWhatsApp) return true
    if (!conversation.whatsappWindowExpiresAt) return false
    return new Date(conversation.whatsappWindowExpiresAt).getTime() > Date.now()
  }, [isWhatsApp, conversation.whatsappWindowExpiresAt])

  const freeformDisabled = isWhatsApp && !waWindowOpen

  const send = () => {
    if (!body.trim() || freeformDisabled) return
    const request: Omit<SendMessageRequest, 'idempotencyKey'> = { body: body.trim() }
    if (isEmail && subject.trim()) {
      request.subject = subject.trim()
    }
    sendMutation.mutate({
      conversationId: conversation.id,
      contactId,
      channel: activeChannel,
      provider: getDefaultProvider(activeChannel),
      request,
    })
    setBody('')
    if (isEmail) setSubject('')
  }

  const sendTemplate = (templateId: string, variables: Record<string, string>) => {
    sendMutation.mutate({
      conversationId: conversation.id,
      contactId,
      channel: activeChannel,
      provider: getDefaultProvider(activeChannel),
      request: {
        templateId,
        templateVariables: variables,
      },
    })
  }

  return (
    <>
      <div className="border-t border-border/50 bg-card/30 backdrop-blur p-3">
        <Tabs
          value={activeChannel}
          onValueChange={(v) => setActiveChannel(v as Channel)}
          className="mb-2"
        >
          <TabsList className="h-9">
            {COMPOSER_CHANNELS.map((c) => {
              const Icon = CHANNEL_ICON[c]
              const reachable = isReachableOn(c, contact)
              const trigger = (
                <TabsTrigger
                  value={c}
                  disabled={!reachable}
                  className="gap-1.5 text-xs"
                >
                  <Icon size={14} style={{ color: CHANNEL_TINT[c] }} />
                  {CHANNEL_LABEL[c]}
                </TabsTrigger>
              )
              if (reachable) {
                return <span key={c}>{trigger}</span>
              }
              return (
                <Tooltip key={c}>
                  <TooltipTrigger asChild>
                    <span>{trigger}</span>
                  </TooltipTrigger>
                  <TooltipContent>{unreachableReason(c, contact)}</TooltipContent>
                </Tooltip>
              )
            })}
          </TabsList>
        </Tabs>

        {isWhatsApp && (
          <div className="mb-2 flex items-center justify-between">
            <WhatsAppWindowBadge expiresAt={conversation.whatsappWindowExpiresAt} />
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setTemplateOpen(true)}
            >
              <IconTemplate size={14} />
              Use template
            </Button>
          </div>
        )}

        {isWhatsApp && waWindowOpen && (
          <p className="mb-2 text-xs text-muted-foreground">
            24-hour window applies — use a template if it closes.
          </p>
        )}

        {isEmail && (
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="mb-2 h-9 text-sm hover:ring-1 hover:ring-accent/40 focus-visible:ring-2 focus-visible:ring-accent/60 motion-safe:transition-shadow motion-safe:duration-200"
          />
        )}

        <div className="flex items-end gap-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder={
              freeformDisabled
                ? 'WhatsApp 24h window closed — pick a template'
                : 'Type a message…'
            }
            disabled={freeformDisabled}
            className="min-h-[44px] max-h-[200px] flex-1 resize-y hover:ring-1 hover:ring-accent/40 focus-visible:ring-2 focus-visible:ring-accent/60 motion-safe:transition-shadow motion-safe:duration-200"
            rows={1}
          />

          {freeformDisabled ? (
            <Button
              onClick={() => setTemplateOpen(true)}
              className="gap-1.5"
            >
              <IconTemplate size={16} />
              Template
            </Button>
          ) : (
            <Button
              onClick={send}
              disabled={!body.trim() || sendMutation.isPending}
              className="gap-1.5"
              aria-label={isEmail ? 'Send email' : 'Send'}
            >
              <IconSend size={16} />
              {isEmail ? 'Send email' : 'Send'}
            </Button>
          )}
        </div>

        {sendMutation.isError && (
          <>
            <Separator className="my-2" />
            <p className="text-xs text-destructive">
              {sendMutation.error?.message ?? 'Send failed'}
            </p>
          </>
        )}
      </div>

      <TemplatePickerDialog
        open={templateOpen}
        onOpenChange={setTemplateOpen}
        channel={activeChannel}
        onSubmit={sendTemplate}
      />
    </>
  )
}
