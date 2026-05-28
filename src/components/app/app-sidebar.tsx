'use client'

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
} from '@/components/ui/sidebar'
import { useAppStore, type ViewType } from '@/store/app-store'
import {
  LayoutDashboard,
  FolderKanban,
  Building2,
  Warehouse,
  Mail,
  FileText,
  Settings,
  Package,
} from 'lucide-react'

const navItems: { label: string; icon: React.ElementType; view: ViewType }[] = [
  { label: 'Дашборд', icon: LayoutDashboard, view: 'dashboard' },
  { label: 'Проекты', icon: FolderKanban, view: 'projects' },
  { label: 'Поставщики', icon: Building2, view: 'suppliers' },
  { label: 'Запросы', icon: Mail, view: 'requests' },
  { label: 'Счета', icon: FileText, view: 'invoices' },
  { label: 'Склад', icon: Warehouse, view: 'warehouse' },
  { label: 'Настройки', icon: Settings, view: 'settings' },
]

export function AppSidebar() {
  const { currentView, navigate } = useAppStore()

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Package className="h-4 w-4" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-bold tracking-tight">ЗакупПро</span>
            <span className="text-[10px] text-sidebar-foreground/60">
              Управление закупками
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Навигация</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  currentView === item.view ||
                  (item.view === 'projects' && currentView === 'project-detail')

                return (
                  <SidebarMenuItem key={item.view}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={item.label}
                      onClick={() => navigate(item.view)}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-1 group-data-[collapsible=icon]:hidden">
          <p className="text-[10px] text-sidebar-foreground/50">
            ЗакупПро v1.0
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
