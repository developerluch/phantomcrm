import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { IconAdjustments, IconArrowRight } from '@tabler/icons-react'

export default function PipelineConfigSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Pipeline Configuration</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Configure recruit pipeline stages and automation</p>
      </div>

      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconAdjustments size={15} className="text-blue-400" />
            Stage Configuration
          </CardTitle>
          <CardDescription className="text-xs">
            Configure SMS templates, manager assignments, and auto-assign rules for each pipeline stage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted/20 border border-border/50 p-4">
            <p className="text-sm text-muted-foreground">
              Pipeline stages control the recruit journey from New Lead through Onboarded. Each stage can have
              custom SMS templates, assigned managers, and Discord notification rules.
            </p>
          </div>

          <a
            href="#/settings/pipeline"
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            Manage pipeline stages
            <IconArrowRight size={14} />
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
