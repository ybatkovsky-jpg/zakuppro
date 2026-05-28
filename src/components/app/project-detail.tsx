'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/store/app-store'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  PackageCheck,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  FileText,
  Mail,
  ShoppingCart,
  History,
  Package,
} from 'lucide-react'

// --- Types ---

interface Supplier {
  id: string
  name: string
  email: string
}

interface ProjectItem {
  id: string
  name: string
  article: string
  category: string
  quantity: number
  unit: string
  price: number
  status: string
  notes: string
  rowNumber: number
  isFromWarehouse: boolean
  supplierId: string | null
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
  status: string
  emailTo: string
  emailSubject: string
  sentAt: string | null
  responseAt: string | null
  notes: string
  createdAt: string
  supplier: Supplier
  items: PurchaseRequestItem[]
}

interface InvoiceItem {
  id: string
  name: string
  quantity: number
  price: number
  isMatch: boolean
  mismatchReason: string
  projectItemId: string | null
  projectItem: ProjectItem | null
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
  supplier: Supplier
  items: InvoiceItem[]
}

interface StatusHistoryEntry {
  id: string
  status: string
  notes: string
  createdAt: string
}

interface ProjectDetail {
  id: string
  name: string
  description: string
  status: string
  fileName: string
  customerName: string
  createdAt: string
  updatedAt: string
  items: ProjectItem[]
  purchaseRequests: PurchaseRequest[]
  invoices: Invoice[]
  statusHistory?: StatusHistoryEntry[]
}

// --- Status helpers ---

const PROJECT_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }> = {
  new: { label: 'Новый', variant: 'secondary' },
  processing: { label: 'В обработке', variant: 'default' },
  requested: { label: 'Запрошено', variant: 'outline' },
  invoiced: { label: 'Счета', variant: 'outline', className: 'border-amber-500 text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30' },
  paid: { label: 'Оплачено', variant: 'outline', className: 'border-green-500 text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/30' },
  delivered: { label: 'Доставлено', variant: 'outline', className: 'border-green-600 text-green-800 bg-green-50 dark:text-green-400 dark:bg-green-950/30' },
  completed: { label: 'Завершено', variant: 'outline', className: 'border-green-700 text-green-900 bg-green-100 dark:text-green-300 dark:bg-green-950/40' },
  cancelled: { label: 'Отменено', variant: 'destructive' },
}

const ITEM_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }> = {
  pending: { label: 'Ожидание', variant: 'secondary' },
  requested: { label: 'Запрошено', variant: 'outline', className: 'border-blue-400 text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30' },
  invoiced: { label: 'В счёте', variant: 'outline', className: 'border-amber-500 text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30' },
  ordered: { label: 'Заказано', variant: 'outline', className: 'border-purple-500 text-purple-700 bg-purple-50 dark:text-purple-400 dark:bg-purple-950/30' },
  partial: { label: 'Частично', variant: 'outline', className: 'border-orange-500 text-orange-700 bg-orange-50 dark:text-orange-400 dark:bg-orange-950/30' },
  available: { label: 'Доступно', variant: 'outline', className: 'border-cyan-500 text-cyan-700 bg-cyan-50 dark:text-cyan-400 dark:bg-cyan-950/30' },
  delivered: { label: 'Доставлено', variant: 'outline', className: 'border-green-500 text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/30' },
  completed: { label: 'Завершено', variant: 'outline', className: 'border-green-700 text-green-900 bg-green-100 dark:text-green-300 dark:bg-green-950/40' },
}

const REQUEST_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }> = {
  draft: { label: 'Черновик', variant: 'secondary' },
  sent: { label: 'Отправлен', variant: 'outline', className: 'border-blue-400 text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30' },
  responded: { label: 'Ответ получен', variant: 'outline', className: 'border-green-500 text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/30' },
  partial: { label: 'Частичный', variant: 'outline', className: 'border-orange-500 text-orange-700 bg-orange-50 dark:text-orange-400 dark:bg-orange-950/30' },
  cancelled: { label: 'Отменён', variant: 'destructive' },
}

const INVOICE_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }> = {
  received: { label: 'Получен', variant: 'secondary' },
  verified: { label: 'Проверен', variant: 'outline', className: 'border-green-500 text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/30' },
  discrepancy: { label: 'Расхождение', variant: 'outline', className: 'border-red-500 text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-950/30' },
  approved: { label: 'Согласован', variant: 'outline', className: 'border-emerald-500 text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30' },
  paid: { label: 'Оплачен', variant: 'outline', className: 'border-green-700 text-green-900 bg-green-100 dark:text-green-300 dark:bg-green-950/40' },
  cancelled: { label: 'Отменён', variant: 'destructive' },
}

function StatusBadge({
  status,
  map,
}: {
  status: string
  map: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }>
}) {
  const config = map[status] ?? { label: status, variant: 'secondary' as const }
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}

// --- Main Component ---

export function ProjectDetail() {
  const { selectedProjectId, navigate } = useAppStore()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({})
  const [expandedRequests, setExpandedRequests] = useState<Record<string, boolean>>({})
  const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({})

  // --- Queries ---

  const {
    data: project,
    isLoading,
    isError,
  } = useQuery<ProjectDetail>({
    queryKey: ['project', selectedProjectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${selectedProjectId}`)
      if (!res.ok) throw new Error('Не удалось загрузить проект')
      return res.json()
    },
    enabled: !!selectedProjectId,
  })

  const {
    data: statusHistory = [],
  } = useQuery<StatusHistoryEntry[]>({
    queryKey: ['project-history', selectedProjectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${selectedProjectId}/history`)
      if (!res.ok) return []
      return res.json()
    },
    enabled: !!selectedProjectId,
  })

  // --- Mutations ---

  const updateProjectStatus = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      const res = await fetch(`/api/projects/${selectedProjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка обновления статуса')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', selectedProjectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast({ title: 'Статус обновлён' })
    },
    onError: (err: Error) => {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' })
    },
  })

  const createRequestsMutation = useMutation({
    mutationFn: async (requests: { supplierId: string; items: { projectItemId: string; quantity: number; price: number }[] }[]) => {
      const results = []
      for (const req of requests) {
        const res = await fetch('/api/requests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: selectedProjectId,
            supplierId: req.supplierId,
            items: req.items,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Ошибка создания запроса')
        }
        results.push(await res.json())
      }
      return results
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', selectedProjectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast({ title: 'Запросы созданы' })
    },
    onError: (err: Error) => {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' })
    },
  })

  const verifyInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'verified' }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка проверки счёта')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', selectedProjectId] })
      toast({ title: 'Счёт проверен' })
    },
    onError: (err: Error) => {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' })
    },
  })

  const updateItemStatus = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: string }) => {
      const res = await fetch(`/api/projects/${selectedProjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemUpdates: [{ itemId, status }] }),
      })
      // Fallback: if API doesn't support itemUpdates, just refresh
      if (!res.ok) throw new Error('Ошибка обновления позиции')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', selectedProjectId] })
    },
    onError: () => {
      toast({ title: 'Ошибка обновления позиции', variant: 'destructive' })
    },
  })

  // --- Group items by supplier ---

  function getItemsBySupplier(items: ProjectItem[]) {
    const groups: Record<string, { supplier: Supplier | null; items: ProjectItem[] }> = {}

    for (const item of items) {
      const key = item.supplierId ?? '__no_supplier__'
      if (!groups[key]) {
        groups[key] = { supplier: item.supplier, items: [] }
      }
      groups[key].items.push(item)
    }

    // Sort: items with supplier first, then "Без поставщика"
    const entries = Object.entries(groups).sort(([a], [b]) => {
      if (a === '__no_supplier__') return 1
      if (b === '__no_supplier__') return -1
      return 0
    })

    return entries
  }

  // --- Create requests from items ---

  function handleCreateRequests() {
    if (!project) return

    const itemsWithSupplier = project.items.filter(
      (item) => item.supplierId && item.status === 'pending'
    )

    if (itemsWithSupplier.length === 0) {
      toast({
        title: 'Нет позиций для запросов',
        description: 'Все позиции с поставщиком уже обработаны или поставщик не указан',
      })
      return
    }

    // Group by supplier
    const bySupplier: Record<string, { projectItemId: string; quantity: number; price: number }[]> = {}
    for (const item of itemsWithSupplier) {
      const sid = item.supplierId!
      if (!bySupplier[sid]) bySupplier[sid] = []
      bySupplier[sid].push({
        projectItemId: item.id,
        quantity: item.quantity,
        price: item.price,
      })
    }

    const requests = Object.entries(bySupplier).map(([supplierId, items]) => ({
      supplierId,
      items,
    }))

    createRequestsMutation.mutate(requests)
  }

  // --- Collapsible toggle helpers ---

  function toggleSupplier(key: string) {
    setExpandedSuppliers((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function toggleRequest(id: string) {
    setExpandedRequests((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function toggleInvoice(id: string) {
    setExpandedInvoices((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // --- Date formatting ---

  function formatDate(dateStr: string | null | undefined) {
    if (!dateStr) return '—'
    try {
      return new Date(dateStr).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateStr
    }
  }

  function formatShortDate(dateStr: string | null | undefined) {
    if (!dateStr) return '—'
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

  // --- Loading ---

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-9 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isError || !project) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <p className="text-destructive text-lg font-medium">Не удалось загрузить проект</p>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['project', selectedProjectId] })}
        >
          Попробовать снова
        </Button>
      </div>
    )
  }

  // --- Render ---

  const itemsBySupplier = getItemsBySupplier(project.items)
  const pendingItems = project.items.filter((i) => i.status === 'pending' && i.supplierId)
  const warehouseItems = project.items.filter((i) => i.isFromWarehouse)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('projects')}
            className="mt-0.5 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <StatusBadge status={project.status} map={PROJECT_STATUS_MAP} />
            </div>
            {project.customerName && (
              <p className="text-muted-foreground text-sm">
                Заказчик: {project.customerName}
              </p>
            )}
            {project.description && (
              <p className="text-muted-foreground text-sm">{project.description}</p>
            )}
            {project.fileName && (
              <p className="text-muted-foreground text-xs">
                Файл: {project.fileName}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={project.status}
            onValueChange={(value) => updateProjectStatus.mutate({ status: value })}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROJECT_STATUS_MAP).map(([value, { label }]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items" className="gap-1.5">
            <Package className="h-4 w-4" />
            Позиции
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {project.items.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-1.5">
            <Mail className="h-4 w-4" />
            Запросы
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {project.purchaseRequests.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Счета
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {project.invoices.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <History className="h-4 w-4" />
            История
          </TabsTrigger>
        </TabsList>

        {/* ===== Tab: Позиции ===== */}
        <TabsContent value="items" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleCreateRequests}
              disabled={pendingItems.length === 0 || createRequestsMutation.isPending}
            >
              {createRequestsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Создать запросы ({pendingItems.length})
            </Button>
            {warehouseItems.length > 0 && (
              <Button variant="outline" disabled>
                <PackageCheck className="h-4 w-4" />
                Взять со склада ({warehouseItems.length})
              </Button>
            )}
          </div>

          {project.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
              <Package className="text-muted-foreground h-12 w-12" />
              <p className="text-muted-foreground">Нет позиций в проекте</p>
            </div>
          ) : (
            <div className="space-y-2">
              {itemsBySupplier.map(([key, group]) => {
                const isOpen = expandedSuppliers[key] !== false
                const supplierName = group.supplier?.name ?? 'Без поставщика'

                return (
                  <Collapsible
                    key={key}
                    open={isOpen}
                    onOpenChange={() => toggleSupplier(key)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-4 py-2 cursor-pointer hover:bg-muted/70 transition-colors">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium text-sm">
                          {supplierName}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {group.items.length} поз.
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="rounded-md border border-t-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">№</TableHead>
                              <TableHead>Наименование</TableHead>
                              <TableHead>Артикул</TableHead>
                              <TableHead>Категория</TableHead>
                              <TableHead className="text-center">Кол-во</TableHead>
                              <TableHead>Ед.</TableHead>
                              <TableHead className="text-right">Цена</TableHead>
                              <TableHead>Статус</TableHead>
                              <TableHead>Примечание</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.items.map((item, idx) => (
                              <TableRow key={item.id}>
                                <TableCell className="text-muted-foreground text-xs">
                                  {item.rowNumber || idx + 1}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {item.name}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                  {item.article || '—'}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                  {item.category || '—'}
                                </TableCell>
                                <TableCell className="text-center">
                                  {item.quantity}
                                </TableCell>
                                <TableCell>{item.unit}</TableCell>
                                <TableCell className="text-right">
                                  {item.price > 0
                                    ? `${item.price.toLocaleString('ru-RU')} ₽`
                                    : '—'}
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={item.status}
                                    onValueChange={(value) =>
                                      updateItemStatus.mutate({
                                        itemId: item.id,
                                        status: value,
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-7 w-28 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(ITEM_STATUS_MAP).map(
                                        ([value, { label }]) => (
                                          <SelectItem key={value} value={value}>
                                            {label}
                                          </SelectItem>
                                        )
                                      )}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs max-w-32 truncate">
                                  {item.notes || '—'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ===== Tab: Запросы ===== */}
        <TabsContent value="requests" className="space-y-4">
          {project.purchaseRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
              <ShoppingCart className="text-muted-foreground h-12 w-12" />
              <div>
                <p className="text-lg font-medium">Нет запросов</p>
                <p className="text-muted-foreground text-sm">
                  Создайте запросы поставщикам из вкладки &laquo;Позиции&raquo;
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {project.purchaseRequests.map((request) => {
                const isOpen = expandedRequests[request.id] ?? false

                return (
                  <Collapsible
                    key={request.id}
                    open={isOpen}
                    onOpenChange={() => toggleRequest(request.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between rounded-md border px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {request.supplier.name}
                              </span>
                              <StatusBadge
                                status={request.status}
                                map={REQUEST_STATUS_MAP}
                              />
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {request.items.length} поз. • Создан{' '}
                              {formatShortDate(request.createdAt)}
                              {request.sentAt && ` • Отправлен ${formatShortDate(request.sentAt)}`}
                            </div>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {request.items.length} поз.
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="rounded-md border border-t-0">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Позиция</TableHead>
                              <TableHead className="text-center">Кол-во</TableHead>
                              <TableHead className="text-right">Цена</TableHead>
                              <TableHead>Доступно</TableHead>
                              <TableHead>Срок (дн.)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {request.items.map((ri) => (
                              <TableRow key={ri.id}>
                                <TableCell className="font-medium text-sm">
                                  {ri.projectItem.name}
                                </TableCell>
                                <TableCell className="text-center">
                                  {ri.quantity}
                                </TableCell>
                                <TableCell className="text-right">
                                  {ri.price > 0
                                    ? `${ri.price.toLocaleString('ru-RU')} ₽`
                                    : '—'}
                                </TableCell>
                                <TableCell>
                                  {ri.available ? (
                                    <Badge
                                      variant="outline"
                                      className="border-green-500 text-green-700 bg-green-50 text-xs"
                                    >
                                      Да ({ri.availableQty})
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-xs">
                                      Нет
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {ri.deliveryDays > 0 ? ri.deliveryDays : '—'}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {request.notes && (
                          <div className="border-t px-4 py-2">
                            <p className="text-muted-foreground text-xs">
                              Примечание: {request.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ===== Tab: Счета ===== */}
        <TabsContent value="invoices" className="space-y-4">
          {project.invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
              <FileText className="text-muted-foreground h-12 w-12" />
              <div>
                <p className="text-lg font-medium">Нет счетов</p>
                <p className="text-muted-foreground text-sm">
                  Счета от поставщиков появятся здесь
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {project.invoices.map((invoice) => {
                const isOpen = expandedInvoices[invoice.id] ?? false
                const allMatch = invoice.items.every((i) => i.isMatch)
                const hasMismatch = invoice.items.some((i) => !i.isMatch)

                return (
                  <Collapsible
                    key={invoice.id}
                    open={isOpen}
                    onOpenChange={() => toggleInvoice(invoice.id)}
                  >
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center justify-between rounded-md border px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {invoice.supplier.name}
                              </span>
                              {invoice.invoiceNumber && (
                                <span className="text-muted-foreground text-xs">
                                  #{invoice.invoiceNumber}
                                </span>
                              )}
                              <StatusBadge
                                status={invoice.status}
                                map={INVOICE_STATUS_MAP}
                              />
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {invoice.items.length} поз. •{' '}
                              {invoice.totalAmount.toLocaleString('ru-RU')} ₽ •{' '}
                              {formatShortDate(invoice.receivedAt)}
                            </div>
                          </div>
                        </div>
                        {invoice.status === 'verified' && (
                          <div className="flex items-center gap-1">
                            {allMatch ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : hasMismatch ? (
                              <XCircle className="h-4 w-4 text-red-500" />
                            ) : null}
                          </div>
                        )}
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="rounded-md border border-t-0">
                        <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/30">
                          <span className="text-sm font-medium">
                            Позиции счёта
                          </span>
                          {invoice.status === 'received' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                verifyInvoiceMutation.mutate(invoice.id)
                              }
                              disabled={verifyInvoiceMutation.isPending}
                            >
                              {verifyInvoiceMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3 w-3" />
                              )}
                              Проверить счёт
                            </Button>
                          )}
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-8" />
                              <TableHead>Наименование</TableHead>
                              <TableHead className="text-center">Кол-во</TableHead>
                              <TableHead className="text-right">Цена</TableHead>
                              <TableHead>Результат</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {invoice.items.map((ii) => (
                              <TableRow key={ii.id}>
                                <TableCell>
                                  {invoice.status === 'verified' ? (
                                    ii.isMatch ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <XCircle className="h-4 w-4 text-red-500" />
                                    )
                                  ) : (
                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </TableCell>
                                <TableCell className="font-medium text-sm">
                                  {ii.name}
                                </TableCell>
                                <TableCell className="text-center">
                                  {ii.quantity}
                                </TableCell>
                                <TableCell className="text-right">
                                  {ii.price.toLocaleString('ru-RU')} ₽
                                </TableCell>
                                <TableCell>
                                  {invoice.status === 'verified' ? (
                                    ii.isMatch ? (
                                      <Badge
                                        variant="outline"
                                        className="border-green-500 text-green-700 bg-green-50 text-xs"
                                      >
                                        Совпадает
                                      </Badge>
                                    ) : (
                                      <div className="flex flex-col gap-0.5">
                                        <Badge
                                          variant="outline"
                                          className="border-red-500 text-red-700 bg-red-50 text-xs w-fit"
                                        >
                                          Расхождение
                                        </Badge>
                                        {ii.mismatchReason && (
                                          <span className="text-red-600 text-[10px] leading-tight max-w-48">
                                            {ii.mismatchReason}
                                          </span>
                                        )}
                                      </div>
                                    )
                                  ) : (
                                    <span className="text-muted-foreground text-xs">
                                      Ожидает проверки
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {invoice.notes && (
                          <div className="border-t px-4 py-2">
                            <p className="text-muted-foreground text-xs">
                              Примечание: {invoice.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ===== Tab: История ===== */}
        <TabsContent value="history" className="space-y-4">
          {statusHistory.length === 0 && project.purchaseRequests.length === 0 && project.invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
              <History className="text-muted-foreground h-12 w-12" />
              <p className="text-muted-foreground">История изменений пуста</p>
            </div>
          ) : (
            <div className="relative space-y-0">
              {/* Combine status history, requests, and invoices into a timeline */}
              {[
                ...statusHistory.map((h) => ({
                  type: 'status' as const,
                  date: h.createdAt,
                  content: (
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <History className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          Статус:{' '}
                          <StatusBadge
                            status={h.status}
                            map={PROJECT_STATUS_MAP}
                          />
                        </p>
                        {h.notes && (
                          <p className="text-muted-foreground text-xs mt-0.5">
                            {h.notes}
                          </p>
                        )}
                        <p className="text-muted-foreground text-xs mt-0.5">
                          {formatDate(h.createdAt)}
                        </p>
                      </div>
                    </div>
                  ),
                })),
                ...project.purchaseRequests.map((r) => ({
                  type: 'request' as const,
                  date: r.createdAt,
                  content: (
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0 dark:bg-blue-950/30">
                        <Mail className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          Запрос: {r.supplier.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {r.items.length} позиций •{' '}
                          <StatusBadge
                            status={r.status}
                            map={REQUEST_STATUS_MAP}
                          />
                        </p>
                        <p className="text-muted-foreground text-xs mt-0.5">
                          {formatDate(r.createdAt)}
                        </p>
                      </div>
                    </div>
                  ),
                })),
                ...project.invoices.map((inv) => ({
                  type: 'invoice' as const,
                  date: inv.createdAt,
                  content: (
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 h-8 w-8 rounded-full bg-amber-50 flex items-center justify-center shrink-0 dark:bg-amber-950/30">
                        <FileText className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">
                          Счёт: {inv.supplier.name}
                          {inv.invoiceNumber && ` #${inv.invoiceNumber}`}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {inv.totalAmount.toLocaleString('ru-RU')} ₽ •{' '}
                          <StatusBadge
                            status={inv.status}
                            map={INVOICE_STATUS_MAP}
                          />
                        </p>
                        <p className="text-muted-foreground text-xs mt-0.5">
                          {formatDate(inv.createdAt)}
                        </p>
                      </div>
                    </div>
                  ),
                })),
              ]
                .sort(
                  (a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                )
                .map((entry, idx) => (
                  <div key={idx} className="flex gap-4 pb-4">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <div className="w-px flex-1 bg-border" />
                    </div>
                    <div className="pb-2">{entry.content}</div>
                  </div>
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
