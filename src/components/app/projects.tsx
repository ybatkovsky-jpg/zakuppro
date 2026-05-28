'use client'

import { useState, useRef } from 'react'
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
} from 'lucide-react'

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

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }> = {
  new: { label: 'Новый', variant: 'secondary', className: 'rounded-full px-2.5' },
  processing: { label: 'В обработке', variant: 'default', className: 'rounded-full px-2.5' },
  requested: { label: 'Запрошено', variant: 'outline', className: 'rounded-full px-2.5 border-primary/30 text-primary' },
  invoiced: { label: 'Счета', variant: 'outline', className: 'rounded-full px-2.5 border-amber-500 text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30' },
  paid: { label: 'Оплачено', variant: 'outline', className: 'rounded-full px-2.5 border-green-500 text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/30' },
  delivered: { label: 'Доставлено', variant: 'outline', className: 'rounded-full px-2.5 border-green-600 text-green-800 bg-green-50 dark:text-green-400 dark:bg-green-950/30' },
  completed: { label: 'Завершено', variant: 'outline', className: 'rounded-full px-2.5 border-green-700 text-green-900 bg-green-100 dark:text-green-300 dark:bg-green-950/40' },
  cancelled: { label: 'Отменено', variant: 'destructive', className: 'rounded-full px-2.5' },
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_MAP[status] ?? { label: status, variant: 'secondary' as const, className: 'rounded-full px-2.5' }
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
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

// --- Main Component ---

export function Projects() {
  const { navigateToProject } = useAppStore()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [statusFilter, setStatusFilter] = useState('all')
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
            {/* Create Project Dialog */}
            <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm() }}>
              <DialogTrigger asChild>
                <Button className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.02]">
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

      {/* Status Filter */}
      <div className="flex items-center gap-2">
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
          {projects.length} {projects.length === 1 ? 'проект' : 'проектов'}
        </span>
      </div>

      {/* Projects Table */}
      {projects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed p-12 text-center"
        >
          <div className="rounded-full bg-muted p-4">
            <FolderOpen className="text-muted-foreground h-10 w-10" />
          </div>
          <div>
            <p className="text-lg font-medium">Нет проектов</p>
            <p className="text-muted-foreground text-sm">
              Создайте новый проект или загрузите позиции из Excel
            </p>
          </div>
        </motion.div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Название</TableHead>
                <TableHead>Заказчик</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-center">Позиций</TableHead>
                <TableHead className="text-right">Бюджет</TableHead>
                <TableHead className="text-center">Прогресс</TableHead>
                <TableHead>Дата создания</TableHead>
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
                    className="cursor-pointer group relative transition-colors duration-150 hover:bg-primary/[0.03] border-l-2 border-l-transparent hover:border-l-primary/40"
                    onClick={() => navigateToProject(project.id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="group-hover:text-primary transition-colors duration-150">{project.name}</span>
                        {project.description && (
                          <span className="text-muted-foreground text-xs truncate max-w-64">
                            {project.description}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {project.customerName || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={project.status} />
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center size-6 rounded-full bg-muted text-xs font-medium">
                        {project._count?.items ?? 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {(() => {
                        const budget = (project.items ?? []).reduce((sum, item) => sum + item.price * item.quantity, 0)
                        return budget > 0
                          ? new Intl.NumberFormat('ru-RU').format(budget) + ' ₽'
                          : '—'
                      })()}
                    </TableCell>
                    <TableCell className="text-center">
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
                    <TableCell className="text-muted-foreground text-sm">{formatDate(project.createdAt)}</TableCell>
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
