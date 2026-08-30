import { useState, useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNotifications, useMarkRead, useMarkAllRead } from '../hooks/useNotifications'
import { useWebSocketContext } from '../contexts/WebSocketContext'
import { IconBell, IconBellCheck, IconBellOff, IconCheck, IconChecks, IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Card } from '@/components/ui/card'
import MetricCard from '../components/MetricCard'
import EmptyState from '../components/EmptyState'
import { motion } from 'framer-motion'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24, mass: 0.8 } },
}

export default function NotificationsPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading, isError } = useNotifications({ page, perPage: 20 })
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()
  const queryClient = useQueryClient()
  const { subscribe } = useWebSocketContext()

  useEffect(() => {
    const unsub = subscribe('notification', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    })
    return () => unsub()
  }, [subscribe, queryClient])

  const notifications = data?.notifications ?? []
  const pageCount = data?.pageCount ?? 1

  const metrics = useMemo(() => {
    const total = notifications.length
    const unread = notifications.filter((n) => !n.read).length
    const read = notifications.filter((n) => n.read).length
    return { total, unread, read }
  }, [notifications])

  if (isLoading) {
    return (
      <div className="space-y-5 animate-fade-in">
        <div className="h-7 w-44 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-[60vh] bg-muted/30 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <p>Failed to load notifications.</p>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-5 pt-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Notifications</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Stay updated on activity across your organization</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => markAllRead.mutate()}
          disabled={markAllRead.isPending}
        >
          <IconChecks size={16} className="mr-1.5" />
          Mark All Read
        </Button>
      </motion.div>

      {/* Metric Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-3">
        <MetricCard
          label="Total"
          value={metrics.total}
          icon={<IconBell size={16} />}
          color="#3b82f6"
        />
        <MetricCard
          label="Unread"
          value={metrics.unread}
          icon={<IconBellOff size={16} />}
          color="#f59e0b"
        />
        <MetricCard
          label="Read"
          value={metrics.read}
          icon={<IconBellCheck size={16} />}
          color="#22c55e"
        />
      </motion.div>

      {/* List */}
      <motion.div variants={itemVariants} className="space-y-2">
        {notifications.length === 0 ? (
          <EmptyState
            icon={IconBell}
            title="No notifications"
            description="You'll see updates here as activity happens in your organization."
          />
        ) : (
          notifications.map((n) => (
            <motion.div key={n.id} variants={itemVariants}>
              <Card
                className={`bg-card/50 backdrop-blur border-border/50 p-4 flex items-start gap-3 transition-colors cursor-pointer ${
                  n.read
                    ? 'opacity-70'
                    : ''
                }`}
                onClick={() => {
                  if (!n.read) markRead.mutate(n.id)
                }}
              >
                <div
                  className={`mt-0.5 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                    n.read ? 'bg-muted' : 'bg-blue-500/10'
                  }`}
                >
                  <IconBell size={14} className={n.read ? 'text-muted-foreground' : 'text-blue-400'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm font-medium ${n.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {n.title}
                    </p>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
                {!n.read && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); markRead.mutate(n.id) }}
                      >
                        <IconCheck size={14} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Mark as read</TooltipContent>
                  </Tooltip>
                )}
              </Card>
            </motion.div>
          ))
        )}
      </motion.div>

      {/* Pagination */}
      {pageCount > 1 && (
        <motion.div variants={itemVariants} className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <IconChevronLeft size={14} />
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {pageCount}</span>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>
            <IconChevronRight size={14} />
          </Button>
        </motion.div>
      )}
    </motion.div>
  )
}
