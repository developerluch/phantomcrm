import { NavLink } from 'react-router-dom'
import { useUnreadCount } from '../hooks/useNotifications'
import { IconBell } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { SidebarMenuButton } from '@/components/ui/sidebar'

interface Props {
  collapsed: boolean
}

export default function NotificationBell({ collapsed }: Props) {
  const { data } = useUnreadCount()
  const count = data?.count ?? 0

  return (
    <SidebarMenuButton asChild tooltip="Notifications">
      <NavLink
        to="/notifications"
        className={({ isActive }) =>
          cn(
            'transition-all duration-150',
            isActive
              ? '!bg-white/[0.06] !text-foreground font-medium shadow-[inset_3px_0_0_0_hsl(var(--foreground)/0.5)]'
              : 'text-zinc-500 hover:!text-zinc-300 hover:!bg-white/[0.04]',
          )
        }
      >
        <IconBell />
        <span>Notifications</span>
        {count > 0 && !collapsed && (
          <Badge
            variant="destructive"
            className="ml-auto h-4 min-w-[18px] rounded-full px-1.5 text-[10px] font-bold"
          >
            {count > 99 ? '99+' : count}
          </Badge>
        )}
      </NavLink>
    </SidebarMenuButton>
  )
}
