'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  BellOff,
  FolderKanban,
  ArrowRightLeft,
  FileText,
  Receipt,
  Package,
  AlertTriangle,
  Clock,
  Check,
  CheckCheck,
  Trash2,
  ExternalLink,
  Volume2,
  VolumeX,
  PackageX,
  Truck,
  MailQuestion,
  FilePlus,
  Send,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { formatRelativeTime } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'

// ── Types ───────────────────────────────────────────────────

interface NotificationItem {
  id: string
  type: string
  category: 'Проект' | 'Счёт' | 'Склад' | 'Запрос'
  title: string
  description: string
  timestamp: string
  read: boolean
  priority: 'high' | 'medium' | 'low'
  entityId?: string
  entityType?: string
}

interface NotificationsResponse {
  notifications: NotificationItem[]
  unreadCount: number
  totalCount: number
  categories: readonly ['Проект', 'Счёт', 'Склад', 'Запрос']
}

// ── Icon & Color Maps ───────────────────────────────────────

const typeIconMap: Record<string, React.ElementType> = {
  low_stock: PackageX,
  below_min_stock: AlertTriangle,
  invoice_pending: Receipt,
  invoice_discrepancy: AlertTriangle,
  status_changed: ArrowRightLeft,
  overdue_delivery: Truck,
  unanswered_request: MailQuestion,
  project_created: FilePlus,
  draft_request: Send,
  project_created_legacy: FolderKanban,
  request_created: FileText,
  invoice_received: Receipt,
  warehouse_transaction: Package,
}

const categoryConfig: Record<string, { color: string; bg: string; border: string }> = {
  'Проект': {
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-100 dark:bg-emerald-900/40',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  'Счёт': {
    color: 'text-violet-700 dark:text-violet-300',
    bg: 'bg-violet-100 dark:bg-violet-900/40',
    border: 'border-violet-200 dark:border-violet-800',
  },
  'Склад': {
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    border: 'border-amber-200 dark:border-amber-800',
  },
  'Запрос': {
    color: 'text-sky-700 dark:text-sky-300',
    bg: 'bg-sky-100 dark:bg-sky-900/40',
    border: 'border-sky-200 dark:border-sky-800',
  },
}

// ── Empty State Illustration ────────────────────────────────

function EmptyBellIllustration() {
  return (
    <svg viewBox="0 0 200 160" fill="none" className="w-40 h-32 mx-auto" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="75" r="45" className="fill-muted stroke-muted-foreground/15" strokeWidth="2" />
      <path
        d="M80 75 C80 55, 120 55, 120 75 L120 95 C120 100, 115 105, 110 105 L90 105 C85 105, 80 100, 80 95 Z"
        className="fill-muted-foreground/10 stroke-muted-foreground/25"
        strokeWidth="1.5"
      />
      <line x1="95" y1="105" x2="105" y2="105" className="stroke-muted-foreground/30" strokeWidth="2" strokeLinecap="round" />
      <circle cx="100" cy="110" r="3" className="fill-muted-foreground/20" />
      <line x1="70" y1="65" x2="60" y2="55" className="stroke-muted-foreground/15" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="130" y1="65" x2="140" y2="55" className="stroke-muted-foreground/15" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="55" cy="50" r="4" className="fill-muted-foreground/10" />
      <circle cx="145" cy="50" r="4" className="fill-muted-foreground/10" />
      <path d="M85 72 L90 67 L95 72" className="stroke-emerald-400/50" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M105 72 L110 67 L115 72" className="stroke-emerald-400/50" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Main Component ──────────────────────────────────────────

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const queryClient = useQueryClient()
  const navigate = useAppStore((s) => s.navigate)
  const navigateToProject = useAppStore((s) => s.navigateToProject)

  // Fetch notifications
  const { data: notificationsData, isLoading } = useQuery<NotificationsResponse>({
    queryKey: ['notifications', activeCategory],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (activeCategory !== 'all') params.set('category', activeCategory)
      const res = await fetch(`/api/notifications?${params.toString()}`)
      if (!res.ok) return { notifications: [], unreadCount: 0, totalCount: 0, categories: ['Проект', 'Счёт', 'Склад', 'Запрос'] as const }
      return res.json()
    },
    refetchInterval: 30000,
    enabled: open,
  })

  const notifications = notificationsData?.notifications ?? []
  const unreadCount = notificationsData?.unreadCount ?? 0

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // Clear all mutation
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true }),
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // Mark single as read
  const handleMarkRead = useCallback((id: string) => {
    markReadMutation.mutate([id])
  }, [markReadMutation])

  // Mark all as read
  const handleMarkAllRead = useCallback(() => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length > 0) {
      markReadMutation.mutate(unreadIds)
    }
  }, [notifications, markReadMutation])

  // Clear all
  const handleClearAll = useCallback(() => {
    clearAllMutation.mutate()
  }, [clearAllMutation])

  // Navigate to related entity
  const handleNotificationClick = useCallback((notification: NotificationItem) => {
    if (!notification.read) {
      handleMarkRead(notification.id)
    }
    if (notification.entityType === 'project' && notification.entityId) {
      navigateToProject(notification.entityId)
      setOpen(false)
    } else if (notification.entityType === 'warehouse') {
      navigate('warehouse')
      setOpen(false)
    } else if (notification.entityType === 'invoice') {
      navigate('invoices')
      setOpen(false)
    } else if (notification.entityType === 'request') {
      navigate('requests')
      setOpen(false)
    } else if (notification.entityType === 'delivery') {
      if (notification.entityId) {
        navigateToProject(notification.entityId)
      }
      setOpen(false)
    }
  }, [handleMarkRead, navigate, navigateToProject])

  // Category counts for badges
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: notifications.filter(n => !n.read).length }
    for (const n of notifications) {
      if (!n.read) {
        counts[n.category] = (counts[n.category] || 0) + 1
      }
    }
    return counts
  }, [notifications])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 relative" type="button">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
          {soundEnabled && unreadCount > 0 && (
            <motion.span
              className="absolute -top-0.5 -right-0.5 size-4 rounded-full bg-destructive"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              style={{ opacity: 0.4 }}
            />
          )}
          <span className="sr-only">Уведомления</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[380px] p-0 rounded-xl shadow-xl border"
        sideOffset={8}
      >
        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b bg-muted/30 rounded-t-xl">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Уведомления</h3>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* Sound toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Звук включён' : 'Звук выключен'}
            >
              {soundEnabled ? (
                <Volume2 className="size-3.5 text-muted-foreground" />
              ) : (
                <VolumeX className="size-3.5 text-muted-foreground/50" />
              )}
            </Button>
            {/* Clear all */}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                type="button"
                onClick={handleClearAll}
                title="Очистить все"
              >
                <Trash2 className="size-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>

        {/* Category Filter */}
        {notifications.length > 0 && (
          <div className="px-3 py-2 border-b">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                onClick={() => setActiveCategory('all')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  activeCategory === 'all'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                Все
                {(categoryCounts.all || 0) > 0 && (
                  <span className={`ml-0.5 ${activeCategory === 'all' ? 'text-primary-foreground/80' : ''}`}>
                    {categoryCounts.all}
                  </span>
                )}
              </button>
              {(['Проект', 'Счёт', 'Склад', 'Запрос'] as const).map((cat) => {
                const config = categoryConfig[cat]
                const count = categoryCounts[cat] || 0
                const isActive = activeCategory === cat
                return (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(isActive ? 'all' : cat)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap border ${
                      isActive
                        ? `${config.bg} ${config.color} ${config.border}`
                        : 'bg-background text-muted-foreground border-transparent hover:bg-muted'
                    }`}
                  >
                    {cat}
                    {count > 0 && (
                      <span className={`ml-0.5 ${isActive ? '' : 'text-muted-foreground/60'}`}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Mark all read button */}
        {unreadCount > 0 && (
          <div className="px-3 py-1.5 border-b bg-muted/20">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground w-full justify-center gap-1.5"
              onClick={handleMarkAllRead}
              type="button"
            >
              <CheckCheck className="size-3" />
              Прочитать все ({unreadCount})
            </Button>
          </div>
        )}

        {/* Notifications list or empty state */}
        {isLoading ? (
          <div className="py-8 flex flex-col items-center gap-2">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="size-1.5 rounded-full bg-muted-foreground/30"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Загрузка...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-6 px-4 flex flex-col items-center text-center">
            <EmptyBellIllustration />
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/80 mb-3 -mt-2">
              <BellOff className="size-5 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Нет уведомлений</p>
            <p className="text-xs text-muted-foreground/60 max-w-[240px]">
              Все в порядке! Новые уведомления появятся здесь автоматически.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <AnimatePresence mode="popLayout">
              {notifications.map((notification, index) => {
                const Icon = typeIconMap[notification.type] || Bell
                const catConfig = categoryConfig[notification.category] || categoryConfig['Проект']

                return (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20, height: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    className={`group relative flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer hover:bg-accent/50 ${
                      !notification.read ? 'bg-accent/20' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Left: Category icon */}
                    <div className="flex flex-col items-center gap-1 mt-0.5">
                      <div className={`flex size-8 items-center justify-center rounded-lg ${catConfig.bg}`}>
                        <Icon className={`size-4 ${catConfig.color}`} />
                      </div>
                    </div>

                    {/* Center: Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        {/* Category badge */}
                        <Badge
                          variant="outline"
                          className={`h-4 px-1.5 text-[10px] border-0 ${catConfig.bg} ${catConfig.color}`}
                        >
                          {notification.category}
                        </Badge>
                        {/* Priority indicator */}
                        {notification.priority === 'high' && (
                          <span className="flex items-center gap-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                            <AlertTriangle className="size-2.5" />
                            Важно
                          </span>
                        )}
                      </div>
                      <p className={`text-sm leading-tight truncate ${!notification.read ? 'font-semibold' : 'font-medium'}`}>
                        {notification.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {notification.description}
                      </p>
                      {/* Timestamp - more prominent */}
                      <div className="flex items-center gap-1 mt-1.5">
                        <Clock className="size-3 text-muted-foreground/50" />
                        <span className="text-[11px] font-medium text-muted-foreground/70">
                          {formatRelativeTime(notification.timestamp)}
                        </span>
                      </div>
                    </div>

                    {/* Right: Unread dot + Mark as read */}
                    <div className="flex flex-col items-center gap-1 mt-1 shrink-0">
                      {!notification.read && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="size-2 rounded-full bg-primary"
                        />
                      )}
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5 opacity-0 group-hover:opacity-100 transition-opacity"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleMarkRead(notification.id)
                          }}
                          title="Прочитать"
                        >
                          <Check className="size-3" />
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </ScrollArea>
        )}

        {/* Footer with View All link */}
        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-2.5 flex items-center justify-between">
              <button
                onClick={() => {
                  navigate('dashboard')
                  setOpen(false)
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <ExternalLink className="size-3" />
                Все уведомления
              </button>
              <span className="text-[11px] text-muted-foreground/50">
                {notifications.length} из {notificationsData?.totalCount ?? notifications.length}
              </span>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
