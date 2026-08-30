import { useState } from 'react'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  IconWebhook,
  IconKey,
  IconCopy,
  IconCheck,
  IconPlayerPlay,
  IconCode,
  IconTrash,
  IconRefresh,
  IconExternalLink,
  IconAlertTriangle,
} from '@tabler/icons-react'
import {
  useWebhookConfig,
  useGenerateWebhookKey,
  useUpdateWebhookConfig,
  useRevokeWebhookKey,
  useWebhookLogs,
  useTestWebhook,
} from '@/hooks/useWebhooks'
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

interface FormField {
  key: string
  label: string
  placeholder: string
  type: string
  required: boolean
}

const FORM_FIELDS: FormField[] = [
  { key: 'firstName', label: 'First Name', placeholder: 'First Name', type: 'text', required: true },
  { key: 'lastName', label: 'Last Name', placeholder: 'Last Name', type: 'text', required: true },
  { key: 'email', label: 'Email', placeholder: 'Email', type: 'email', required: true },
  { key: 'phone', label: 'Phone', placeholder: 'Phone', type: 'tel', required: false },
  { key: 'city', label: 'City', placeholder: 'City', type: 'text', required: false },
  { key: 'state', label: 'State', placeholder: 'State', type: 'text', required: false },
  { key: 'notes', label: 'Notes', placeholder: 'Any additional information...', type: 'text', required: false },
]

const getWebhookUrl = () => {
  const base = import.meta.env.VITE_API_URL || window.location.origin
  return `${base}/api/v1/webhooks/recruits/intake`
}

export default function WebhookSettings() {
  const { data: config, isLoading: configLoading } = useWebhookConfig()
  const { data: logsData } = useWebhookLogs({ perPage: 10 })
  const generateKey = useGenerateWebhookKey()
  const updateConfig = useUpdateWebhookConfig()
  const revokeKey = useRevokeWebhookKey()
  const testWebhook = useTestWebhook()

  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedKey, setCopiedKey] = useState(false)
  const [copiedForm, setCopiedForm] = useState(false)

  // Generate key dialog
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [copiedGenerated, setCopiedGenerated] = useState(false)

  // Revoke dialog
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)

  // Embeddable form dialog
  const [showFormDialog, setShowFormDialog] = useState(false)
  const [selectedFields, setSelectedFields] = useState<string[]>(['firstName', 'lastName', 'email'])
  const [submitButtonText, setSubmitButtonText] = useState('Get Started')
  const [redirectUrl, setRedirectUrl] = useState('')

  // Test result
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const webhookUrl = getWebhookUrl()

  function copyToClipboard(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text)
    setter(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setter(false), 2000)
  }

  async function handleGenerateKey() {
    try {
      const result = await generateKey.mutateAsync()
      setGeneratedKey(result.apiKey)
      setShowGenerateDialog(true)
    } catch {
      toast.error('Failed to generate webhook key')
    }
  }

  async function handleRevokeKey() {
    try {
      await revokeKey.mutateAsync()
      setShowRevokeDialog(false)
      toast.success('Webhook key revoked')
    } catch {
      toast.error('Failed to revoke webhook key')
    }
  }

  async function handleToggleEnabled(enabled: boolean) {
    try {
      await updateConfig.mutateAsync({ enabled })
      toast.success(enabled ? 'Webhook enabled' : 'Webhook disabled')
    } catch {
      toast.error('Failed to update webhook config')
    }
  }

  async function handleTestWebhook() {
    try {
      const result = await testWebhook.mutateAsync()
      setTestResult(result)
      if (result.success) {
        toast.success('Test webhook sent successfully')
      } else {
        toast.error(result.message || 'Test webhook failed')
      }
    } catch {
      setTestResult({ success: false, message: 'Failed to send test webhook' })
      toast.error('Failed to send test webhook')
    }
  }

  function toggleField(key: string) {
    const alwaysRequired = ['firstName', 'lastName', 'email']
    if (alwaysRequired.includes(key)) return
    setSelectedFields((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key],
    )
  }

  function generateFormHtml(): string {
    const fields = FORM_FIELDS.filter((f) => selectedFields.includes(f.key))
    const inputLines = fields
      .map((f) => {
        const req = f.required ? ' required' : ''
        return `  <input type="${f.type}" name="${f.key}" placeholder="${f.placeholder}"${req} />`
      })
      .join('\n')

    const redirect = redirectUrl || 'https://yoursite.com/thank-you'

    return `<!-- Phantom Lead Capture Form -->
<form id="phantom-lead-form" onsubmit="return submitToPhantom(event)">
${inputLines}
  <button type="submit">${submitButtonText}</button>
</form>
<script>
async function submitToPhantom(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  data.source = 'website_form';
  try {
    const res = await fetch('${webhookUrl}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': 'YOUR_API_KEY' },
      body: JSON.stringify(data)
    });
    if (res.ok) window.location.href = '${redirect}';
    else alert('Something went wrong. Please try again.');
  } catch (err) { alert('Something went wrong. Please try again.'); }
}
</script>`
  }

  function formatTimestamp(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div>
        <h2 className="text-lg font-semibold text-foreground">Webhooks</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Receive leads from external websites and forms via webhook
        </p>
      </div>

      {/* Card 1: Webhook Endpoint & API Key */}
      <motion.div variants={itemVariants}>
        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IconWebhook size={18} className="text-primary" />
              Webhook Endpoint & API Key
            </CardTitle>
            <CardDescription>
              Use this endpoint to send lead data from your website or third-party integrations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Webhook URL */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Webhook URL
              </Label>
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="flex-1 font-mono text-xs" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(webhookUrl, setCopiedUrl)}
                  className="shrink-0 px-2"
                >
                  {copiedUrl ? <IconCheck size={14} className="text-emerald-400" /> : <IconCopy size={14} />}
                </Button>
              </div>
            </div>

            <Separator />

            {/* API Key */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                API Key
              </Label>
              {configLoading ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : config ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={`${config.apiKeyPrefix}${'*'.repeat(32)}`}
                    readOnly
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(config.apiKeyPrefix, setCopiedKey)}
                    className="shrink-0 px-2"
                  >
                    {copiedKey ? <IconCheck size={14} className="text-emerald-400" /> : <IconCopy size={14} />}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No key generated yet</p>
              )}
            </div>

            <Separator />

            {/* Enable/Disable + Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Switch
                  checked={config?.enabled ?? false}
                  onCheckedChange={handleToggleEnabled}
                  disabled={!config || updateConfig.isPending}
                />
                <Label className="text-sm">
                  {config?.enabled ? 'Webhook enabled' : 'Webhook disabled'}
                </Label>
              </div>
              <div className="flex gap-2">
                {!config ? (
                  <Button
                    variant="gradient"
                    size="sm"
                    onClick={handleGenerateKey}
                    disabled={generateKey.isPending}
                    className="flex items-center gap-1.5"
                  >
                    <IconKey size={14} />
                    {generateKey.isPending ? 'Generating...' : 'Generate Key'}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateKey}
                      disabled={generateKey.isPending}
                      className="flex items-center gap-1.5"
                    >
                      <IconRefresh size={14} />
                      Regenerate
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowRevokeDialog(true)}
                      disabled={revokeKey.isPending}
                      className="flex items-center gap-1.5"
                    >
                      <IconTrash size={14} />
                      Revoke
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Card 2: Embeddable Form Generator */}
      <motion.div variants={itemVariants}>
        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IconCode size={18} className="text-primary" />
              Embeddable Form Generator
            </CardTitle>
            <CardDescription>
              Generate an HTML form snippet to embed on your website for lead capture
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => setShowFormDialog(true)}
              className="flex items-center gap-2"
            >
              <IconCode size={16} />
              Generate Form Code
              <IconExternalLink size={14} className="text-muted-foreground" />
            </Button>
          </CardContent>
        </Card>
      </motion.div>

      {/* Card 3: Test Webhook */}
      <motion.div variants={itemVariants}>
        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IconPlayerPlay size={18} className="text-primary" />
              Test Webhook
            </CardTitle>
            <CardDescription>
              Send a test payload to verify your webhook is working correctly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestWebhook}
                disabled={testWebhook.isPending || !config}
                className="flex items-center gap-1.5"
              >
                <IconPlayerPlay size={14} />
                {testWebhook.isPending ? 'Sending...' : 'Send Test'}
              </Button>
              {testResult && (
                <Badge variant={testResult.success ? 'default' : 'destructive'}>
                  {testResult.success ? 'Success' : 'Error'}: {testResult.message}
                </Badge>
              )}
            </div>
            {!config && (
              <p className="text-xs text-muted-foreground">
                Generate an API key first to test the webhook
              </p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Card 4: Recent Activity */}
      <motion.div variants={itemVariants}>
        <Card className="border-border/40 bg-card/50 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <IconWebhook size={18} className="text-primary" />
              Recent Activity
            </CardTitle>
            <CardDescription>Latest webhook requests and their status</CardDescription>
          </CardHeader>
          <CardContent>
            {logsData?.logs && logsData.logs.length > 0 ? (
              <div className="space-y-2">
                {logsData.logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded-lg border border-border/30 bg-background/30 px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          log.statusCode >= 200 && log.statusCode < 300
                            ? 'default'
                            : 'destructive'
                        }
                        className="text-[10px] font-mono tabular-nums"
                      >
                        {log.statusCode}
                      </Badge>
                      <span className="text-sm text-foreground">{log.responseStatus}</span>
                      {log.errorMessage && (
                        <span className="text-xs text-red-400 truncate max-w-[200px]">
                          {log.errorMessage}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(log.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <IconWebhook size={32} className="mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No activity yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Webhook requests will appear here once you start receiving them
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Generate Key Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconKey size={18} className="text-primary" />
              Webhook API Key Generated
            </DialogTitle>
            <DialogDescription>
              Copy your API key now. This is the only time it will be shown.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-400 text-sm flex items-start gap-2">
              <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>This key will only be shown once. Copy it now.</span>
            </div>
            {generatedKey && (
              <div className="flex gap-2">
                <Input
                  value={generatedKey}
                  readOnly
                  className="flex-1 font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(generatedKey, setCopiedGenerated)}
                  className="shrink-0 px-2"
                >
                  {copiedGenerated ? (
                    <IconCheck size={14} className="text-emerald-400" />
                  ) : (
                    <IconCopy size={14} />
                  )}
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Key Dialog */}
      <Dialog open={showRevokeDialog} onOpenChange={setShowRevokeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <IconAlertTriangle size={18} />
              Revoke Webhook Key
            </DialogTitle>
            <DialogDescription>
              This will permanently disable all webhook integrations using this key. Any website
              forms using this key will stop working immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevokeDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeKey}
              disabled={revokeKey.isPending}
            >
              {revokeKey.isPending ? 'Revoking...' : 'Revoke Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Embeddable Form Dialog */}
      <Dialog open={showFormDialog} onOpenChange={setShowFormDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconCode size={18} className="text-primary" />
              Embeddable Form Generator
            </DialogTitle>
            <DialogDescription>
              Customize and copy the HTML code to embed a lead capture form on your website
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Field selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Form Fields</Label>
              <div className="grid grid-cols-2 gap-2">
                {FORM_FIELDS.map((field) => {
                  const isRequired = ['firstName', 'lastName', 'email'].includes(field.key)
                  return (
                    <div key={field.key} className="flex items-center gap-2">
                      <Checkbox
                        id={`field-${field.key}`}
                        checked={selectedFields.includes(field.key)}
                        onCheckedChange={() => toggleField(field.key)}
                        disabled={isRequired}
                      />
                      <Label htmlFor={`field-${field.key}`} className="text-sm cursor-pointer">
                        {field.label}
                        {isRequired && (
                          <span className="text-xs text-muted-foreground ml-1">(required)</span>
                        )}
                      </Label>
                    </div>
                  )
                })}
              </div>
            </div>

            <Separator />

            {/* Submit button text */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Submit Button Text</Label>
              <Input
                value={submitButtonText}
                onChange={(e) => setSubmitButtonText(e.target.value)}
                placeholder="Get Started"
              />
            </div>

            {/* Redirect URL */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Redirect URL (after submit)</Label>
              <Input
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
                placeholder="https://yoursite.com/thank-you"
              />
            </div>

            <Separator />

            {/* Generated code */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Generated HTML</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(generateFormHtml(), setCopiedForm)}
                  className="flex items-center gap-1.5"
                >
                  {copiedForm ? (
                    <IconCheck size={14} className="text-emerald-400" />
                  ) : (
                    <IconCopy size={14} />
                  )}
                  Copy Code
                </Button>
              </div>
              <Textarea
                value={generateFormHtml()}
                readOnly
                className="font-mono text-xs h-64 resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Replace <code className="text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded">YOUR_API_KEY</code> with
                your actual webhook API key before deploying.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFormDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
