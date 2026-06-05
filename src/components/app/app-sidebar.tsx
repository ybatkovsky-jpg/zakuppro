'use client'

import { useQuery } from '@tanstack/react-query'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { useAppStore, type ViewType } from '@/store/app-store'
import { useAuth } from '@/components/providers/auth-provider'
import Image from 'next/image'
import {
  LayoutDashboard,
  FolderKanban,
  Building2,
  Warehouse,
  Mail,
  FileText,
  BarChart3,
  Settings,
  Zap,
  XCircle,
} from 'lucide-react'

interface StatsData {
  totalProjects: number
  pendingRequests: number
  lowStockItems: number
}

const mainNavItems: { label: string; icon: React.ElementType; view: ViewType }[] = [
  { label: 'Дашборд', icon: LayoutDashboard, view: 'dashboard' },
  { label: 'Проекты', icon: FolderKanban, view: 'projects' },
  { label: 'Поставщики', icon: Building2, view: 'suppliers' },
  { label: 'Запросы', icon: Mail, view: 'requests' },
  { label: 'Счета', icon: FileText, view: 'invoices' },
  { label: 'Склад', icon: Warehouse, view: 'warehouse' },
  { label: 'Аналитика', icon: BarChart3, view: 'analytics' },
  { label: 'Автоматизация', icon: Zap, view: 'automation' },
  { label: 'Неудачные задачи', icon: XCircle, view: 'failed-tasks' },
]

const settingsNavItem: { label: string; icon: React.ElementType; view: ViewType } = {
  label: 'Настройки',
  icon: Settings,
  view: 'settings',
}

function getRussianDate(): string {
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ]
  const now = new Date()
  return `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`
}

export function AppSidebar() {
  const { currentView, navigate } = useAppStore()
  const { role } = useAuth()

  // Filter nav items based on user role
  const visibleMainNavItems = role
    ? mainNavItems.filter((item) => {
        if (role === 'owner') return true
        if (item.view === 'failed-tasks') return false
        if (role === 'manager') return true // all main nav items visible
        if (role === 'warehouse') return item.view === 'dashboard' || item.view === 'warehouse'
        return true
      })
    : mainNavItems

  const showSettings = role === 'owner'

  // Fetch stats for indicator dots and badges
  const { data: stats } = useQuery<StatsData>({
    queryKey: ['sidebar-stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats')
      if (!res.ok) throw new Error('Failed to fetch stats')
      const data = await res.json()
      return {
        totalProjects: data.totalProjects ?? 0,
        pendingRequests: data.pendingRequests ?? 0,
        lowStockItems: data.lowStockItems ?? 0,
      }
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const hasDraftRequests = (stats?.pendingRequests ?? 0) > 0
  const hasLowStock = (stats?.lowStockItems ?? 0) > 0

  const renderNavItem = (item: { label: string; icon: React.ElementType; view: ViewType }) => {
    const isActive =
      currentView === item.view ||
      (item.view === 'projects' && currentView === 'project-detail') ||
      (item.view === 'suppliers' && currentView === 'supplier-detail')

    // Determine badge
    let badgeCount = 0
    let badgeColor = ''
    if (item.view === 'projects') {
      badgeCount = stats?.totalProjects ?? 0
      badgeColor = 'bg-primary/15 text-primary'
    }
    if (item.view === 'warehouse' && hasLowStock) {
      badgeCount = stats?.lowStockItems ?? 0
      badgeColor = 'bg-red-500/15 text-red-600 dark:text-red-400'
    }
    if (item.view === 'requests' && hasDraftRequests) {
      badgeCount = stats?.pendingRequests ?? 0
      badgeColor = 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
    }

    // Determine if this item should show an indicator dot
    let showDot = false
    let dotColor = ''
    if (item.view === 'requests' && hasDraftRequests) {
      showDot = true
      dotColor = 'bg-amber-500'
    }
    if (item.view === 'warehouse' && hasLowStock) {
      showDot = true
      dotColor = 'bg-red-500'
    }

    return (
      <SidebarMenuItem key={item.view}>
        <SidebarMenuButton
          isActive={isActive}
          tooltip={item.label}
          onClick={() => navigate(item.view)}
          className={`
            relative transition-all duration-200 group overflow-hidden
            ${isActive
              ? 'bg-primary/10 text-primary font-semibold before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-6 before:w-[3px] before:rounded-full before:bg-primary before:transition-all before:duration-300 after:absolute after:inset-0 after:bg-primary/[0.03] after:rounded-md'
              : 'hover:bg-sidebar-accent/60 hover:translate-x-0.5 hover:before:absolute hover:before:left-0 hover:before:top-1/2 hover:before:-translate-y-1/2 hover:before:h-3 hover:before:w-[2px] hover:before:rounded-full hover:before:bg-sidebar-foreground/20 hover:before:transition-all hover:before:duration-200'
            }
          `}
        >
          <item.icon className={`h-4 w-4 transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
          <span className={`transition-colors duration-150 ${!isActive ? 'group-hover:text-sidebar-foreground' : ''}`}>{item.label}</span>
          {badgeCount > 0 && (
            <span className={`ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold leading-none ${badgeColor}`}>
              {badgeCount}
            </span>
          )}
          {showDot && badgeCount === 0 && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColor} opacity-75`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
            </span>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm overflow-hidden">
            <Image src="/logo.png" alt="ПРОМЕБЕЛЬ" width={32} height={32} className="h-8 w-8 object-contain rounded-lg" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold tracking-tight gradient-text">ПРОМЕБЕЛЬ</span>
            <span className="text-[10px] text-sidebar-foreground/60">
              Управление закупками ПРОМЕБЕЛЬ
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Навигация</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMainNavItems.map(renderNavItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showSettings && (
          <>
            <SidebarSeparator className="mx-2 opacity-50" />

            <SidebarGroup>
              <SidebarGroupLabel className="sr-only">Система</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderNavItem(settingsNavItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border bg-gradient-to-t from-sidebar-accent/20 to-transparent">
        <div className="px-2 py-1.5 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary tracking-wide">
              ПРОМЕБЕЛЬ v3.0
            </span>
          </div>
          <p className="text-[10px] text-sidebar-foreground/40">
            {getRussianDate()}
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
