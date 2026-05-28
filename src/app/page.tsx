'use client'

import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app/app-sidebar'
import { useAppStore } from '@/store/app-store'
import { Dashboard } from '@/components/app/dashboard'
import { Projects } from '@/components/app/projects'
import { ProjectDetail } from '@/components/app/project-detail'
import { Suppliers } from '@/components/app/suppliers'
import { SupplierDetail } from '@/components/app/supplier-detail'
import { Warehouse } from '@/components/app/warehouse'
import { Requests } from '@/components/app/requests'
import { Invoices } from '@/components/app/invoices'
import { Analytics } from '@/components/app/analytics'
import { Settings } from '@/components/app/settings'
import { GlobalSearch } from '@/components/app/global-search'
import { ThemeToggle } from '@/components/app/theme-toggle'
import { NotificationCenter } from '@/components/app/notification-center'
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
  warehouse: 'Склад',
  settings: 'Настройки',
}

function AppContent() {
  const { currentView } = useAppStore()

  const pageTitle = pageTitles[currentView] ?? 'ЗакупПро'
  const hasOwnHeader = currentView === 'project-detail' || currentView === 'supplier-detail'

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 overflow-auto min-h-screen">
        <div className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/80 backdrop-blur-sm px-4 py-2">
          <SidebarTrigger />
          {!hasOwnHeader && (
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
          )}
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationCenter />
            <GlobalSearch />
          </div>
        </div>
        <div className={hasOwnHeader ? '' : 'p-6'}>
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'projects' && <Projects />}
          {currentView === 'project-detail' && <ProjectDetail />}
          {currentView === 'suppliers' && <Suppliers />}
          {currentView === 'supplier-detail' && <SupplierDetail />}
          {currentView === 'requests' && <Requests />}
          {currentView === 'invoices' && <Invoices />}
          {currentView === 'analytics' && <Analytics />}
          {currentView === 'warehouse' && <Warehouse />}
          {currentView === 'settings' && <Settings />}
        </div>
      </main>
    </SidebarProvider>
  )
}

export default function Home() {
  return <AppContent />
}
