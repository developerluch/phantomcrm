import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  IconMail,
  IconPlugConnected,
  IconTemplate,
  IconSettings,
  IconCards,
  IconCheck,
  IconLoader,
} from '@tabler/icons-react'
import {
  usePostableSettings,
  useUpdatePostableSettings,
  usePostableCards,
  useTestPostableConnection,
} from '@/hooks/usePostable'
import { SALE_STATUSES } from '@/types/portal'
import type { PostableCard } from '@/types/portal'
import { toast } from 'sonner'

const MOUNT_SPRING = { type: 'spring' as const, stiffness: 300, damping: 24, mass: 0.8 }
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: MOUNT_SPRING },
}

const TEMPLATE_VARS = [
  { key: '{clientName}', desc: "Client's full name" },
  { key: '{carrier}', desc: 'Insurance carrier name' },
  { key: '{agentName}', desc: "Agent's full name" },
  { key: '{agentPhone}', desc: "Agent's phone number" },
]

export default function PostableSettings() {
  const { data: settings, isLoading } = usePostableSettings()
  const updateSettings = useUpdatePostableSettings()
  const { data: cards, refetch: fetchCards, isFetching: cardsFetching } = usePostableCards()
  const testConnection = useTestPostableConnection()

  // Local form state
  const [enabled, setEnabled] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [defaultCardId, setDefaultCardId] = useState('')
  const [defaultCardImage, setDefaultCardImage] = useState('')
  const [messageTemplate, setMessageTemplate] = useState('')
  const [triggerStatuses, setTriggerStatuses] = useState<string[]>(['issued', 'paid'])
  const [dirty, setDirty] = useState(false)

  // Sync settings from server
  useEffect(() => {
    if (settings) {
      setEnabled(settings.enabled)
      setEmail(settings.email)
      setDefaultCardId(settings.defaultCardId)
      setDefaultCardImage(settings.defaultCardImage)
      setMessageTemplate(settings.messageTemplate)
      setTriggerStatuses(settings.triggerStatuses ?? ['issued', 'paid'])
      setDirty(false)
    }
  }, [settings])

  function markDirty() {
    setDirty(true)
  }

  async function handleSave() {
    try {
      await updateSettings.mutateAsync({
        enabled,
        email,
        password: password || undefined, // only send if user typed a new one
        defaultCardId,
        defaultCardImage,
        messageTemplate,
        triggerStatuses,
      })
      setPassword('')
      setDirty(false)
      toast.success('Postable settings saved')
    } catch {
      toast.error('Failed to save Postable settings')
    }
  }

  async function handleTestConnection() {
    try {
      const result = await testConnection.mutateAsync()
      if (result.success) {
        toast.success(result.message)
      } else {
        toast.error(result.message)
      }
    } catch {
      toast.error('Failed to test connection')
    }
  }

  function handleBrowseCards() {
    fetchCards()
  }

  function selectCard(card: PostableCard) {
    setDefaultCardId(String(card.id))
    setDefaultCardImage(card.image_url)
    markDirty()
  }

  function toggleTriggerStatus(status: string) {
    setTriggerStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    )
    markDirty()
  }

  // Template preview
  function renderPreview() {
    return messageTemplate
      .replace('{clientName}', 'John Smith')
      .replace('{carrier}', 'MetLife')
      .replace('{agentName}', 'Jane Doe')
      .replace('{agentPhone}', '(555) 123-4567')
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <IconLoader size={24} className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div>
        <h2 className="text-lg font-semibold text-foreground">Postable</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Automatically send physical thank-you postcards to clients when policies are issued or paid
        </p>
      </div>

      {/* Card 1: Connection */}
      <motion.div variants={itemVariants}>
        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IconPlugConnected size={18} className="text-primary" />
              Connection
              {settings?.hasPassword ? (
                <Badge variant="outline" className="text-emerald-400 border-emerald-400/30 ml-2">
                  Configured
                </Badge>
              ) : (
                <Badge variant="outline" className="text-amber-400 border-amber-400/30 ml-2">
                  Not configured
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Connect your Postable account to enable automated card sending
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                checked={enabled}
                onCheckedChange={(v) => {
                  setEnabled(v)
                  markDirty()
                }}
              />
              <Label className="text-sm">
                {enabled ? 'Auto thank-you cards enabled' : 'Auto thank-you cards disabled'}
              </Label>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Postable Email
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    markDirty()
                  }}
                  placeholder="your@email.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Postable Password
                </Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    markDirty()
                  }}
                  placeholder={settings?.hasPassword ? '••••••••' : 'Enter password'}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestConnection}
                disabled={testConnection.isPending || !settings?.hasPassword}
                className="flex items-center gap-1.5"
              >
                {testConnection.isPending ? (
                  <IconLoader size={14} className="animate-spin" />
                ) : (
                  <IconPlugConnected size={14} />
                )}
                Test Connection
              </Button>
              <Button
                variant="gradient"
                size="sm"
                onClick={handleSave}
                disabled={!dirty || updateSettings.isPending}
                className="flex items-center gap-1.5"
              >
                {updateSettings.isPending ? (
                  <IconLoader size={14} className="animate-spin" />
                ) : (
                  <IconCheck size={14} />
                )}
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Card 2: Card Template */}
      <motion.div variants={itemVariants}>
        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IconCards size={18} className="text-primary" />
              Card Template
            </CardTitle>
            <CardDescription>
              Choose the postcard design to send to your clients
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {defaultCardImage && (
              <div className="flex items-center gap-3 rounded-lg border border-border/30 bg-background/30 p-3">
                <img
                  src={defaultCardImage}
                  alt="Selected card"
                  className="w-20 h-14 object-cover rounded border border-border/30"
                />
                <div className="text-sm">
                  <p className="text-foreground font-medium">Selected Card</p>
                  <p className="text-muted-foreground text-xs">ID: {defaultCardId}</p>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleBrowseCards}
              disabled={cardsFetching || !settings?.hasPassword}
              className="flex items-center gap-1.5"
            >
              {cardsFetching ? (
                <IconLoader size={14} className="animate-spin" />
              ) : (
                <IconCards size={14} />
              )}
              Browse Cards
            </Button>

            {!settings?.hasPassword && (
              <p className="text-xs text-muted-foreground">
                Save your Postable credentials first to browse available cards
              </p>
            )}

            {cards && cards.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
                {cards.map((card) => (
                  <Button
                    key={card.id}
                    onClick={() => selectCard(card)}
                    variant="ghost"
                    className={`h-auto flex-col items-stretch rounded-lg border p-2 text-left transition-all hover:border-primary/50 ${
                      String(card.id) === defaultCardId
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                        : 'border-border/30 bg-background/30'
                    }`}
                  >
                    {card.image_url ? (
                      <img
                        src={card.image_url}
                        alt={card.name}
                        className="w-full h-24 object-cover rounded mb-2"
                      />
                    ) : (
                      <div className="w-full h-24 bg-muted/30 rounded mb-2 flex items-center justify-center">
                        <IconMail size={24} className="text-muted-foreground/30" />
                      </div>
                    )}
                    <p className="text-xs font-medium text-foreground truncate">{card.name}</p>
                    <p className="text-[10px] text-muted-foreground">${card.price}</p>
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Card 3: Message Template */}
      <motion.div variants={itemVariants}>
        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IconTemplate size={18} className="text-primary" />
              Message Template
            </CardTitle>
            <CardDescription>
              Customize the message printed inside the card
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Template Variables
              </Label>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_VARS.map((v) => (
                  <Tooltip key={v.key}>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono cursor-help"
                      >
                        {v.key}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>{v.desc}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>

            <Textarea
              value={messageTemplate}
              onChange={(e) => {
                setMessageTemplate(e.target.value)
                markDirty()
              }}
              placeholder="Enter your thank-you message template..."
              className="min-h-[200px] font-mono text-sm"
            />

            <Separator />

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Preview
              </Label>
              <div className="rounded-lg border border-border/30 bg-background/30 p-4 text-sm text-foreground/80 whitespace-pre-wrap">
                {renderPreview()}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Card 4: Trigger Settings */}
      <motion.div variants={itemVariants}>
        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IconSettings size={18} className="text-primary" />
              Auto-Send Triggers
            </CardTitle>
            <CardDescription>
              Choose which policy status changes automatically send a thank-you card
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SALE_STATUSES.map((status) => (
                <div key={status} className="flex items-center gap-2">
                  <Checkbox
                    id={`trigger-${status}`}
                    checked={triggerStatuses.includes(status)}
                    onCheckedChange={() => toggleTriggerStatus(status)}
                  />
                  <Label htmlFor={`trigger-${status}`} className="text-sm capitalize cursor-pointer">
                    {status}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              When a policy status changes to one of the checked statuses, a thank-you card will be
              automatically sent (if the client has an address on file and no card has been sent yet).
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
