import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { IconUserPlus, IconCash, IconReceipt, IconMessageChatbot } from '@tabler/icons-react'

export default function QuickActionsWidget() {
  const navigate = useNavigate()

  const actions = [
    { label: 'Add Recruit', icon: IconUserPlus, path: '/agents', color: '#3b82f6' },
    { label: 'Log Sale', icon: IconCash, path: '/sales', color: '#22c55e' },
    { label: 'Log Expense', icon: IconReceipt, path: '/finance', color: '#f59e0b' },
    { label: 'AI Chat', icon: IconMessageChatbot, path: '/chat', color: '#8b5cf6' },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 h-full p-1">
      {actions.map(({ label, icon: Icon, path, color }) => (
        <Button
          key={label}
          variant="outline"
          className="h-full min-h-[80px] flex flex-col items-center justify-center gap-3 rounded-xl border-border/50 bg-card/30 hover:bg-card/60 transition-all"
          onClick={() => navigate(path)}
        >
          <div className="p-2.5 rounded-xl" style={{ background: `${color}15` }}>
            <Icon size={22} style={{ color }} />
          </div>
          <span className="text-xs font-medium text-foreground/80">{label}</span>
        </Button>
      ))}
    </div>
  )
}
