'use client'

import { useState, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/store/app-store'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Upload,
  Trash2,
  MoreHorizontal,
  FolderOpen,
  FileSpreadsheet,
  Download,
  Loader2,
  PlusCircle,
  FileDown,
  LayoutGrid,
  List,
  Calendar,
  User,
  Package,
  GripVertical,
} from 'lucide-react'
import { EmptyState } from '@/components/app/empty-state'
import { exportToCSV } from '@/lib/export-csv'
import { pluralize } from '@/lib/utils'

// --- Types ---

interface Project {
  id: string
  name: string
  description: string
  status: string
  fileName: string
  customerName: string
  createdAt: string
  updatedAt: string
  _count?: { items: number }
  items?: { id: string; price: number; quantity: number; status: string }[]
}

// --- Status helpers ---

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string; dotColor: string }> = {
  new: { label: 'Новый', variant: 'secondary', className: 'rounded-full px-2.5', dotColor: 'bg-slate-400' },
  processing: { label: 'В обработке', variant: 'default', className: 'rounded-full px-2.5', dotColor: 'bg-primary' },
  requested: { label: 'Запрошено', variant: 'outline', className: 'rounded-full px-2.5 border-primary/30 text-primary', dotColor: 'bg-violet-500' },
  invoiced: { label: 'Счёт выставлен', variant: 'outline', className: 'rounded-full px-2.5 border-amber-500 text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30', dotColor: 'bg-amber-500' },
  paid: { label: 'Оплачено', variant: 'outline', className: 'rounded-full px-2.5 border-green-500 text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/30', dotColor: 'bg-emerald-500' },
  delivered: { label: 'Доставлено', variant: 'outline', className: 'rounded-full px-2.5 border-green-600 text-green-800 bg-green-50 dark:text-green-400 dark:bg-green-950/30', dotColor: 'bg-sky-500' },
  completed: { label: 'Завершено', variant: 'outline', className: 'rounded-full px-2.5 border-green-700 text-green-900 bg-green-100 dark:text-green-300 dark:bg-green-950/40', dotColor: 'bg-emerald-600' },
  cancelled: { label: 'Отменено', variant: 'destructive', className: 'rounded-full px-2.5', dotColor: 'bg-red-500' },
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_MAP[status] ?? { label: status, variant: 'secondary' as const, className: 'rounded-full px-2.5', dotColor: 'bg-slate-400' }
  return (
    <div className="flex items-center gap-1.5">
      <span className={`size-2 rounded-full shrink-0 ${config.dotColor}`} />
      <Badge variant={config.variant} className={`${config.className} transition-all duration-200 hover:shadow-sm`}>
        {config.label}
      </Badge>
    </div>
  )
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Все статусы' },
  { value: 'new', label: 'Новые' },
  { value: 'processing', label: 'В обработке' },
  { value: 'requested', label: 'Запрошено' },
  { value: 'invoiced', label: 'Выставлены счета' },
  { value: 'paid', label: 'Оплачено' },
  { value: 'delivered', label: 'Доставлено' },
  { value: 'completed', label: 'Завершено' },
  { value: 'cancelled', label: 'Отменено' },
]

// --- Kanban Column Config ---

const KANBAN_COLUMNS: { status: string; label: string; color: string; border: string; bg: string; badgeBg: string; badgeText: string; dotColor: string; cardBg: string; nameColor: string }[] = [
  { status: 'new', label: 'Новый', color: 'slate', border: 'border-l-slate-400', bg: 'bg-slate-50 dark:bg-slate-950/30', badgeBg: 'bg-slate-100 dark:bg-slate-800', badgeText: 'text-slate-700 dark:text-slate-300', dotColor: 'bg-slate-400', cardBg: 'bg-slate-50/50 dark:bg-slate-950/20', nameColor: 'text-slate-700 dark:text-slate-300' },
  { status: 'processing', label: 'В обработке', color: 'primary', border: 'border-l-primary', bg: 'bg-primary/5 dark:bg-primary/10', badgeBg: 'bg-primary/10 dark:bg-primary/20', badgeText: 'text-primary', dotColor: 'bg-primary', cardBg: 'bg-primary/[0.03] dark:bg-primary/[0.06]', nameColor: 'text-primary' },
  { status: 'requested', label: 'Запрошено', color: 'violet', border: 'border-l-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/30', badgeBg: 'bg-violet-100 dark:bg-violet-800', badgeText: 'text-violet-700 dark:text-violet-300', dotColor: 'bg-violet-400', cardBg: 'bg-violet-50/50 dark:bg-violet-950/20', nameColor: 'text-violet-700 dark:text-violet-300' },
  { status: 'invoiced', label: 'Счёт выставлен', color: 'amber', border: 'border-l-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30', badgeBg: 'bg-amber-100 dark:bg-amber-800', badgeText: 'text-amber-700 dark:text-amber-300', dotColor: 'bg-amber-400', cardBg: 'bg-amber-50/50 dark:bg-amber-950/20', nameColor: 'text-amber-700 dark:text-amber-300' },
  { status: 'paid', label: 'Оплачено', color: 'emerald', border: 'border-l-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', badgeBg: 'bg-emerald-100 dark:bg-emerald-800', badgeText: 'text-emerald-700 dark:text-emerald-300', dotColor: 'bg-emerald-400', cardBg: 'bg-emerald-50/50 dark:bg-emerald-950/20', nameColor: 'text-emerald-700 dark:text-emerald-300' },
  { status: 'delivered', label: 'Доставлено', color: 'sky', border: 'border-l-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/30', badgeBg: 'bg-sky-100 dark:bg-sky-800', badgeText: 'text-sky-700 dark:text-sky-300', dotColor: 'bg-sky-400', cardBg: 'bg-sky-50/50 dark:bg-sky-950/20', nameColor: 'text-sky-700 dark:text-sky-300' },
  { status: 'completed', label: 'Завершён', color: 'green', border: 'border-l-green-600', bg: 'bg-green-50 dark:bg-green-950/40', badgeBg: 'bg-green-100 dark:bg-green-900', badgeText: 'text-green-800 dark:text-green-300', dotColor: 'bg-green-600', cardBg: 'bg-green-50/50 dark:bg-green-950/20', nameColor: 'text-green-800 dark:text-green-300' },
  { status: 'cancelled', label: 'Отменён', color: 'red', border: 'border-l-red-400', bg: 'bg-red-50 dark:bg-red-950/30', badgeBg: 'bg-red-100 dark:bg-red-800', badgeText: 'text-red-700 dark:text-red-300', dotColor: 'bg-red-400', cardBg: 'bg-red-50/50 dark:bg-red-950/20', nameColor: 'text-red-700 dark:text-red-300' },
]

// --- Kanban Board Component ---

function KanbanBoard({
  projects,
  navigateToProject,
  deleteMutation,
  formatDate,
}: {
  projects: Project[]
  navigateToProject: (id: string) => void
  deleteMutation: { mutate: (id: string) => void; isPending: boolean }
  formatDate: (d: string) => string
}) {
  const projectsByStatus = useMemo(() => {
    const map = new Map<string, Project[]>()
    KANBAN_COLUMNS.forEach((col) => map.set(col.status, []))
    projects.forEach((p) => {
      const list = map.get(p.status)
      if (list) {
        list.push(p)
      } else {
        // Unknown status → put in "new" column
        const newList = map.get('new')
        if (newList) newList.push(p)
      }
    })
    return map
  }, [projects])

  return (
    <div className="overflow-x-auto pb-4 -mx-2">
      <div className="flex gap-4 min-w-max px-2">
        {KANBAN_COLUMNS.map((col) => {
          const columnProjects = projectsByStatus.get(col.status) ?? []
          return (
            <div key={col.status} className="flex flex-col min-w-[260px] max-w-[300px] shrink-0">
              {/* Column Header */}
              <div className={`flex items-center justify-between rounded-t-xl px-3 py-2.5 ${col.bg} border border-b-0`}>
                <div className="flex items-center gap-2">
                  <div className={`size-2.5 rounded-full ${col.dotColor}`} />
                  <span className="text-sm font-semibold">{col.label}</span>
                </div>
                <span className={`inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold ${col.badgeBg} ${col.badgeText}`}>
                  {columnProjects.length}
                </span>
              </div>

              {/* Column Body — scrollable */}
              <div className="flex-1 rounded-b-xl border border-t-0 p-2 flex flex-col gap-3 min-h-[120px] max-h-[calc(100vh-200px)] overflow-y-auto bg-muted/20 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {columnProjects.length === 0 ? (
                    <div className="flex items-center justify-center h-24 rounded-xl border-2 border-dashed border-muted-foreground/20">
                      <span className="text-xs text-muted-foreground">Нет проектов</span>
                    </div>
                  ) : (
                    columnProjects.map((project, idx) => {
                      const budget = (project.items ?? []).reduce((sum, item) => sum + item.price * item.quantity, 0)
                      const itemCount = project._count?.items ?? 0
                      return (
                        <motion.div
                          key={project.id}
                          initial={{ opacity: 0, y: 10, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                          transition={{ delay: idx * 0.04, duration: 0.25 }}
                          className={`group rounded-xl border p-4 cursor-pointer shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 border-l-[3px] ${col.border} ${col.cardBg} relative`}
                          onClick={() => navigateToProject(project.id)}
                        >
                          {/* Drag indicator */}
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                          </div>

                          {/* Project Name */}
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <h4 className={`font-semibold text-sm leading-tight line-clamp-2 ${col.nameColor}`}>
                              {project.name}
                            </h4>
                            <AlertDialog>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigateToProject(project.id) }}>
                                    <FolderOpen className="h-4 w-4" />
                                    Открыть
                                  </DropdownMenuItem>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => e.stopPropagation()}>
                                      <Trash2 className="h-4 w-4" />
                                      Удалить
                                    </DropdownMenuItem>
                                  </AlertDialogTrigger>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Удалить проект?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Проект &laquo;{project.name}&raquo; будет удалён без возможности восстановления.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-white hover:bg-destructive/90"
                                    onClick={() => deleteMutation.mutate(project.id)}
                                    disabled={deleteMutation.isPending}
                                  >
                                    {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Удалить'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>

                          {/* Customer */}
                          {project.customerName && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                              <User className="h-3 w-3" />
                              <span className="truncate">{project.customerName}</span>
                            </div>
                          )}

                          {/* Stats Row */}
                          <div className="flex items-center gap-2 text-xs">
                            {itemCount > 0 && (
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${col.badgeBg} ${col.badgeText}`}>
                                <Package className="h-3 w-3" />
                                {itemCount} {pluralize(itemCount, 'поз.', 'поз.', 'поз.')}
                              </span>
                            )}
                            {budget > 0 && (
                              <span className="font-mono font-medium text-foreground/80">
                                {new Intl.NumberFormat('ru-RU').format(budget)} ₽
                              </span>
                            )}
                          </div>

                          {/* Date */}
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 mt-2 pt-2 border-t">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(project.createdAt)}</span>
                          </div>
                        </motion.div>
                      )
                    })
                  )}
                </AnimatePresence>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// --- Main Component ---

export function Projects() {
  const { navigateToProject } = useAppStore()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table')
  const [createOpen, setCreateOpen] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)

  // Create form state
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCustomer, setNewCustomer] = useState('')

  // Upload form state
  const [uploadProjectName, setUploadProjectName] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // --- Queries ---

  const {
    data: projects = [],
    isLoading,
    isError,
  } = useQuery<Project[]>({
    queryKey: ['projects', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/projects?${params.toString()}`)
      if (!res.ok) throw new Error('Не удалось загрузить проекты')
      return res.json()
    },
  })

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; customerName: string }) => {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка создания проекта')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setCreateOpen(false)
      resetCreateForm()
      toast({ title: 'Проект создан' })
    },
    onError: (err: Error) => {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' })
    },
  })

  const uploadMutation = useMutation({
    mutationFn: async (data: { projectName: string; file: File }) => {
      const formData = new FormData()
      formData.append('file', data.file)
      formData.append('projectName', data.projectName)
      const res = await fetch('/api/projects/upload', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка загрузки файла')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setUploadOpen(false)
      resetUploadForm()
      toast({ title: 'Проект загружен из Excel' })
    },
    onError: (err: Error) => {
      toast({ title: 'Ошибка загрузки', description: err.message, variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка удаления')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast({ title: 'Проект удалён' })
    },
    onError: (err: Error) => {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' })
    },
  })

  // --- Form helpers ---

  function resetCreateForm() {
    setNewName('')
    setNewDescription('')
    setNewCustomer('')
  }

  function resetUploadForm() {
    setUploadProjectName('')
    setUploadFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    createMutation.mutate({
      name: newName.trim(),
      description: newDescription.trim(),
      customerName: newCustomer.trim(),
    })
  }

  function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadProjectName.trim() || !uploadFile) return
    uploadMutation.mutate({
      projectName: uploadProjectName.trim(),
      file: uploadFile,
    })
  }

  function formatDate(dateStr: string) {
    try {
      return new Date(dateStr).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  // --- Loading Skeleton ---

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-36" />
          </div>
        </div>
        <Skeleton className="h-10 w-64" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  // --- Error State ---

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <p className="text-destructive text-lg font-medium">Не удалось загрузить проекты</p>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['projects'] })}
        >
          Попробовать снова
        </Button>
      </div>
    )
  }

  // --- Render ---

  return (
    <div className="space-y-4">
      {/* Gradient Header */}
      <div className="relative -mx-6 -mt-6 px-6 pt-6 pb-5 bg-gradient-to-b from-primary/5 via-primary/[0.02] to-transparent">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-muted-foreground text-sm">
              Управление проектами закупок
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const csvData = projects.map((p) => ({
                  Название: p.name,
                  Описание: p.description,
                  Статус: STATUS_MAP[p.status]?.label ?? p.status,
                  Заказчик: p.customerName || '',
                  Позиций: p._count?.items ?? 0,
                  Бюджет: (p.items ?? []).reduce((sum, item) => sum + item.price * item.quantity, 0),
                  'Дата создания': formatDate(p.createdAt),
                }))
                exportToCSV(csvData, 'projects.csv', [
                  { key: 'Название', header: 'Название' },
                  { key: 'Описание', header: 'Описание' },
                  { key: 'Статус', header: 'Статус' },
                  { key: 'Заказчик', header: 'Заказчик' },
                  { key: 'Позиций', header: 'Позиций' },
                  { key: 'Бюджет', header: 'Бюджет' },
                  { key: 'Дата создания', header: 'Дата создания' },
                ])
              }}
              className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30"
            >
              <FileDown className="h-4 w-4" />
              CSV
            </Button>
            {/* Create Project Dialog */}
            <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm() }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:scale-[1.02] hover:brightness-110">
                  <Plus className="h-4 w-4" />
                  Новый проект
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleCreateSubmit}>
                  <DialogHeader>
                    <DialogTitle>Новый проект</DialogTitle>
                    <DialogDescription>
                      Создайте пустой проект для управления закупками
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="project-name">Название *</Label>
                      <Input
                        id="project-name"
                        placeholder="Название проекта"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="project-customer">Заказчик</Label>
                      <Input
                        id="project-customer"
                        placeholder="Имя заказчика"
                        value={newCustomer}
                        onChange={(e) => setNewCustomer(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="project-desc">Описание</Label>
                      <Textarea
                        id="project-desc"
                        placeholder="Описание проекта"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => { setCreateOpen(false); resetCreateForm() }}>
                      Отмена
                    </Button>
                    <Button type="submit" disabled={!newName.trim() || createMutation.isPending}>
                      {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Создать
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            {/* Upload Excel Dialog */}
            <Dialog open={uploadOpen} onOpenChange={(open) => { setUploadOpen(open); if (!open) resetUploadForm() }}>
              <DialogTrigger asChild>
                <Button variant="outline" className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30">
                  <FileSpreadsheet className="h-4 w-4" />
                  Загрузить Excel
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleUploadSubmit}>
                  <DialogHeader>
                    <DialogTitle>Загрузить Excel</DialogTitle>
                    <DialogDescription>
                      Загрузите файл Excel с позициями для нового проекта
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="upload-name">Название проекта *</Label>
                      <Input
                        id="upload-name"
                        placeholder="Название проекта"
                        value={uploadProjectName}
                        onChange={(e) => setUploadProjectName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="upload-file">Файл Excel *</Label>
                      <Input
                        id="upload-file"
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                        required
                      />
                      {uploadFile && (
                        <p className="text-muted-foreground text-xs">
                          Выбран: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} КБ)
                        </p>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => { setUploadOpen(false); resetUploadForm() }}>
                      Отмена
                    </Button>
                    <Button
                      type="submit"
                      disabled={!uploadProjectName.trim() || !uploadFile || uploadMutation.isPending}
                    >
                      {uploadMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Загрузка...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          Загрузить
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Project Count Summary Bar */}
      <div className="flex items-center gap-3 rounded-lg bg-muted/30 px-4 py-2 text-sm">
        <span className="font-medium">{projects.length}</span>
        <span className="text-muted-foreground">{pluralize(projects.length, 'проект', 'проекта', 'проектов')}</span>
        <span className="text-muted-foreground/40">•</span>
        {Object.entries(
          projects.reduce((acc, p) => { acc[p.status] = (acc[p.status] || 0) + 1; return acc }, {} as Record<string, number>)
        ).slice(0, 4).map(([status, count]) => (
          <span key={status} className="flex items-center gap-1 text-muted-foreground">
            <span className="text-foreground font-medium">{count}</span>
            {STATUS_MAP[status]?.label ?? status}
          </span>
        ))}
      </div>

      {/* Status Filter + View Toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Фильтр по статусу" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground text-sm">
          {projects.length} {pluralize(projects.length, 'проект', 'проекта', 'проектов')}
        </span>
        <div className="ml-auto flex items-center rounded-lg border bg-muted/50 p-0.5">
          <Button
            type="button"
            variant={viewMode === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2.5 text-xs gap-1.5"
            onClick={() => setViewMode('table')}
          >
            <List className="h-3.5 w-3.5" />
            Таблица
          </Button>
          <Button
            type="button"
            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 px-2.5 text-xs gap-1.5"
            onClick={() => setViewMode('kanban')}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Канбан
          </Button>
        </div>
      </div>

      {/* Projects Table / Kanban */}
      {projects.length === 0 ? (
        <EmptyState
          type="projects"
          action={{
            label: 'Новый проект',
            onClick: () => setCreateOpen(true),
            icon: PlusCircle,
          }}
        />
      ) : viewMode === 'kanban' ? (
        <KanbanBoard
          projects={projects}
          navigateToProject={navigateToProject}
          deleteMutation={deleteMutation}
          formatDate={formatDate}
        />
      ) : (
        <div className="rounded-xl border overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Название</TableHead>
                <TableHead className="hidden sm:table-cell">Заказчик</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-center hidden sm:table-cell">Позиций</TableHead>
                <TableHead className="text-right hidden md:table-cell">Бюджет</TableHead>
                <TableHead className="text-center hidden lg:table-cell">Прогресс</TableHead>
                <TableHead className="hidden md:table-cell">Дата создания</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence>
                {projects.map((project, idx) => (
                  <motion.tr
                    key={project.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03, duration: 0.3 }}
                    className={`cursor-pointer group relative transition-all duration-200 hover:bg-primary/[0.04] hover:shadow-sm border-l-2 border-l-transparent hover:border-l-primary/40 ${idx % 2 === 1 ? 'bg-muted/[0.02]' : ''}`}
                    onClick={() => navigateToProject(project.id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="group-hover:text-primary transition-colors duration-200">{project.name}</span>
                        {project.description && (
                          <span className="text-muted-foreground text-xs truncate max-w-64">
                            {project.description}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {project.customerName || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={project.status} />
                    </TableCell>
                    <TableCell className="text-center hidden sm:table-cell">
                      <span className="inline-flex items-center justify-center size-6 rounded-full bg-muted text-xs font-medium">
                        {project._count?.items ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono hidden md:table-cell">
                      {(() => {
                        const budget = (project.items ?? []).reduce((sum, item) => sum + item.price * item.quantity, 0)
                        return budget > 0
                          ? new Intl.NumberFormat('ru-RU').format(budget) + ' ₽'
                          : '—'
                      })()}
                    </TableCell>
                    <TableCell className="text-center hidden lg:table-cell">
                      {(() => {
                        const totalItems = project.items?.length ?? 0
                        if (totalItems === 0) return <span className="text-muted-foreground text-xs">—</span>
                        const processedItems = (project.items ?? []).filter(
                          (item) => ['requested', 'invoiced', 'partial', 'available', 'delivered', 'completed'].includes(item.status)
                        ).length
                        const pct = Math.round((processedItems / totalItems) * 100)
                        return (
                          <div className="flex items-center gap-2 justify-center">
                            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-primary' : 'bg-amber-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`text-[11px] font-mono tabular-nums ${pct >= 100 ? 'text-emerald-600' : pct > 50 ? 'text-primary' : 'text-amber-600'}`}>
                              {pct}%
                            </span>
                          </div>
                        )
                      })()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm hidden md:table-cell">{formatDate(project.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                navigateToProject(project.id)
                              }}
                            >
                              <FolderOpen className="h-4 w-4" />
                              Открыть
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                window.open(`/api/projects/${project.id}/export`, '_blank')
                              }}
                            >
                              <Download className="h-4 w-4" />
                              Экспорт в Excel
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="h-4 w-4" />
                                Удалить
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Удалить проект?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Проект &laquo;{project.name}&raquo; будет удалён без возможности восстановления. Все связанные позиции, запросы и счета также будут удалены.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-white hover:bg-destructive/90"
                              onClick={() => deleteMutation.mutate(project.id)}
                              disabled={deleteMutation.isPending}
                            >
                              {deleteMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Удалить'
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
