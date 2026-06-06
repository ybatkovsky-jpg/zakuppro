'use client'

import { useState, useCallback, useMemo, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import { authFetch } from '@/lib/auth-fetch'
import { pluralize } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'
import {
  Plus,
  Filter,
  Send,
  ChevronDown,
  ChevronUp,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  MessageSquare,
  Loader2,
  Search,
  Eye,
  PlusCircle,
  RefreshCw,
  ArrowRight,
  Timer,
  AlertTriangle,
  DollarSign,
  Calendar,
  Zap,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { EmptyState } from '@/components/app/empty-state'

// ── Types ──────────────────────────────────────────────────

interface Project {
  id: string
  name: string
  description: string
  status: string
}

interface Supplier {
  id: string
  name: string
  email: string
  phone: string
  contactPerson: string
}

interface ProjectItem {
  id: string
  name: string
  article: string
  category: string
  quantity: number
  unit: string
  price: number
  supplierId: string | null
  status: string
  supplier: Supplier | null
}

interface PurchaseRequestItem {
  id: string
  projectItemId: string
  quantity: number
  price: number
  available: boolean
  availableQty: number
  deliveryDays: number
  notes: string
  projectItem: ProjectItem
}

interface PurchaseRequest {
  id: string
  projectId: string
  supplierId: string
  status: string
  emailTo: string
  emailSubject: string
  emailBody: string
  sentAt: string | null
  responseAt: string | null
  notes: string
  createdAt: string
  updatedAt: string
  project: { id: string; name: string }
  supplier: { id: string; name: string; email: string }
  items: PurchaseRequestItem[]
}

// ── Status helpers ─────────────────────────────────────────

const REQUEST_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string; icon: typeof Clock }> = {
  draft: { label: 'Черновик', variant: 'secondary', className: 'rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700', icon: FileText },
  sent: { label: 'Отправлен', variant: 'default', className: 'rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950/30 dark:text-sky-400 border-sky-200 dark:border-sky-800', icon: Send },
  responded: { label: 'Ответ получен', variant: 'default', className: 'rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800', icon: CheckCircle2 },
  partial: { label: 'Частичный ответ', variant: 'outline', className: 'rounded-full border-amber-400 text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30', icon: AlertTriangle },
  cancelled: { label: 'Отменён', variant: 'destructive', className: 'rounded-full', icon: XCircle },
}

const REQUEST_ROW_BORDER: Record<string, string> = {
  draft: 'border-l-slate-400',
  sent: 'border-l-sky-500',
  responded: 'border-l-emerald-500',
  partial: 'border-l-amber-400',
  cancelled: 'border-l-red-400',
}

const REQUEST_ROW_BG: Record<string, string> = {
  draft: 'hover:bg-slate-50/50 dark:hover:bg-slate-950/20',
  sent: 'hover:bg-sky-50/50 dark:hover:bg-sky-950/20',
  responded: 'hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20',
  partial: 'hover:bg-amber-50/50 dark:hover:bg-amber-950/20',
  cancelled: 'hover:bg-red-50/50 dark:hover:bg-red-950/20',
}

// Pipeline step config
const PIPELINE_STEPS = [
  { key: 'draft', label: 'Черновик', color: 'bg-slate-400' },
  { key: 'sent', label: 'Отправлен', color: 'bg-sky-500' },
  { key: 'responded', label: 'Ответ получен', color: 'bg-emerald-500' },
]

function StatusBadge({ status }: { status: string }) {
  const info = REQUEST_STATUS_MAP[status] || { label: status, variant: 'outline' as const, className: 'rounded-full', icon: Clock }
  const Icon = info.icon
  return (
    <Badge variant={info.variant} className={`${info.className} gap-1`}>
      <Icon className="h-3 w-3" />
      {info.label}
    </Badge>
  )
}

// ── Pipeline Visual ────────────────────────────────────────

function RequestPipeline({ stats }: { stats: { drafts: number; sent: number; responded: number; partial: number; cancelled: number; total: number } }) {
  const steps = [
    { ...PIPELINE_STEPS[0], count: stats.drafts },
    { ...PIPELINE_STEPS[1], count: stats.sent },
    { ...PIPELINE_STEPS[2], count: stats.responded + stats.partial },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="border-dashed bg-gradient-to-r from-violet-50/50 via-transparent to-violet-50/30 dark:from-violet-950/10 dark:to-violet-950/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-violet-500" />
            <CardTitle className="text-base">Воронка запросов</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-0">
            {steps.map((step, idx) => (
              <Fragment key={step.key}>
                <div className="flex-1 flex flex-col items-center gap-1.5">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${step.color} text-white text-sm font-bold shadow-md`}>
                    {step.count}
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{step.label}</span>
                  {stats.total > 0 && (
                    <span className="text-[10px] text-muted-foreground/60">
                      {Math.round((step.count / stats.total) * 100)}%
                    </span>
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div className="flex items-center px-1 -mt-4">
                    <div className="w-8 h-0.5 bg-gradient-to-r from-muted-foreground/20 to-muted-foreground/30" />
                    <ArrowRight className="h-3 w-3 text-muted-foreground/40 -ml-0.5" />
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── Skeleton ───────────────────────────────────────────────

function RequestsTableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-8" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-4 w-10" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-2">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

// ── Response Time Tracker ──────────────────────────────────

function ResponseTimeTracker({ sentAt, responseAt, status }: { sentAt: string | null; responseAt: string | null; status: string }) {
  if (!sentAt) return null

  const sentDate = new Date(sentAt)
  const now = new Date()

  if (status === 'responded' || status === 'partial') {
    if (!responseAt) return null
    const responseDate = new Date(responseAt)
    const diffMs = responseDate.getTime() - sentDate.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    const isFast = diffDays < 2
    const isMedium = diffDays >= 2 && diffDays < 5

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 text-xs font-medium cursor-help ${
            isFast ? 'text-emerald-600 dark:text-emerald-400' : isMedium ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
          }`}>
            <Timer className="h-3 w-3" />
            {diffDays > 0 ? `${diffDays}д ` : ''}{diffHours}ч
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Время ответа: {diffDays > 0 ? `${diffDays} дн. ` : ''}{diffHours} ч.</p>
          <p className="text-[10px] text-muted-foreground">
            {isFast ? 'Быстрый ответ' : isMedium ? 'Среднее время' : 'Долгий ответ'}
          </p>
        </TooltipContent>
      </Tooltip>
    )
  }

  // Still waiting
  if (status === 'sent') {
    const diffMs = now.getTime() - sentDate.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const isOverdue = diffDays >= 3

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 text-xs cursor-help ${
            isOverdue ? 'text-red-600 dark:text-red-400 font-medium animate-pulse' : 'text-muted-foreground'
          }`}>
            {isOverdue ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <Clock className="h-3 w-3" />
            )}
            {diffDays}д
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>Ожидание: {diffDays} дн.</p>
          {isOverdue && (
            <p className="text-[10px] text-red-500 font-medium">
              Нет ответа более 3 дней!
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    )
  }

  return null
}

// ── Main Component ─────────────────────────────────────────

export function Requests() {
  const queryClient = useQueryClient()

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  const [projectFilter, setProjectFilter] = useState<string>('all')

  // Search
  const [searchQuery, setSearchQuery] = useState('')

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [step, setStep] = useState(1)
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('')
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())
  const [emailTo, setEmailTo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')

  // Record response dialog
  const [responseOpen, setResponseOpen] = useState(false)
  const [responseRequestId, setResponseRequestId] = useState<string>('')
  const [responseItems, setResponseItems] = useState<
    { id: string; available: boolean; availableQty: number; deliveryDays: number; price: number; notes: string }[]
  >([])

  // Cancel dialog
  const [cancelId, setCancelId] = useState<string | null>(null)

  // Preview Email dialog
  const [previewEmailOpen, setPreviewEmailOpen] = useState(false)
  const [previewEmailData, setPreviewEmailData] = useState<{
    emailTo: string
    emailSubject: string
    emailBody: string
  }>({ emailTo: '', emailSubject: '', emailBody: '' })

  // ── Queries ────────────────────────────────────────────────

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['requests', statusFilter, supplierFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (supplierFilter && supplierFilter !== 'all') params.set('supplierId', supplierFilter)
      const res = await authFetch(`/api/requests?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch requests')
      return res.json() as Promise<PurchaseRequest[]>
    },
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await authFetch('/api/projects')
      if (!res.ok) throw new Error('Failed to fetch projects')
      return res.json() as Promise<Project[]>
    },
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await authFetch('/api/suppliers')
      if (!res.ok) throw new Error('Failed to fetch suppliers')
      return res.json() as Promise<Supplier[]>
    },
  })

  const { data: projectDetail } = useQuery({
    queryKey: ['project', selectedProjectId],
    queryFn: async () => {
      const res = await authFetch(`/api/projects/${selectedProjectId}`)
      if (!res.ok) throw new Error('Failed to fetch project')
      return res.json() as Promise<Project & { items: ProjectItem[] }>
    },
    enabled: !!selectedProjectId,
  })

  const { data: companyData } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const res = await authFetch('/api/company')
      if (!res.ok) throw new Error('Failed to fetch company')
      return res.json() as Promise<{ companyName: string; inn: string; email: string; phone: string }>
    },
  })

  // ── Filtered requests by search and project ────────────────

  const filteredRequests = useMemo(() => {
    let result = requests
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (req) =>
          req.supplier.name.toLowerCase().includes(q) ||
          req.project.name.toLowerCase().includes(q) ||
          req.emailTo.toLowerCase().includes(q)
      )
    }
    if (projectFilter && projectFilter !== 'all') {
      result = result.filter((req) => req.projectId === projectFilter)
    }
    return result
  }, [requests, searchQuery, projectFilter])

  // ── Send email mutation ───────────────────────────────────

  const sendEmailMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const res = await authFetch(`/api/requests/${requestId}/send-email`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка отправки')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      toast({ title: 'Письмо отправлено', description: 'Запрос отправлен поставщику по email' })
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка отправки', description: error.message, variant: 'destructive' })
    },
  })

  // ── Mutations ──────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (data: {
      projectId: string
      supplierId: string
      emailTo: string
      emailSubject: string
      emailBody: string
      items: { projectItemId: string; quantity: number; price: number }[]
    }) => {
      const res = await authFetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create request')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      toast({ title: 'Запрос создан', description: 'Запрос поставщику успешно создан' })
      resetCreateDialog()
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await authFetch(`/api/requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update request')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      toast({ title: 'Запрос обновлён' })
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' })
    },
  })

  // ── Helpers ────────────────────────────────────────────────

  const resetCreateDialog = useCallback(() => {
    setStep(1)
    setSelectedProjectId('')
    setSelectedSupplierId('')
    setSelectedItemIds(new Set())
    setEmailTo('')
    setEmailSubject('')
    setEmailBody('')
    setCreateOpen(false)
  }, [])

  const availableProjectItems = projectDetail?.items?.filter((item) => {
    if (!selectedSupplierId) return false
    return !item.supplierId || item.supplierId === selectedSupplierId
  }) || []

  const handleSupplierChange = (supplierId: string) => {
    setSelectedSupplierId(supplierId)
    setSelectedItemIds(new Set())
    const supplier = suppliers.find((s) => s.id === supplierId)
    if (supplier) {
      setEmailTo(supplier.email || '')
      setEmailSubject(`Запрос цен и сроков поставки — ${projectDetail?.name || ''}`)
      const company = companyData
      setEmailBody(
        `Добрый день!\n\nПрошу предоставить актуальные цены и сроки поставки по следующим позициям:\n\n` +
        `[Список позиций будет добавлен автоматически]\n\n` +
        `Компания: ${company?.companyName || ''}\n` +
        `ИНН: ${company?.inn || ''}\n` +
        `Email: ${company?.email || ''}\n` +
        `Телефон: ${company?.phone || ''}\n\n` +
        `С уважением,\n${company?.companyName || ''}`
      )
    }
  }

  const toggleItem = (itemId: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const handleCreate = () => {
    const items = Array.from(selectedItemIds).map((id) => {
      const pi = projectDetail?.items?.find((i) => i.id === id)
      return {
        projectItemId: id,
        quantity: pi?.quantity || 1,
        price: pi?.price || 0,
      }
    })
    createMutation.mutate({
      projectId: selectedProjectId,
      supplierId: selectedSupplierId,
      emailTo,
      emailSubject,
      emailBody,
      items,
    })
  }

  const handleMarkSent = (id: string) => {
    updateMutation.mutate({ id, data: { status: 'sent' } })
  }

  const handleCancel = (id: string) => {
    updateMutation.mutate({ id, data: { status: 'cancelled' } })
    setCancelId(null)
  }

  const handleResend = (req: PurchaseRequest) => {
    updateMutation.mutate({
      id: req.id,
      data: { status: 'sent', sentAt: new Date().toISOString() },
    })
  }

  const openResponseDialog = (request: PurchaseRequest) => {
    setResponseRequestId(request.id)
    setResponseItems(
      request.items.map((item) => ({
        id: item.id,
        available: item.available,
        availableQty: item.availableQty,
        deliveryDays: item.deliveryDays,
        price: item.price,
        notes: item.notes,
      }))
    )
    setResponseOpen(true)
  }

  const openPreviewEmail = (req: PurchaseRequest) => {
    setPreviewEmailData({
      emailTo: req.emailTo,
      emailSubject: req.emailSubject,
      emailBody: req.emailBody,
    })
    setPreviewEmailOpen(true)
  }

  const handleRecordResponse = () => {
    const hasAvailable = responseItems.some((ri) => ri.available)
    updateMutation.mutate({
      id: responseRequestId,
      data: {
        status: hasAvailable ? 'responded' : 'partial',
        responseItems,
      },
    })
    setResponseOpen(false)
  }

  const handleInlineStatusUpdate = (id: string, newStatus: string) => {
    updateMutation.mutate({ id, data: { status: newStatus } })
  }

  const formatDate = (d: string | null) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // Check if request needs resend (sent 3+ days ago, no response)
  const needsResend = useCallback((req: PurchaseRequest) => {
    if (req.status !== 'sent' || !req.sentAt) return false
    const sentDate = new Date(req.sentAt)
    const diffDays = Math.floor((Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays >= 3
  }, [])

  // ── Step labels ────────────────────────────────────────────

  const stepLabels = ['Проект', 'Поставщик', 'Позиции', 'Письмо', 'Проверка']

  // ── Statistics ────────────────────────────────────────────

  const stats = useMemo(() => {
    const total = requests.length
    const sent = requests.filter((r) => r.status === 'sent').length
    const drafts = requests.filter((r) => r.status === 'draft').length
    const responded = requests.filter((r) => r.status === 'responded').length
    const partial = requests.filter((r) => r.status === 'partial').length
    const cancelled = requests.filter((r) => r.status === 'cancelled').length
    const totalValue = requests.reduce((sum, r) => {
      return sum + r.items.reduce((s, i) => s + (i.price * i.quantity), 0)
    }, 0)
    const overdue = requests.filter((r) => needsResend(r)).length
    return { total, sent, drafts, responded, partial, cancelled, totalValue, overdue }
  }, [requests, needsResend])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative -mx-6 -mt-6 px-6 pt-6 pb-5 bg-gradient-to-b from-violet-500/5 via-violet-500/[0.02] to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm">Управление запросами поставщикам</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.02]">
            <Plus className="mr-2 h-4 w-4" />
            Новый запрос
          </Button>
        </div>
      </div>

      {/* Request Statistics Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="relative overflow-hidden border-l-[3px] border-l-violet-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/10">
                  <Mail className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Всего запросов</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="relative overflow-hidden border-l-[3px] border-l-sky-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/10">
                  <Send className="h-4.5 w-4.5 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.sent}</p>
                  <p className="text-xs text-muted-foreground">Отправлено</p>
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
                  <FileText className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.drafts}</p>
                  <p className="text-xs text-muted-foreground">Черновики</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}>
          <Card className="relative overflow-hidden border-l-[3px] border-l-emerald-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.responded + stats.partial}</p>
                  <p className="text-xs text-muted-foreground">Ответ получен</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="relative overflow-hidden border-l-[3px] border-l-rose-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/10">
                  <DollarSign className="h-4.5 w-4.5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <p className="text-lg font-bold">{stats.totalValue >= 1000000 ? `${(stats.totalValue / 1000000).toFixed(1)}М` : stats.totalValue >= 1000 ? `${(stats.totalValue / 1000).toFixed(0)}к` : stats.totalValue.toFixed(0)} ₽</p>
                  <p className="text-xs text-muted-foreground">Общая сумма</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Visual Pipeline */}
      {!requestsLoading && requests.length > 0 && (
        <RequestPipeline stats={stats} />
      )}

      {/* Overdue Alert */}
      {!requestsLoading && stats.overdue > 0 && (
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 shrink-0">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">
                    {stats.overdue} {pluralize(stats.overdue, 'запрос', 'запроса', 'запросов')} без ответа более 3 дней
                  </p>
                  <p className="text-xs text-red-600/70 dark:text-red-400/60">
                    Нажмите «Напомнить» для повторной отправки
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Filter Bar */}
      <Card className="border-dashed">
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
            </div>
            <div className="flex flex-wrap gap-2">
              {['all', 'draft', 'sent', 'responded', 'partial', 'cancelled'].map((val) => {
                const label = val === 'all' ? 'Все' : REQUEST_STATUS_MAP[val]?.label ?? val
                const isActive = statusFilter === val
                const count = val === 'all' ? requests.length : requests.filter((r) => r.status === val).length
                return (
                  <button
                    key={val}
                    onClick={() => setStatusFilter(val)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 border ${
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:border-border hover:shadow-sm'
                    }`}
                  >
                    {label} <span className="opacity-60 ml-0.5">{count}</span>
                  </button>
                )
              })}
            </div>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Поставщик" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все поставщики</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Проект" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все проекты</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по поставщику, проекту, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-8 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardContent className="p-0">
          {requestsLoading ? (
            <RequestsTableSkeleton />
          ) : filteredRequests.length === 0 ? (
            <EmptyState
              type={searchQuery || projectFilter !== 'all' ? 'search' : 'requests'}
              action={
                !searchQuery && projectFilter === 'all'
                  ? {
                      label: 'Новый запрос',
                      onClick: () => setCreateOpen(true),
                      icon: PlusCircle,
                    }
                  : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Проект</TableHead>
                  <TableHead className="hidden sm:table-cell">Поставщик</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Позиций</TableHead>
                  <TableHead className="hidden lg:table-cell">Отправлено</TableHead>
                  <TableHead className="hidden lg:table-cell">Ответ</TableHead>
                  <TableHead className="hidden lg:table-cell">Время</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                {filteredRequests.map((req) => (
                  <Fragment key={req.id}>
                    <TableRow
                      className={`cursor-pointer border-l-[3px] ${REQUEST_ROW_BORDER[req.status] ?? 'border-l-muted'} ${REQUEST_ROW_BG[req.status] ?? 'hover:bg-muted/50'} transition-all duration-200 hover:shadow-sm`}
                      onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                    >
                      <TableCell>
                        <motion.div
                          animate={{ rotate: expandedId === req.id ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </motion.div>
                      </TableCell>
                      <TableCell className="font-medium">{req.project.name}</TableCell>
                      <TableCell className="hidden sm:table-cell">{req.supplier.name}</TableCell>
                      <TableCell>
                        <StatusBadge status={req.status} />
                      </TableCell>
                      <TableCell className="text-center hidden sm:table-cell">{req.items.length}</TableCell>
                      <TableCell className="hidden lg:table-cell">{formatDate(req.sentAt)}</TableCell>
                      <TableCell className="hidden lg:table-cell">{formatDate(req.responseAt)}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <ResponseTimeTracker sentAt={req.sentAt} responseAt={req.responseAt} status={req.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {req.emailBody && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openPreviewEmail(req)}
                                  className="h-7 w-7 p-0"
                                >
                                  <Eye className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Предпросмотр письма</TooltipContent>
                            </Tooltip>
                          )}
                          {req.status === 'draft' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => sendEmailMutation.mutate(req.id)}
                                disabled={sendEmailMutation.isPending}
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                {sendEmailMutation.isPending ? (
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                ) : (
                                  <Send className="mr-1 h-3 w-3" />
                                )}
                                Отправить по email
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkSent(req.id)}
                                disabled={updateMutation.isPending}
                                className="h-7 text-xs"
                              >
                                <Send className="mr-1 h-3 w-3" />
                                Отправить
                              </Button>
                            </>
                          )}
                          {(req.status === 'sent' || req.status === 'partial') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openResponseDialog(req)}
                              className="h-7 text-xs"
                            >
                              <MessageSquare className="mr-1 h-3 w-3" />
                              Записать ответ
                            </Button>
                          )}
                          {needsResend(req) && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResend(req)}
                                  disabled={updateMutation.isPending}
                                  className="h-7 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
                                >
                                  <RefreshCw className="mr-1 h-3 w-3" />
                                  Напомнить
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Нет ответа более 3 дней. Отправить повторно.</TooltipContent>
                            </Tooltip>
                          )}
                          {req.status !== 'cancelled' && req.status !== 'responded' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => setCancelId(req.id)}
                            >
                              <XCircle className="mr-1 h-3 w-3" />
                              Отменить
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === req.id && (
                      <TableRow key={`${req.id}-detail`}>
                        <TableCell colSpan={9} className="bg-muted/30 p-4">
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                            className="space-y-4"
                          >
                            {/* Inline Status Update Actions */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-muted-foreground font-medium">Сменить статус:</span>
                              {req.status === 'draft' && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleInlineStatusUpdate(req.id, 'sent')} disabled={updateMutation.isPending}>
                                  <Send className="mr-1 h-3 w-3" /> Отправлен
                                </Button>
                              )}
                              {(req.status === 'sent' || req.status === 'partial') && (
                                <>
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openResponseDialog(req)}>
                                    <MessageSquare className="mr-1 h-3 w-3" /> Записать ответ
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleInlineStatusUpdate(req.id, 'responded')} disabled={updateMutation.isPending}>
                                    <CheckCircle2 className="mr-1 h-3 w-3" /> Ответ получен
                                  </Button>
                                </>
                              )}
                              {req.status !== 'cancelled' && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => setCancelId(req.id)}>
                                  <XCircle className="mr-1 h-3 w-3" /> Отменить
                                </Button>
                              )}
                            </div>

                            {/* Items */}
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Позиции запроса</h4>
                              <div className="border rounded-md overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Наименование</TableHead>
                                      <TableHead>Артикул</TableHead>
                                      <TableHead className="text-center">Кол-во</TableHead>
                                      <TableHead className="text-right">Цена</TableHead>
                                      <TableHead className="text-right">Сумма</TableHead>
                                      <TableHead className="text-center">Доступно</TableHead>
                                      <TableHead className="text-center">Доступное кол-во</TableHead>
                                      <TableHead className="text-center">Срок (дн.)</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {req.items.map((item) => (
                                      <TableRow key={item.id}>
                                        <TableCell>{item.projectItem.name}</TableCell>
                                        <TableCell className="text-muted-foreground">
                                          {item.projectItem.article || '—'}
                                        </TableCell>
                                        <TableCell className="text-center">{item.quantity} {item.projectItem.unit}</TableCell>
                                        <TableCell className="text-right">
                                          {item.price > 0 ? `${item.price.toFixed(2)} ₽` : '—'}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                          {item.price > 0 ? `${(item.price * item.quantity).toFixed(2)} ₽` : '—'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {item.available ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                                          ) : req.status === 'responded' || req.status === 'partial' ? (
                                            <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                                          ) : (
                                            <Clock className="h-4 w-4 text-muted-foreground mx-auto" />
                                          )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {item.availableQty > 0 ? item.availableQty : '—'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          {item.deliveryDays > 0 ? item.deliveryDays : '—'}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                              {/* Items total */}
                              <div className="flex justify-end mt-2">
                                <p className="text-sm font-semibold">
                                  Итого: {req.items.reduce((sum, i) => sum + (i.price * i.quantity), 0).toFixed(2)} ₽
                                </p>
                              </div>
                            </div>

                            {/* Email preview (expandable) */}
                            {req.emailTo && (
                              <>
                                <Separator />
                                <div>
                                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                                    <Mail className="h-4 w-4" />
                                    Email
                                  </h4>
                                  <div className="text-sm space-y-1 bg-background rounded-xl p-4 border shadow-sm">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p><span className="text-muted-foreground">Кому:</span> <span className="font-medium">{req.emailTo}</span></p>
                                      <p className="text-muted-foreground">•</p>
                                      <p><span className="text-muted-foreground">Тема:</span> <span className="font-medium">{req.emailSubject}</span></p>
                                    </div>
                                    <div className="mt-2 whitespace-pre-wrap text-muted-foreground text-xs max-h-40 overflow-y-auto bg-muted/30 rounded-lg p-3">
                                      {req.emailBody}
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </motion.div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
                </AnimatePresence>
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Preview Email Dialog ──────────────────────────────── */}
      <Dialog open={previewEmailOpen} onOpenChange={setPreviewEmailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-5" />
              Предпросмотр письма
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Кому</p>
                <p className="font-medium text-sm">{previewEmailData.emailTo || '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Тема</p>
                <p className="font-medium text-sm">{previewEmailData.emailSubject || '—'}</p>
              </div>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground mb-2">Текст письма</p>
              <div className="bg-muted rounded-md p-4 whitespace-pre-wrap text-sm max-h-96 overflow-y-auto">
                {previewEmailData.emailBody || 'Шаблон письма пуст'}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPreviewEmailOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create Request Dialog ──────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) resetCreateDialog() }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новый запрос поставщику</DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-1 mb-4">
            {stepLabels.map((label, i) => (
              <div key={i} className="flex items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors duration-200 ${
                    i + 1 <= step
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </div>
                {i < stepLabels.length - 1 && (
                  <div
                    className={`h-0.5 w-6 transition-colors duration-200 ${
                      i + 1 < step ? 'bg-primary' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground -mt-2 mb-4">
            Шаг {step}: {stepLabels[step - 1]}
          </p>

          {/* Step 1: Select project */}
          {step === 1 && (
            <div className="space-y-4">
              <Label>Выберите проект</Label>
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите проект" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {projects.length === 0 && (
                <p className="text-sm text-muted-foreground">Нет доступных проектов. Сначала создайте проект.</p>
              )}
            </div>
          )}

          {/* Step 2: Select supplier */}
          {step === 2 && (
            <div className="space-y-4">
              <Label>Выберите поставщика</Label>
              <Select value={selectedSupplierId} onValueChange={handleSupplierChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите поставщика" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.email ? `(${s.email})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {suppliers.length === 0 && (
                <p className="text-sm text-muted-foreground">Нет доступных поставщиков. Сначала добавьте поставщика.</p>
              )}
            </div>
          )}

          {/* Step 3: Select items */}
          {step === 3 && (
            <div className="space-y-4">
              <Label>Выберите позиции для запроса</Label>
              {availableProjectItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Нет доступных позиций для выбранного поставщика. Позиции без привязки к поставщику или привязанные к этому поставщику появятся здесь.
                </p>
              ) : (
                <div className="border rounded-md max-h-64 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10" />
                        <TableHead>Наименование</TableHead>
                        <TableHead className="text-center">Кол-во</TableHead>
                        <TableHead className="text-right">Цена</TableHead>
                        <TableHead>Поставщик</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {availableProjectItems.map((item) => (
                        <TableRow
                          key={item.id}
                          className="cursor-pointer"
                          onClick={() => toggleItem(item.id)}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedItemIds.has(item.id)}
                              onCheckedChange={() => toggleItem(item.id)}
                            />
                          </TableCell>
                          <TableCell>{item.name}</TableCell>
                          <TableCell className="text-center">{item.quantity} {item.unit}</TableCell>
                          <TableCell className="text-right">
                            {item.price > 0 ? `${item.price.toFixed(2)} ₽` : '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {item.supplier?.name || 'Не указан'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Выбрано: {selectedItemIds.size} позиций</p>
            </div>
          )}

          {/* Step 4: Compose email */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Email получателя</Label>
                <Input value={emailTo} onChange={(e) => setEmailTo(e.target.value)} placeholder="email@supplier.com" />
              </div>
              <div className="space-y-2">
                <Label>Тема письма</Label>
                <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Текст письма</Label>
                <Textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={10}
                  className="font-mono text-xs"
                />
              </div>
            </div>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Проект</p>
                  <p className="font-medium">{projects.find((p) => p.id === selectedProjectId)?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Поставщик</p>
                  <p className="font-medium">{suppliers.find((s) => s.id === selectedSupplierId)?.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Позиций</p>
                  <p className="font-medium">{selectedItemIds.size}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="font-medium">{emailTo}</p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Тема: {emailSubject}</p>
                <div className="text-xs bg-muted rounded-md p-3 max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {emailBody}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Выбранные позиции:</p>
                <ul className="text-xs space-y-1">
                  {Array.from(selectedItemIds).map((id) => {
                    const pi = projectDetail?.items?.find((i) => i.id === id)
                    return pi ? (
                      <li key={id} className="flex justify-between">
                        <span>{pi.name}</span>
                        <span className="text-muted-foreground">{pi.quantity} {pi.unit}</span>
                      </li>
                    ) : null
                  })}
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {step > 1 && (
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                Назад
              </Button>
            )}
            {step < 5 ? (
              <Button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 1 && !selectedProjectId) ||
                  (step === 2 && !selectedSupplierId) ||
                  (step === 3 && selectedItemIds.size === 0)
                }
              >
                Далее
              </Button>
            ) : (
              <Button type="button" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Создать запрос
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Record Response Dialog ─────────────────────────── */}
      <Dialog open={responseOpen} onOpenChange={setResponseOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Записать ответ поставщика</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Укажите информацию о доступности и ценах от поставщика
            </p>
            <div className="border rounded-md max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Позиция</TableHead>
                    <TableHead className="text-center">Доступно</TableHead>
                    <TableHead className="text-center">Доступное кол-во</TableHead>
                    <TableHead className="text-center">Срок (дн.)</TableHead>
                    <TableHead className="text-right">Цена</TableHead>
                    <TableHead>Примечание</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {responseItems.map((ri, idx) => {
                    const requestItem = requests
                      .find((r) => r.id === responseRequestId)
                      ?.items.find((i) => i.id === ri.id)
                    return (
                      <TableRow key={ri.id}>
                        <TableCell className="text-sm">
                          {requestItem?.projectItem?.name || `Позиция ${idx + 1}`}
                        </TableCell>
                        <TableCell className="text-center">
                          <Checkbox
                            checked={ri.available}
                            onCheckedChange={(checked) => {
                              setResponseItems((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, available: !!checked } : item
                                )
                              )
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            className="w-20 text-center"
                            value={ri.availableQty}
                            onChange={(e) =>
                              setResponseItems((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, availableQty: parseInt(e.target.value) || 0 }
                                    : item
                                )
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            className="w-20 text-center"
                            value={ri.deliveryDays}
                            onChange={(e) =>
                              setResponseItems((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, deliveryDays: parseInt(e.target.value) || 0 }
                                    : item
                                )
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            className="w-24 text-right"
                            value={ri.price}
                            onChange={(e) =>
                              setResponseItems((prev) =>
                                prev.map((item, i) =>
                                  i === idx
                                    ? { ...item, price: parseFloat(e.target.value) || 0 }
                                    : item
                                )
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="w-32"
                            value={ri.notes}
                            placeholder="—"
                            onChange={(e) =>
                              setResponseItems((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, notes: e.target.value } : item
                                )
                              )
                            }
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setResponseOpen(false)}>
              Отмена
            </Button>
            <Button type="button" onClick={handleRecordResponse} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Записать ответ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Confirmation ────────────────────────────── */}
      <AlertDialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить запрос?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите отменить этот запрос? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Нет, оставить</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelId && handleCancel(cancelId)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Да, отменить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
