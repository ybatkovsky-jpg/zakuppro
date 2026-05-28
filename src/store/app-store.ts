import { create } from 'zustand'

export type ViewType = 'dashboard' | 'projects' | 'project-detail' | 'suppliers' | 'supplier-detail' | 'warehouse' | 'requests' | 'invoices' | 'analytics' | 'settings'

interface AppState {
  currentView: ViewType
  selectedProjectId: string | null
  selectedSupplierId: string | null
  setSelectedProjectId: (id: string | null) => void
  setSelectedSupplierId: (id: string | null) => void
  navigate: (view: ViewType) => void
  navigateToProject: (id: string) => void
  navigateToSupplier: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  selectedProjectId: null,
  selectedSupplierId: null,
  setSelectedProjectId: (id) => set({ selectedProjectId: id }),
  setSelectedSupplierId: (id) => set({ selectedSupplierId: id }),
  navigate: (view) => set({
    currentView: view,
    selectedProjectId: view !== 'project-detail' ? null : undefined,
    selectedSupplierId: view !== 'supplier-detail' ? null : undefined,
  }),
  navigateToProject: (id) => set({ currentView: 'project-detail', selectedProjectId: id }),
  navigateToSupplier: (id) => set({ currentView: 'supplier-detail', selectedSupplierId: id }),
}))
