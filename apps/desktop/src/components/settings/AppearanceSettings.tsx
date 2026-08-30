import { useThemeStore, type Theme } from '@/store/theme-store'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { IconPalette, IconSun, IconMoon, IconDeviceDesktop } from '@tabler/icons-react'

const THEME_OPTIONS: { value: Theme; label: string; icon: React.ElementType }[] = [
  { value: 'dark', label: 'Dark', icon: IconMoon },
  { value: 'light', label: 'Light', icon: IconSun },
  { value: 'system', label: 'System', icon: IconDeviceDesktop },
]

const ACCENT_COLORS = [
  { name: 'Lime', value: '#7dd3fc', ring: 'ring-[#7dd3fc]/30' },
  { name: 'Blue', value: '#3b82f6', ring: 'ring-blue-500/30' },
  { name: 'Purple', value: '#8b5cf6', ring: 'ring-purple-500/30' },
  { name: 'Orange', value: '#f59e0b', ring: 'ring-amber-500/30' },
  { name: 'Cyan', value: '#06b6d4', ring: 'ring-cyan-500/30' },
  { name: 'Red', value: '#ef4444', ring: 'ring-red-500/30' },
]

export default function AppearanceSettings() {
  const { theme, setTheme } = useThemeStore()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Customize the look and feel</p>
      </div>

      {/* Theme */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <IconPalette size={15} className="text-purple-400" />
            Theme
          </CardTitle>
          <CardDescription className="text-xs">Choose your preferred color scheme</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon
              const isActive = theme === option.value
              return (
                <Button
                  type="button"
                  variant="ghost"
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={`flex-1 flex flex-col items-center gap-2 p-4 h-auto rounded-xl border transition-all ${
                    isActive
                      ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                      : 'border-border/50 hover:border-border hover:bg-muted/10'
                  }`}
                >
                  <Icon size={20} className={isActive ? 'text-primary' : 'text-muted-foreground'} />
                  <span className={`text-xs font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {option.label}
                  </span>
                </Button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Accent Color */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#7dd3fc]/30 to-transparent rounded-t-xl" />
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Accent Color</CardTitle>
          <CardDescription className="text-xs">Choose your brand accent color</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {ACCENT_COLORS.map((color) => (
              <Tooltip key={color.value}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex flex-col items-center gap-1.5 h-auto p-1 rounded-full group"
                  >
                    <div
                      className="w-8 h-8 rounded-full transition-transform group-hover:scale-110"
                      style={{
                        background: color.value,
                        outline: color.value === '#7dd3fc' ? `2px solid ${color.value}` : 'none',
                        outlineOffset: 2,
                      }}
                    />
                    <span className="text-[10px] text-muted-foreground">{color.name}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{color.name}</TooltipContent>
              </Tooltip>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            Accent color customization coming soon. Currently using Lime.
          </p>
        </CardContent>
      </Card>

      {/* Other */}
      <Card style={{ background: 'linear-gradient(145deg, hsl(var(--card)), hsl(var(--popover)))' }}>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Display</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Compact Mode</p>
              <p className="text-xs text-muted-foreground">Reduce padding for denser UI</p>
            </div>
            <Badge variant="outline" className="text-[10px]">Coming soon</Badge>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Font Size</p>
              <p className="text-xs text-muted-foreground">Adjust the base font size</p>
            </div>
            <Badge variant="outline" className="text-[10px]">Coming soon</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
