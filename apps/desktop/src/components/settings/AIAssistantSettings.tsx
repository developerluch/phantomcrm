import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { IconRobot } from '@tabler/icons-react'

function usePersisted(key: string, onValue: string): [boolean, (next: boolean) => void] {
  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(key) === onValue
  })

  const set = (next: boolean) => {
    setValue(next)
    if (typeof window !== 'undefined') {
      if (next) {
        localStorage.setItem(key, onValue)
      } else {
        localStorage.removeItem(key)
      }
    }
  }

  return [value, set]
}

export default function AIAssistantSettings() {
  // Note: localStorage changes here affect useVoiceChat the next time it is instantiated.
  // Same-tab live sync is not implemented; for a SPA this occurs on page reload / remount.
  const [ttsEnabled, setTtsEnabled] = usePersisted('ai-chat.tts', 'on')
  const [skipDeleteConfirm, setSkipDeleteConfirm] = usePersisted('ai-chat.skipDeleteConfirm', '1')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">AI Assistant</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Configure AI chat behaviour and voice settings</p>
      </div>

      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lime-400/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconRobot size={15} className="text-lime-400" />
            Voice &amp; TTS
          </CardTitle>
          <CardDescription className="text-xs">Control how the AI assistant speaks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Text-to-speech responses</p>
              <p className="text-xs text-muted-foreground">Read AI replies aloud after each response</p>
            </div>
            <Switch
              checked={ttsEnabled}
              onCheckedChange={(checked) => setTtsEnabled(checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-lime-400/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconRobot size={15} className="text-lime-400" />
            Conversations
          </CardTitle>
          <CardDescription className="text-xs">Manage conversation behaviour</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Skip delete confirmation</p>
              <p className="text-xs text-muted-foreground">Skip the confirm dialog when deleting a conversation</p>
            </div>
            <Switch
              checked={skipDeleteConfirm}
              onCheckedChange={(checked) => setSkipDeleteConfirm(checked)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
