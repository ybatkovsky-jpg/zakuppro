import { create } from 'zustand'

export type ViewType = 'dashboard' | 'projects' | 'project-detail' | 'suppliers' | 'warehouse' | 'requests' | 'invoices' | 'settings'

interface AppState {
  currentView: ViewType
  selectedProjectId: string | null
  setSelectedProjectId: (id: string | null) => void
  navigate: (view: ViewType) => void
  navigateToProject: (id: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  selectedProjectId: null,
  setSelectedProjectId: (id) => set({ selectedProjectId: id }),
  navigate: (view) => set({ currentView: view, selectedProjectId: view !== 'project-detail' ? null : undefined }),
  navigateToProject: (id) => set({ currentView: 'project-detail', selectedProjectId: id }),
}))
