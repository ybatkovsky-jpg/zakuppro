'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/store/app-store'
import { useToast } from '@/hooks/use-toast'
import { authFetch } from '@/lib/auth-fetch'
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Mail,
  Phone,
  User,
  MapPin,
  Package,
  FolderKanban,
  FileText,
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Truck,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Star,
} from 'lucide-react'
import { motion } from 'framer-motion'

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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { calculateSupplierRating, RELIABILITY_CONFIG, DELIVERY_SPEED_CONFIG, type SupplierAnalyticsData } from '@/lib/supplier-rating'

// === Types ===
interface ProjectItemWithProject {
  id: string
  name: string
  article: string
  category: string
  quantity: number
  unit: string
  price: number
  status: string
  project: {
    id: string
    name: string
    status: string
  }
}

interface SupplierDetailData {
  id: string
  name: string
  email: string
  phone: string
  contactPerson: string
  address: string
  notes: string
  createdAt: string
  updatedAt: string
  projectItems: ProjectItemWithProject[]
  _count: {
    purchaseRequests: number
    invoices: number
  }
}

interface PurchaseRequest {
  id: string
  status: string
  emailTo: string
  emailSubject: string
  sentAt: string | null
  responseAt: string | null
  notes: string
  createdAt: string
  project: {
    id: string
    name: string
  }
  items: {
    id: string
    quantity: number
    price: number
    available: boolean
    availableQty: number
    deliveryDays: number
    projectItem: {
      id: string
      name: string
    }
  }[]
}

interface Invoice {
  id: string
  invoiceNumber: string
  totalAmount: number
  status: string
  receivedAt: string
  paidAt: string | null
  notes: string
  createdAt: string
  project: {
    id: string
    name: string
  }
  supplier: {
    id: string
    name: string
  }
  _count: {
    items: number
  }
}

interface SupplierFormData {
  name: string
  email: string
  phone: string
  contactPerson: string
  address: string
  notes: string
}

// === Status helpers ===
const ITEM_STATUS_MAP: Record<string, { label: string; className: string }> = {
  pending: { label: 'Ожидание', className: 'rounded-full px-2.5 bg-secondary text-secondary-foreground' },
  requested: { label: 'Запрошено', className: 'rounded-full px-2.5 border-primary/30 text-primary' },
  invoiced: { label: 'Счёт', className: 'rounded-full px-2.5 border-amber-500 text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30' },
  partial: { label: 'Частично', className: 'rounded-full px-2.5 border-orange-500 text-orange-700 bg-orange-50 dark:text-orange-400 dark:bg-orange-950/30' },
  available: { label: 'В наличии', className: 'rounded-full px-2.5 border-emerald-500 text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30' },
  delivered: { label: 'Доставлено', className: 'rounded-full px-2.5 border-green-600 text-green-800 bg-green-50 dark:text-green-400 dark:bg-green-950/30' },
  completed: { label: 'Завершено', className: 'rounded-full px-2.5 border-green-700 text-green-900 bg-green-100 dark:text-green-300 dark:bg-green-950/40' },
}

const REQUEST_STATUS_MAP: Record<string, { label: string; className: string }> = {
  draft: { label: 'Черновик', className: 'rounded-full px-2.5 bg-secondary text-secondary-foreground' },
  sent: { label: 'Отправлен', className: 'rounded-full px-2.5 border-primary/30 text-primary' },
  responded: { label: 'Ответ получен', className: 'rounded-full px-2.5 border-emerald-500 text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30' },
  partial: { label: 'Частично', className: 'rounded-full px-2.5 border-orange-500 text-orange-700 bg-orange-50 dark:text-orange-400 dark:bg-orange-950/30' },
  cancelled: { label: 'Отменён', className: 'rounded-full px-2.5 bg-destructive text-white' },
}

const INVOICE_STATUS_MAP: Record<string, { label: string; className: string }> = {
  received: { label: 'Получен', className: 'rounded-full px-2.5 bg-secondary text-secondary-foreground' },
  verified: { label: 'Проверен', className: 'rounded-full px-2.5 border-emerald-500 text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30' },
  discrepancy: { label: 'Расхождение', className: 'rounded-full px-2.5 border-amber-500 text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30' },
  approved: { label: 'Согласован', className: 'rounded-full px-2.5 border-green-600 text-green-800 bg-green-50 dark:text-green-400 dark:bg-green-950/30' },
  paid: { label: 'Оплачен', className: 'rounded-full px-2.5 border-green-700 text-green-900 bg-green-100 dark:text-green-300 dark:bg-green-950/40' },
  cancelled: { label: 'Отменён', className: 'rounded-full px-2.5 bg-destructive text-white' },
}

// === Utility ===
function formatDate(dateStr: string): string {
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n)
}

function StatusBadge({ status, map }: { status: string; map: Record<string, { label: string; className: string }> }) {
  const config = map[status] ?? { label: status, className: 'rounded-full px-2.5' }
  return (
    <Badge variant="outline" className={`text-[11px] font-medium ${config.className}`}>
      {config.label}
    </Badge>
  )
}

// === Animation variants ===
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

// === Circular Progress Ring ===
function SupplierProgressRing({
  percent,
  size = 100,
  strokeWidth = 8,
  colorClass = 'text-emerald-500',
}: {
  percent: number
  size?: number
  strokeWidth?: number
  colorClass?: string
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percent / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={`${colorClass} transition-all duration-1000 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold">{percent}%</span>
      </div>
    </div>
  )
}

// === Supplier Analytics Data Type ===
interface SupplierAnalytics {
  id: string
  name: string
  totalItems: number
  totalSpent: number
  avgDeliveryDays: number
  completionRate: number
}

// === Main Component ===
export function SupplierDetail() {
  const { selectedSupplierId, navigate } = useAppStore()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [form, setForm] = useState<SupplierFormData>({
    name: '',
    email: '',
    phone: '',
    contactPerson: '',
    address: '',
    notes: '',
  })
  const [formError, setFormError] = useState('')

  // Queries
  const {
    data: supplier,
    isLoading,
    isError,
  } = useQuery<SupplierDetailData>({
    queryKey: ['supplier-detail', selectedSupplierId],
    queryFn: async () => {
      if (!selectedSupplierId) throw new Error('No supplier ID')
      const res = await authFetch(`/api/suppliers/${selectedSupplierId}`)
      if (!res.ok) throw new Error('Ошибка загрузки данных поставщика')
      return res.json()
    },
    enabled: !!selectedSupplierId,
  })

  const {
    data: requests = [],
  } = useQuery<PurchaseRequest[]>({
    queryKey: ['supplier-requests', selectedSupplierId],
    queryFn: async () => {
      if (!selectedSupplierId) return []
      const res = await authFetch(`/api/requests?supplierId=${selectedSupplierId}`)
      if (!res.ok) throw new Error('Ошибка загрузки запросов')
      return res.json()
    },
    enabled: !!selectedSupplierId,
  })

  const {
    data: invoices = [],
  } = useQuery<Invoice[]>({
    queryKey: ['supplier-invoices', selectedSupplierId],
    queryFn: async () => {
      const res = await authFetch('/api/invoices')
      if (!res.ok) throw new Error('Ошибка загрузки счетов')
      const allInvoices: Invoice[] = await res.json()
      return allInvoices.filter((inv) => inv.supplier.id === selectedSupplierId)
    },
    enabled: !!selectedSupplierId,
  })

  // Analytics query for performance metrics
  const {
    data: analyticsData,
  } = useQuery<SupplierAnalytics[]>({
    queryKey: ['analytics-suppliers'],
    queryFn: async () => {
      const res = await authFetch('/api/analytics/suppliers')
      if (!res.ok) throw new Error('Ошибка загрузки аналитики')
      return res.json()
    },
  })

  // Find current supplier's analytics
  const supplierAnalytics = useMemo(
    () => analyticsData?.find((a) => a.id === selectedSupplierId) ?? null,
    [analyticsData, selectedSupplierId],
  )

  // Calculate rating from analytics
  const supplierRating = useMemo(() => {
    if (!supplierAnalytics) return null
    return calculateSupplierRating({
      totalItems: supplierAnalytics.totalItems,
      totalSpent: supplierAnalytics.totalSpent,
      avgDeliveryDays: supplierAnalytics.avgDeliveryDays,
      completionRate: supplierAnalytics.completionRate,
      requestCount: requests.length,
    })
  }, [supplierAnalytics, requests.length])

  // Determine trend based on recent activity
  const trendIndicator = useMemo(() => {
    if (!requests.length && !invoices.length) return null
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
    const recentRequests = requests.filter((r) => new Date(r.createdAt).getTime() > thirtyDaysAgo).length
    const recentInvoices = invoices.filter((i) => new Date(i.createdAt).getTime() > thirtyDaysAgo).length
    const recentActivity = recentRequests + recentInvoices
    if (recentActivity >= 3) return 'up' as const
    if (recentActivity >= 1) return 'stable' as const
    return 'down' as const
  }, [requests, invoices])

  // Mutations
  const updateMutation = useMutation({
    mutationFn: async (data: SupplierFormData) => {
      if (!selectedSupplierId) throw new Error('No supplier ID')
      const res = await authFetch(`/api/suppliers/${selectedSupplierId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка обновления поставщика')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-detail', selectedSupplierId] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast({ title: 'Поставщик обновлён', description: 'Данные поставщика сохранены' })
      closeEditDialog()
    },
    onError: (error: Error) => {
      setFormError(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSupplierId) throw new Error('No supplier ID')
      const res = await authFetch(`/api/suppliers/${selectedSupplierId}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка удаления поставщика')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast({ title: 'Поставщик удалён', description: 'Поставщик успешно удалён' })
      navigate('suppliers')
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

  const openEditDialog = useCallback(() => {
    if (!supplier) return
    setForm({
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      contactPerson: supplier.contactPerson,
      address: supplier.address,
      notes: supplier.notes,
    })
    setFormError('')
    setEditOpen(true)
  }, [supplier])

  const closeEditDialog = useCallback(() => {
    setEditOpen(false)
    setFormError('')
  }, [])

  const handleEditSubmit = useCallback(() => {
    if (!form.name.trim()) {
      setFormError('Название поставщика обязательно')
      return
    }
    updateMutation.mutate(form)
  }, [form, updateMutation])

  // Computed stats
  const totalItems = supplier?.projectItems.length ?? 0
  const activeProjectsCount = supplier?.projectItems.filter(
    (item) => !['completed', 'cancelled'].includes(item.project.status)
  ).length ?? 0
  const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0)

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (isError || !supplier) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">Не удалось загрузить данные поставщика</p>
        <Button variant="outline" onClick={() => navigate('suppliers')}>
          <ArrowLeft className="h-4 w-4" />
          Вернуться к списку
        </Button>
      </div>
    )
  }

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="relative -mx-6 -mt-6 px-6 pt-4 pb-5 bg-gradient-to-b from-sky-500/5 via-sky-500/[0.02] to-transparent border-b">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 hover:bg-sky-100 dark:hover:bg-sky-900/30"
              onClick={() => navigate('suppliers')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate" title={supplier.name}>
                {supplier.name}
              </h1>
              {supplier.contactPerson && (
                <p className="text-sm text-muted-foreground truncate">
                  {supplier.contactPerson}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2 sm:ml-auto shrink-0">
            <Button variant="outline" size="sm" onClick={openEditDialog} className="gap-1.5">
              <Pencil className="h-3.5 w-3.5" />
              Редактировать
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)} className="gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/50 hover:bg-destructive/5">
              <Trash2 className="h-3.5 w-3.5" />
              Удалить
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Info Cards Row */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Contact Info Card */}
        <Card className="border-l-4 border-l-sky-400 dark:border-l-sky-600">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              Контактная информация
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {supplier.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <a href={`mailto:${supplier.email}`} className="text-sky-600 hover:underline truncate">{supplier.email}</a>
              </div>
            )}
            {supplier.phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{supplier.phone}</span>
              </div>
            )}
            {supplier.contactPerson && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{supplier.contactPerson}</span>
              </div>
            )}
            {supplier.address && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate" title={supplier.address}>{supplier.address}</span>
              </div>
            )}
            {!supplier.email && !supplier.phone && !supplier.contactPerson && !supplier.address && (
              <p className="text-sm text-muted-foreground italic">Нет контактных данных</p>
            )}
          </CardContent>
        </Card>

        {/* Statistics Card */}
        <Card className="border-l-4 border-l-emerald-400 dark:border-l-emerald-600">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Статистика
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Позиций поставлено
              </span>
              <span className="text-sm font-bold">{totalItems}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <FolderKanban className="h-3.5 w-3.5" />
                Активных проектов
              </span>
              <span className="text-sm font-bold">{activeProjectsCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Всего счетов
              </span>
              <span className="text-sm font-bold">{supplier._count.invoices}</span>
            </div>
            {totalInvoiceAmount > 0 && (
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">Общая сумма счетов</span>
                <span className="text-sm font-bold">{formatCurrency(totalInvoiceAmount)}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Performance Card */}
        <Card className="border-l-4 border-l-amber-400 dark:border-l-amber-600">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Показатели
              </CardTitle>
              {trendIndicator && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`flex items-center gap-0.5 text-xs font-medium ${
                    trendIndicator === 'up'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : trendIndicator === 'stable'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {trendIndicator === 'up' && <ArrowUpRight className="h-3.5 w-3.5" />}
                  {trendIndicator === 'stable' && <Minus className="h-3.5 w-3.5" />}
                  {trendIndicator === 'down' && <ArrowDownRight className="h-3.5 w-3.5" />}
                  {trendIndicator === 'up' ? 'Активен' : trendIndicator === 'stable' ? 'Стабильно' : 'Снижение'}
                </motion.div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {supplierAnalytics && supplierRating ? (
              <>
                {/* Reliability ring + badge */}
                <div className="flex items-center gap-3">
                  <SupplierProgressRing
                    percent={supplierAnalytics.completionRate}
                    size={64}
                    strokeWidth={5}
                    colorClass={RELIABILITY_CONFIG[supplierRating.reliability].ringColor}
                  />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">Надёжность</span>
                    <Badge variant="outline" className={`rounded-full text-xs w-fit ${RELIABILITY_CONFIG[supplierRating.reliability].className}`}>
                      {RELIABILITY_CONFIG[supplierRating.reliability].label}
                    </Badge>
                  </div>
                </div>
                {/* Delivery time */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Truck className="h-3.5 w-3.5" />
                    Срок поставки
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {supplierAnalytics.avgDeliveryDays > 0
                        ? `${supplierAnalytics.avgDeliveryDays} дн.`
                        : '—'}
                    </span>
                    {supplierAnalytics.avgDeliveryDays > 0 && (
                      <Badge variant="outline" className={`rounded-full text-[10px] px-1.5 ${DELIVERY_SPEED_CONFIG[supplierRating.deliverySpeed].className}`}>
                        {DELIVERY_SPEED_CONFIG[supplierRating.deliverySpeed].label}
                      </Badge>
                    )}
                  </div>
                </div>
                {/* Order volume */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    Объём заказов
                  </span>
                  <span className="text-sm font-bold">
                    {supplierAnalytics.totalSpent > 0
                      ? formatCurrency(supplierAnalytics.totalSpent)
                      : '—'}
                  </span>
                </div>
                {/* Items count */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    Позиций
                  </span>
                  <span className="text-sm font-bold">{supplierAnalytics.totalItems}</span>
                </div>
                {/* Star rating */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Star className="h-3.5 w-3.5" />
                    Рейтинг
                  </span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3].map((star) => (
                      <Star
                        key={star}
                        className={`h-3.5 w-3.5 ${
                          star <= supplierRating.stars
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-muted-foreground/30'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Надёжность</span>
                  <Badge variant="secondary" className="rounded-full text-xs">N/A</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Срок поставки</span>
                  <Badge variant="secondary" className="rounded-full text-xs">N/A</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Объём заказов</span>
                  <Badge variant="secondary" className="rounded-full text-xs">N/A</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground pt-2 border-t italic">
                  Показатели будут доступны после обработки данных
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={itemVariants}>
        <Tabs defaultValue="items" className="space-y-4">
          <TabsList>
            <TabsTrigger value="items" className="gap-1.5">
              <Package className="h-3.5 w-3.5" />
              Позиции
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Запросы
            </TabsTrigger>
            <TabsTrigger value="invoices" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Счета
            </TabsTrigger>
          </TabsList>

          {/* Items Tab */}
          <TabsContent value="items">
            {supplier.projectItems.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Нет позиций от этого поставщика
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Проект</TableHead>
                        <TableHead>Наименование</TableHead>
                        <TableHead className="text-right">Кол-во</TableHead>
                        <TableHead className="text-right">Цена</TableHead>
                        <TableHead>Статус</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplier.projectItems.map((item) => (
                        <TableRow key={item.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => navigate('projects')}>
                          <TableCell>
                            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                              <FolderKanban className="h-3.5 w-3.5" />
                              {item.project.name}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span className="truncate max-w-64" title={item.name}>{item.name}</span>
                              {item.article && (
                                <span className="text-xs text-muted-foreground">арт. {item.article}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatNumber(item.quantity)} {item.unit}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.price > 0 ? formatCurrency(item.price) : '—'}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={item.status} map={ITEM_STATUS_MAP} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </Card>
            )}
          </TabsContent>

          {/* Requests Tab */}
          <TabsContent value="requests">
            {requests.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Mail className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Нет запросов этому поставщику
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Проект</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead className="text-center">Позиций</TableHead>
                        <TableHead>Дата отправки</TableHead>
                        <TableHead>Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((req) => (
                        <TableRow key={req.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium">
                            <span className="flex items-center gap-1.5">
                              <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                              {req.project.name}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={req.status} map={REQUEST_STATUS_MAP} />
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center justify-center size-6 rounded-full bg-muted text-xs font-medium">
                              {req.items.length}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {req.sentAt ? formatDate(req.sentAt) : 'Не отправлен'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground max-w-48 truncate" title={req.emailTo}>
                            {req.emailTo || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </Card>
            )}
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices">
            {invoices.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Нет счетов от этого поставщика
                  </p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead>Номер</TableHead>
                        <TableHead>Проект</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead className="text-right">Сумма</TableHead>
                        <TableHead>Дата получения</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv) => (
                        <TableRow key={inv.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium font-mono">
                            {inv.invoiceNumber || '—'}
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1.5 text-sm">
                              <FolderKanban className="h-3.5 w-3.5 text-muted-foreground" />
                              {inv.project.name}
                            </span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={inv.status} map={INVOICE_STATUS_MAP} />
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {inv.totalAmount > 0 ? formatCurrency(inv.totalAmount) : '—'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(inv.receivedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

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
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">
                Название <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-name"
                placeholder="Название компании"
                value={form.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  placeholder="email@example.com"
                  value={form.email}
                  onChange={(e) => handleFormChange('email', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-phone">Телефон</Label>
                <Input
                  id="edit-phone"
                  placeholder="+7 (___) ___-__-__"
                  value={form.phone}
                  onChange={(e) => handleFormChange('phone', e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-contactPerson">Контактное лицо</Label>
              <Input
                id="edit-contactPerson"
                placeholder="ФИО контактного лица"
                value={form.contactPerson}
                onChange={(e) => handleFormChange('contactPerson', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-address">Адрес</Label>
              <Input
                id="edit-address"
                placeholder="Юридический/фактический адрес"
                value={form.address}
                onChange={(e) => handleFormChange('address', e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-notes">Примечания</Label>
              <Textarea
                id="edit-notes"
                placeholder="Дополнительная информация"
                value={form.notes}
                onChange={(e) => handleFormChange('notes', e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog} disabled={updateMutation.isPending}>
              Отмена
            </Button>
            <Button onClick={handleEditSubmit} disabled={updateMutation.isPending}>
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
              <strong>{supplier.name}</strong>?
              {totalItems > 0 && (
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
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending || totalItems > 0}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}
