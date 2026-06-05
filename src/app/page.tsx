'use client'

import { useEffect } from 'react'
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app/app-sidebar'
import { useAppStore, type ViewType } from '@/store/app-store'
import { useAuth } from '@/components/providers/auth-provider'
import { LoginPage } from '@/components/app/login-page'
import { Dashboard } from '@/components/app/dashboard'
import { Projects } from '@/components/app/projects'
import { ProjectDetail } from '@/components/app/project-detail'
import { Suppliers } from '@/components/app/suppliers'
import { SupplierDetail } from '@/components/app/supplier-detail'
import { Warehouse } from '@/components/app/warehouse'
import { Requests } from '@/components/app/requests'
import { Invoices } from '@/components/app/invoices'
import { Analytics } from '@/components/app/analytics'
import { Automation } from '@/components/app/automation'
import { Settings } from '@/components/app/settings'
import { GlobalSearch } from '@/components/app/global-search'
import { ThemeToggle } from '@/components/app/theme-toggle'
import { NotificationCenter } from '@/components/app/notification-center'
import { AIAssistant } from '@/components/app/ai-assistant'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const pageTitles: Record<string, string> = {
  dashboard: 'Дашборд',
  projects: 'Проекты',
  'project-detail': 'Детали проекта',
  suppliers: 'Поставщики',
  'supplier-detail': 'Детали поставщика',
  requests: 'Запросы поставщикам',
  invoices: 'Счета',
  analytics: 'Аналитика',
  automation: 'Автоматизация',
  warehouse: 'Склад',
  settings: 'Настройки',
}

function AppContent() {
  const { currentView } = useAppStore()
  const { user, role, logout } = useAuth()

  const pageTitle = pageTitles[currentView] ?? 'ПРОМЕБЕЛЬ'
  const hasOwnHeader = (currentView as string) === 'project-detail' || (currentView as string) === 'supplier-detail'

  // Role-based view access map
  const roleViewAccess: Record<string, ViewType[]> = {
    owner: ['dashboard', 'projects', 'project-detail', 'suppliers', 'supplier-detail', 'warehouse', 'requests', 'invoices', 'analytics', 'automation', 'settings'],
    manager: ['dashboard', 'projects', 'project-detail', 'suppliers', 'supplier-detail', 'warehouse', 'requests', 'invoices', 'analytics', 'automation'],
    warehouse: ['dashboard', 'warehouse'],
  }

  const allowedViews = role ? (roleViewAccess[role] ?? []) : []
  const isViewAuthorized = !role || allowedViews.includes(currentView)

  // Redirect to dashboard if current view is unauthorized for the user's role
  useEffect(() => {
    if (role && !allowedViews.includes(currentView)) {
      useAppStore.getState().navigate('dashboard')
    }
  }, [role, currentView, allowedViews])

  // Breadcrumb section
  const getBreadcrumb = () => {
    if (currentView === 'project-detail') return 'Проекты'
    if (currentView === 'supplier-detail') return 'Поставщики'
    return null
  }
  const breadcrumb = getBreadcrumb()

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 overflow-auto min-h-screen">
        <div className="sticky top-0 z-30 flex items-center gap-2 px-4 py-2 bg-background/80 backdrop-blur-sm shadow-[0_1px_3px_0_oklch(0_0_0/0.04)] dark:shadow-[0_1px_3px_0_oklch(0_0_0/0.2)]">
          <SidebarTrigger />
          {!hasOwnHeader && (
            <>
              {breadcrumb && (
                <>
                  <span className="text-sm text-muted-foreground/60 cursor-pointer hover:text-muted-foreground transition-colors" onClick={() => {
                    if ((currentView as string) === 'project-detail') useAppStore.getState().navigate('projects')
                    if ((currentView as string) === 'supplier-detail') useAppStore.getState().navigate('suppliers')
                  }}>{breadcrumb}</span>
                  <span className="text-muted-foreground/30">/</span>
                </>
              )}
              <AnimatePresence mode="wait">
                <motion.h1
                  key={currentView}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="text-lg font-semibold"
                >
                  {pageTitle}
                </motion.h1>
              </AnimatePresence>
            </>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {user && (
              <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">
                {user.username}
              </span>
            )}
            <ThemeToggle />
            <NotificationCenter />
            <GlobalSearch />
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              title="Выйти"
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className={`page-transition ${hasOwnHeader ? '' : 'p-6'}`}>
          {!isViewAuthorized && <Dashboard />}
          {isViewAuthorized && currentView === 'dashboard' && <Dashboard />}
          {isViewAuthorized && currentView === 'projects' && <Projects />}
          {isViewAuthorized && currentView === 'project-detail' && <ProjectDetail />}
          {isViewAuthorized && currentView === 'suppliers' && <Suppliers />}
          {isViewAuthorized && currentView === 'supplier-detail' && <SupplierDetail />}
          {isViewAuthorized && currentView === 'requests' && <Requests />}
          {isViewAuthorized && currentView === 'invoices' && <Invoices />}
          {isViewAuthorized && currentView === 'analytics' && <Analytics />}
          {isViewAuthorized && currentView === 'automation' && <Automation />}
          {isViewAuthorized && currentView === 'warehouse' && <Warehouse />}
          {isViewAuthorized && currentView === 'settings' && <Settings />}
        </div>
      </main>
      <AIAssistant />
    </SidebarProvider>
  )
}

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    // Show nothing while checking stored token — avoids flash of login page
    return null
  }

  if (!isAuthenticated) {
    return <LoginPage />
  }

  return <AppContent />
}
