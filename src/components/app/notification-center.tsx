'use client'

import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Bell,
  FolderPlus,
  ArrowRightLeft,
  FileText,
  Receipt,
  Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatRelativeTime } from '@/lib/utils'

interface ActivityItem {
  id: string
  type: 'project_created' | 'status_changed' | 'request_created' | 'invoice_received' | 'warehouse_transaction'
  title: string
  description: string
  timestamp: string
}

const typeIconMap: Record<ActivityItem['type'], React.ElementType> = {
  project_created: FolderPlus,
  status_changed: ArrowRightLeft,
  request_created: FileText,
  invoice_received: Receipt,
  warehouse_transaction: Package,
}

const typeColorMap: Record<ActivityItem['type'], string> = {
  project_created: 'text-emerald-600 dark:text-emerald-400',
  status_changed: 'text-amber-600 dark:text-amber-400',
  request_created: 'text-sky-600 dark:text-sky-400',
  invoice_received: 'text-violet-600 dark:text-violet-400',
  warehouse_transaction: 'text-orange-600 dark:text-orange-400',
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()

  const { data: activities = [] } = useQuery<ActivityItem[]>({
    queryKey: ['activity-notifications'],
    queryFn: async () => {
      const res = await fetch('/api/activity')
      if (!res.ok) return []
      return res.json()
    },
    refetchInterval: 30000,
  })

  const notifications = activities.slice(0, 10)
  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length

  const markAllAsRead = useCallback(() => {
    setReadIds(new Set(notifications.map((n) => n.id)))
  }, [notifications])

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen)
      if (isOpen) {
        queryClient.invalidateQueries({ queryKey: ['activity-notifications'] })
      }
    },
    [queryClient],
  )

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 relative" type="button">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <span className="sr-only">Уведомления</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">
            Уведомления
          </DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllAsRead}
              type="button"
            >
              Прочитать все
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Bell className="size-8 mb-2 opacity-40" />
            <p className="text-sm">Нет уведомлений</p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            {notifications.map((notification) => {
              const Icon = typeIconMap[notification.type]
              const colorClass = typeColorMap[notification.type]
              const isRead = readIds.has(notification.id)

              return (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors cursor-default ${
                    !isRead ? 'bg-accent/30' : ''
                  }`}
                  onClick={() => {
                    setReadIds((prev) => new Set([...prev, notification.id]))
                  }}
                >
                  <div className={`mt-0.5 ${colorClass}`}>
                    <Icon className="size-4 shrink-0" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight truncate">
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {notification.description}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-1">
                      {formatRelativeTime(notification.timestamp)}
                    </p>
                  </div>
                  {!isRead && (
                    <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                  )}
                </div>
              )
            })}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
