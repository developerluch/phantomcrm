import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  IconCreditCard,
  IconCheck,
  IconCircle,
  IconChartBar,
  IconReceipt,
} from '@tabler/icons-react'

const FEATURES = [
  { name: 'Unlimited agents', active: true },
  { name: 'AI Chat assistant', active: true },
  { name: 'Discord bot integration', active: true },
  { name: 'WAVV tracking', active: true },
  { name: 'Sales & finance tracking', active: true },
  { name: 'Recruit pipeline', active: true },
  { name: 'WhatsApp messaging', active: false },
  { name: 'Automated social posting', active: false },
]

export default function BillingSettings() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Billing & Plan</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Manage your subscription and payment methods</p>
      </div>

      {/* Current Plan */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <IconCreditCard size={15} className="text-emerald-400" />
                Current Plan
              </CardTitle>
              <CardDescription className="text-xs mt-1">Your active subscription</CardDescription>
            </div>
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">Free Beta</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            You're on the Free Beta plan. All features are available during the beta period.
          </p>

          <div className="space-y-2">
            {FEATURES.map((feature) => (
              <div key={feature.name} className="flex items-center gap-2.5 text-sm">
                {feature.active ? (
                  <IconCheck size={14} className="text-emerald-400 shrink-0" />
                ) : (
                  <IconCircle size={14} className="text-muted-foreground/40 shrink-0" />
                )}
                <span className={feature.active ? 'text-foreground' : 'text-muted-foreground'}>
                  {feature.name}
                  {!feature.active && <span className="text-xs ml-1.5 text-muted-foreground/60">(coming soon)</span>}
                </span>
              </div>
            ))}
          </div>

          <Button variant="gradient" size="sm" disabled className="mt-2 opacity-50 cursor-not-allowed">
            Upgrade to Pro
          </Button>
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconChartBar size={15} className="text-blue-400" />
            Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/20 border border-border/50 p-3 text-center">
              <p className="text-lg font-bold text-foreground">—</p>
              <p className="text-[11px] text-muted-foreground">Agents</p>
            </div>
            <div className="rounded-lg bg-muted/20 border border-border/50 p-3 text-center">
              <p className="text-lg font-bold text-foreground">—</p>
              <p className="text-[11px] text-muted-foreground">API Calls</p>
            </div>
            <div className="rounded-lg bg-muted/20 border border-border/50 p-3 text-center">
              <p className="text-lg font-bold text-foreground">—</p>
              <p className="text-[11px] text-muted-foreground">Storage</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconReceipt size={15} className="text-purple-400" />
            Billing History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground border-b border-border">
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Description</th>
                <th className="text-right py-2">Amount</th>
                <th className="text-right py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="text-center py-8 text-muted-foreground text-xs">
                  No billing history
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Payment Method */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconCreditCard size={15} className="text-muted-foreground" />
            Payment Method
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">No payment method on file</p>
          <Button variant="outline" size="sm" disabled className="opacity-50 cursor-not-allowed">
            Add Payment Method
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
