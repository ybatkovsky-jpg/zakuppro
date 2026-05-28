'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Building2,
  Mail,
  Phone,
  User,
  MapPin,
  StickyNote,
  Package,
  PlusCircle,
  Star,
  ShoppingCart,
  TrendingUp,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { EmptyState } from '@/components/app/empty-state'
import { useAppStore } from '@/store/app-store'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { calculateSupplierRating, RELIABILITY_CONFIG } from '@/lib/supplier-rating'

// === Types ===
interface Supplier {
  id: string
  name: string
  email: string
  phone: string
  contactPerson: string
  address: string
  notes: string
  createdAt: string
  updatedAt: string
  _count?: {
    projectItems: number
  }
}

interface SupplierAnalytics {
  id: string
  name: string
  totalItems: number
  totalSpent: number
  avgDeliveryDays: number
  completionRate: number
}

interface SupplierFormData {
  name: string
  email: string
  phone: string
  contactPerson: string
  address: string
  notes: string
}

const emptyForm: SupplierFormData = {
  name: '',
  email: '',
  phone: '',
  contactPerson: '',
  address: '',
  notes: '',
}

// === API Functions ===
async function fetchSuppliers(search: string): Promise<Supplier[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  const res = await fetch(`/api/suppliers?${params.toString()}`)
  if (!res.ok) throw new Error('Ошибка загрузки поставщиков')
  return res.json()
}

async function createSupplier(data: SupplierFormData): Promise<Supplier> {
  const res = await fetch('/api/suppliers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Ошибка создания поставщика')
  }
  return res.json()
}

async function updateSupplier({ id, data }: { id: string; data: Partial<SupplierFormData> }): Promise<Supplier> {
  const res = await fetch(`/api/suppliers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Ошибка обновления поставщика')
  }
  return res.json()
}

async function deleteSupplier(id: string): Promise<void> {
  const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Ошибка удаления поставщика')
  }
}

// === Sub-components ===

function SupplierFormFields({
  form,
  onChange,
}: {
  form: SupplierFormData
  onChange: (field: keyof SupplierFormData, value: string) => void
}) {
  return (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label htmlFor="name">
          Название <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          placeholder="Название компании"
          value={form.name}
          onChange={(e) => onChange('name', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="email@example.com"
            value={form.email}
            onChange={(e) => onChange('email', e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Телефон</Label>
          <Input
            id="phone"
            placeholder="+7 (___) ___-__-__"
            value={form.phone}
            onChange={(e) => onChange('phone', e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contactPerson">Контактное лицо</Label>
        <Input
          id="contactPerson"
          placeholder="ФИО контактного лица"
          value={form.contactPerson}
          onChange={(e) => onChange('contactPerson', e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="address">Адрес</Label>
        <Input
          id="address"
          placeholder="Юридический/фактический адрес"
          value={form.address}
          onChange={(e) => onChange('address', e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="notes">Примечания</Label>
        <Textarea
          id="notes"
          placeholder="Дополнительная информация"
          value={form.notes}
          onChange={(e) => onChange('notes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  )
}

function SupplierCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </CardContent>
    </Card>
  )
}

function SupplierCard({
  supplier,
  analytics,
  onEdit,
  onDelete,
  onClick,
}: {
  supplier: Supplier
  analytics: SupplierAnalytics | null
  onEdit: (supplier: Supplier) => void
  onDelete: (supplier: Supplier) => void
  onClick: () => void
}) {
  const projectCount = supplier._count?.projectItems ?? 0

  // Calculate rating from analytics
  const rating = analytics
    ? calculateSupplierRating({
        totalItems: analytics.totalItems,
        totalSpent: analytics.totalSpent,
        avgDeliveryDays: analytics.avgDeliveryDays,
        completionRate: analytics.completionRate,
        requestCount: 0,
      })
    : null

  // Activity dot color based on reliability
  const dotColor = rating
    ? RELIABILITY_CONFIG[rating.reliability].dotColor
    : projectCount > 0
      ? 'bg-amber-400'
      : 'bg-muted-foreground/30'

  // Status bar color at top
  const statusBarColor = rating
    ? rating.reliability === 'excellent'
      ? 'bg-emerald-500'
      : rating.reliability === 'good'
        ? 'bg-amber-500'
        : 'bg-red-500'
    : projectCount > 0
      ? 'bg-sky-500'
      : 'bg-muted-foreground/30'

  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-1 cursor-pointer card-hover-elevate" onClick={onClick}>
      {/* Status indicator bar at top */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${statusBarColor}`} />

      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-sky-50/30 via-transparent to-sky-100/10 dark:from-sky-950/20 dark:via-transparent dark:to-sky-950/10 pointer-events-none" />

      <CardHeader className="pb-3 relative">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/15 to-primary/10 text-sky-600 dark:text-sky-400">
              <Building2 className="h-6 w-6" />
              <span className={`absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background ${dotColor}`} />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base truncate" title={supplier.name}>
                {supplier.name}
              </CardTitle>
              {supplier.contactPerson && (
                <CardDescription className="truncate">
                  {supplier.contactPerson}
                </CardDescription>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0 translate-x-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(supplier)
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Редактировать</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(supplier)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Удалить</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 relative">
        {supplier.email && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate" title={supplier.email}>{supplier.email}</span>
          </div>
        )}
        {supplier.phone && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{supplier.phone}</span>
          </div>
        )}
        {supplier.address && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate" title={supplier.address}>{supplier.address}</span>
          </div>
        )}
        {supplier.notes && (
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <StickyNote className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{supplier.notes}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-2 border-t border-dashed">
          <Badge variant="secondary" className="gap-1 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400 border-sky-200 dark:border-sky-800">
            <Package className="h-3 w-3" />
            {projectCount} {pluralize(projectCount, 'позиция', 'позиции', 'позиций')}
          </Badge>
          {rating ? (
            <div className="flex items-center gap-1">
              {[1, 2, 3].map((star) => (
                <Star
                  key={star}
                  className={`h-4 w-4 transition-all duration-200 ${
                    star <= rating.stars
                      ? 'fill-amber-400 text-amber-400 group-hover:scale-110'
                      : 'text-muted-foreground/20 group-hover:text-muted-foreground/40'
                  }`}
                />
              ))}
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 ml-0.5">{rating.score}</span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

// === Utility ===
function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last > 1 && last < 5) return few
  if (last === 1) return one
  return many
}

// === Main Component ===
export function Suppliers() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { navigateToSupplier } = useAppStore()

  // State
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierFormData>(emptyForm)
  const [formError, setFormError] = useState('')

  // Queries
  const {
    data: suppliers = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['suppliers', search],
    queryFn: () => fetchSuppliers(search),
  })

  // Analytics query for performance indicators
  const { data: analyticsData = [] } = useQuery<SupplierAnalytics[]>({
    queryKey: ['analytics-suppliers'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/suppliers')
      if (!res.ok) throw new Error('Ошибка загрузки аналитики')
      return res.json()
    },
  })

  // Map analytics by supplier id for quick lookup
  const analyticsMap = useMemo(() => {
    const map = new Map<string, SupplierAnalytics>()
    for (const a of analyticsData) {
      map.set(a.id, a)
    }
    return map
  }, [analyticsData])

  // Mutations
  const createMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast({ title: 'Поставщик создан', description: 'Новый поставщик успешно добавлен' })
      closeAddDialog()
    },
    onError: (error: Error) => {
      setFormError(error.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: updateSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast({ title: 'Поставщик обновлён', description: 'Данные поставщика сохранены' })
      closeEditDialog()
    },
    onError: (error: Error) => {
      setFormError(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast({ title: 'Поставщик удалён', description: 'Поставщик успешно удалён' })
      setDeleteOpen(false)
      setSelectedSupplier(null)
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' })
    },
  })

  // Handlers
  const handleFormChange = useCallback((field: keyof SupplierFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFormError('')
  }, [])

  const openAddDialog = useCallback(() => {
    setForm(emptyForm)
    setFormError('')
    setAddOpen(true)
  }, [])

  const closeAddDialog = useCallback(() => {
    setAddOpen(false)
    setForm(emptyForm)
    setFormError('')
  }, [])

  const openEditDialog = useCallback((supplier: Supplier) => {
    setForm({
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      contactPerson: supplier.contactPerson,
      address: supplier.address,
      notes: supplier.notes,
    })
    setFormError('')
    setSelectedSupplier(supplier)
    setEditOpen(true)
  }, [])

  const closeEditDialog = useCallback(() => {
    setEditOpen(false)
    setSelectedSupplier(null)
    setForm(emptyForm)
    setFormError('')
  }, [])

  const openDeleteDialog = useCallback((supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setDeleteOpen(true)
  }, [])

  const handleAddSubmit = useCallback(() => {
    if (!form.name.trim()) {
      setFormError('Название поставщика обязательно')
      return
    }
    createMutation.mutate(form)
  }, [form, createMutation])

  const handleEditSubmit = useCallback(() => {
    if (!selectedSupplier) return
    if (!form.name.trim()) {
      setFormError('Название поставщика обязательно')
      return
    }
    updateMutation.mutate({ id: selectedSupplier.id, data: form })
  }, [form, selectedSupplier, updateMutation])

  const handleDeleteConfirm = useCallback(() => {
    if (!selectedSupplier) return
    deleteMutation.mutate(selectedSupplier.id)
  }, [selectedSupplier, deleteMutation])

  // ── Supplier Stats ──────────────────────────────────────────

  const supplierStats = useMemo(() => {
    const total = suppliers.length
    const activeOrders = suppliers.filter((s) => (s._count?.projectItems ?? 0) > 0).length
    const avgRating = analyticsData.length > 0
      ? analyticsData.reduce((sum, a) => {
          const r = calculateSupplierRating({
            totalItems: a.totalItems,
            totalSpent: a.totalSpent,
            avgDeliveryDays: a.avgDeliveryDays,
            completionRate: a.completionRate,
            requestCount: 0,
          })
          return sum + r.score
        }, 0) / analyticsData.length
      : 0
    const now = new Date()
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    const newThisMonth = suppliers.filter((s) => new Date(s.createdAt) >= oneMonthAgo).length
    return { total, activeOrders, avgRating: Math.round(avgRating * 10) / 10, newThisMonth }
  }, [suppliers, analyticsData])

  // Render
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative -mx-6 -mt-6 px-6 pt-6 pb-5 bg-gradient-to-b from-sky-500/5 via-sky-500/[0.02] to-transparent">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm">
              База поставщиков и контактов
            </p>
          </div>
          <Button onClick={openAddDialog} className="gap-2 shrink-0 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.02]">
            <Plus className="h-4 w-4" />
            Добавить поставщика
          </Button>
        </div>
      </div>

      {/* Supplier Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="relative overflow-hidden border-l-[3px] border-l-sky-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/10">
                  <Building2 className="h-4.5 w-4.5 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{supplierStats.total}</p>
                  <p className="text-xs text-muted-foreground">Всего поставщиков</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="relative overflow-hidden border-l-[3px] border-l-emerald-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
                  <ShoppingCart className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{supplierStats.activeOrders}</p>
                  <p className="text-xs text-muted-foreground">С активными заказами</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="relative overflow-hidden border-l-[3px] border-l-amber-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10">
                  <Star className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{supplierStats.avgRating || '—'}</p>
                  <p className="text-xs text-muted-foreground">Средний рейтинг</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="relative overflow-hidden border-l-[3px] border-l-violet-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/10">
                  <TrendingUp className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{supplierStats.newThisMonth}</p>
                  <p className="text-xs text-muted-foreground">Новых за месяц</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию, email, телефону..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 transition-shadow duration-200 focus:shadow-md focus:shadow-primary/5"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SupplierCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Ошибка загрузки</h3>
            <p className="text-muted-foreground mt-1">
              Не удалось загрузить список поставщиков. Попробуйте обновить страницу.
            </p>
          </CardContent>
        </Card>
      ) : suppliers.length === 0 ? (
        <EmptyState
          type={search ? 'search' : 'suppliers'}
          action={
            !search
              ? {
                  label: 'Добавить поставщика',
                  onClick: openAddDialog,
                  icon: PlusCircle,
                }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((supplier) => (
            <SupplierCard
              key={supplier.id}
              supplier={supplier}
              analytics={analyticsMap.get(supplier.id) ?? null}
              onEdit={openEditDialog}
              onDelete={openDeleteDialog}
              onClick={() => navigateToSupplier(supplier.id)}
            />
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) closeAddDialog() }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Добавить поставщика</DialogTitle>
            <DialogDescription>
              Заполните данные нового поставщика
            </DialogDescription>
          </DialogHeader>
          {formError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {formError}
            </div>
          )}
          <SupplierFormFields form={form} onChange={handleFormChange} />
          <DialogFooter>
            <Button variant="outline" onClick={closeAddDialog} disabled={createMutation.isPending}>
              Отмена
            </Button>
            <Button type="button" onClick={handleAddSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Создание...' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) closeEditDialog() }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактировать поставщика</DialogTitle>
            <DialogDescription>
              Измените данные поставщика
            </DialogDescription>
          </DialogHeader>
          {formError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {formError}
            </div>
          )}
          <SupplierFormFields form={form} onChange={handleFormChange} />
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog} disabled={updateMutation.isPending}>
              Отмена
            </Button>
            <Button type="button" onClick={handleEditSubmit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить поставщика?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить поставщика{' '}
              <strong>{selectedSupplier?.name}</strong>?
              {(selectedSupplier?._count?.projectItems ?? 0) > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  У этого поставщика есть привязанные позиции проектов. Сначала удалите их.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending || (selectedSupplier?._count?.projectItems ?? 0) > 0}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
