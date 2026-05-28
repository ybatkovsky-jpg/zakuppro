'use client'

import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app/app-sidebar'
import { useAppStore } from '@/store/app-store'
import { Dashboard } from '@/components/app/dashboard'
import { Projects } from '@/components/app/projects'
import { ProjectDetail } from '@/components/app/project-detail'
import { Suppliers } from '@/components/app/suppliers'
import { Warehouse } from '@/components/app/warehouse'
import { Requests } from '@/components/app/requests'
import { Invoices } from '@/components/app/invoices'
import { Settings } from '@/components/app/settings'

const pageTitles: Record<string, string> = {
  dashboard: 'Дашборд',
  projects: 'Проекты',
  'project-detail': 'Детали проекта',
  suppliers: 'Поставщики',
  requests: 'Запросы поставщикам',
  invoices: 'Счета',
  warehouse: 'Склад',
  settings: 'Настройки',
}

function AppContent() {
  const { currentView } = useAppStore()

  const pageTitle = pageTitles[currentView] ?? 'ЗакупПро'
  const hasOwnHeader = currentView === 'project-detail'

  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 overflow-auto min-h-screen">
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <SidebarTrigger />
          {!hasOwnHeader && (
            <h1 className="text-lg font-semibold">{pageTitle}</h1>
          )}
        </div>
        <div className={hasOwnHeader ? '' : 'p-6'}>
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'projects' && <Projects />}
          {currentView === 'project-detail' && <ProjectDetail />}
          {currentView === 'suppliers' && <Suppliers />}
          {currentView === 'requests' && <Requests />}
          {currentView === 'invoices' && <Invoices />}
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
