'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { Separator } from '@/components/ui/separator'
import {
  Plus,
  Filter,
  ChevronDown,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CreditCard,
  Loader2,
  Trash2,
  Search,
  Receipt,
  PlusCircle,
} from 'lucide-react'
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
}

interface ProjectItem {
  id: string
  name: string
  quantity: number
  unit: string
  price: number
}

interface InvoiceItem {
  id: string
  invoiceId: string
  projectItemId: string | null
  name: string
  quantity: number
  price: number
  isMatch: boolean
  mismatchReason: string
  projectItem: ProjectItem | null
}

interface Invoice {
  id: string
  projectId: string
  supplierId: string
  invoiceNumber: string
  totalAmount: number
  status: string
  receivedAt: string
  paidAt: string | null
  notes: string
  createdAt: string
  updatedAt: string
  project: { id: string; name: string }
  supplier: { id: string; name: string }
  items: InvoiceItem[]
}

interface InvoiceListItem {
  id: string
  projectId: string
  supplierId: string
  invoiceNumber: string
  totalAmount: number
  status: string
  receivedAt: string
  paidAt: string | null
  notes: string
  createdAt: string
  updatedAt: string
  project: { id: string; name: string }
  supplier: { id: string; name: string }
  _count: { items: number }
}

// ── Status helpers ─────────────────────────────────────────

const INVOICE_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  received: { label: 'Получен', variant: 'secondary', className: 'rounded-full' },
  verified: { label: 'Проверен', variant: 'default', className: 'rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950/30 dark:text-sky-400 border-sky-200 dark:border-sky-800' },
  discrepancy: { label: 'Расхождение', variant: 'destructive', className: 'rounded-full' },
  approved: { label: 'Одобрен', variant: 'default', className: 'rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800' },
  paid: { label: 'Оплачен', variant: 'default', className: 'rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800' },
  cancelled: { label: 'Отменён', variant: 'destructive', className: 'rounded-full' },
}

function StatusBadge({ status }: { status: string }) {
  const info = INVOICE_STATUS_MAP[status] || { label: status, variant: 'outline' as const, className: 'rounded-full' }
  return <Badge variant={info.variant} className={info.className}>{info.label}</Badge>
}

// ── New invoice item type ──────────────────────────────────

interface NewInvoiceItem {
  name: string
  quantity: number
  price: number
  projectItemId: string | null
}

// ── Main Component ─────────────────────────────────────────

export function Invoices() {
  const queryClient = useQueryClient()

  // Filters
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [newProjectId, setNewProjectId] = useState('')
  const [newSupplierId, setNewSupplierId] = useState('')
  const [newInvoiceNumber, setNewInvoiceNumber] = useState('')
  const [newTotalAmount, setNewTotalAmount] = useState<number>(0)
  const [newItems, setNewItems] = useState<NewInvoiceItem[]>([
    { name: '', quantity: 1, price: 0, projectItemId: null },
  ])

  // Payment dialog
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentInvoiceId, setPaymentInvoiceId] = useState('')

  // Detail dialog (for verified invoices)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null)

  // Cancel dialog
  const [cancelId, setCancelId] = useState<string | null>(null)

  // ── Queries ────────────────────────────────────────────────

  const { data: invoicesList = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', projectFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (projectFilter && projectFilter !== 'all') params.set('projectId', projectFilter)
      const res = await fetch(`/api/invoices?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch invoices')
      return res.json() as Promise<InvoiceListItem[]>
    },
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects')
      if (!res.ok) throw new Error('Failed to fetch projects')
      return res.json() as Promise<Project[]>
    },
  })

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const res = await fetch('/api/suppliers')
      if (!res.ok) throw new Error('Failed to fetch suppliers')
      return res.json() as Promise<Supplier[]>
    },
  })

  const { data: projectDetail } = useQuery({
    queryKey: ['project', newProjectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${newProjectId}`)
      if (!res.ok) throw new Error('Failed to fetch project')
      return res.json() as Promise<Project & { items: ProjectItem[] }>
    },
    enabled: !!newProjectId,
  })

  // ── Filtered invoices by search ────────────────────────────

  const filteredInvoices = useMemo(() => {
    if (!searchQuery.trim()) return invoicesList
    const q = searchQuery.toLowerCase().trim()
    return invoicesList.filter(
      (inv) =>
        inv.supplier.name.toLowerCase().includes(q) ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.project.name.toLowerCase().includes(q)
    )
  }, [invoicesList, searchQuery])

  // ── Mutations ──────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (data: {
      projectId: string
      supplierId: string
      invoiceNumber: string
      totalAmount: number
      items: { projectItemId?: string; name: string; quantity: number; price: number }[]
    }) => {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create invoice')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast({ title: 'Счёт создан', description: 'Счёт от поставщика успешно добавлен' })
      resetCreateDialog()
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update invoice')
      }
      return res.json()
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      // If we just verified, show the detail
      if (result && result.status === 'verified') {
        setDetailInvoice(result as Invoice)
        setDetailOpen(true)
      }
      toast({ title: 'Счёт обновлён' })
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' })
    },
  })

  // ── Helpers ────────────────────────────────────────────────

  const resetCreateDialog = useCallback(() => {
    setNewProjectId('')
    setNewSupplierId('')
    setNewInvoiceNumber('')
    setNewTotalAmount(0)
    setNewItems([{ name: '', quantity: 1, price: 0, projectItemId: null }])
    setCreateOpen(false)
  }, [])

  const addNewItem = () => {
    setNewItems([...newItems, { name: '', quantity: 1, price: 0, projectItemId: null }])
  }

  const removeNewItem = (idx: number) => {
    if (newItems.length <= 1) return
    setNewItems(newItems.filter((_, i) => i !== idx))
  }

  const updateNewItem = (idx: number, field: keyof NewInvoiceItem, value: string | number | null) => {
    setNewItems(
      newItems.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    )
  }

  const handleCreate = () => {
    const validItems = newItems.filter((item) => item.name.trim() !== '')
    if (validItems.length === 0) {
      toast({ title: 'Ошибка', description: 'Добавьте хотя бы одну позицию', variant: 'destructive' })
      return
    }
    createMutation.mutate({
      projectId: newProjectId,
      supplierId: newSupplierId,
      invoiceNumber: newInvoiceNumber,
      totalAmount: newTotalAmount,
      items: validItems.map((item) => ({
        projectItemId: item.projectItemId || undefined,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
    })
  }

  const handleVerify = (id: string) => {
    updateMutation.mutate({ id, data: { status: 'verified' } })
  }

  const handleApprove = (id: string) => {
    updateMutation.mutate({ id, data: { status: 'approved' } })
  }

  const handlePay = () => {
    updateMutation.mutate({
      id: paymentInvoiceId,
      data: { status: 'paid', paidAt: new Date().toISOString() },
    })
    setPaymentOpen(false)
  }

  const handleCancel = (id: string) => {
    updateMutation.mutate({ id, data: { status: 'cancelled' } })
    setCancelId(null)
  }

  const fetchDetail = async (id: string) => {
    const res = await fetch(`/api/invoices/${id}`)
    if (!res.ok) throw new Error('Failed to fetch invoice')
    return res.json() as Promise<Invoice>
  }

  const openDetail = async (invoice: InvoiceListItem) => {
    const detail = await fetchDetail(invoice.id)
    setDetailInvoice(detail)
    setDetailOpen(true)
  }

  const formatDate = (d: string | null) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const formatAmount = (n: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(n)

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative -mx-6 -mt-6 px-6 pt-6 pb-5 bg-gradient-to-b from-amber-500/5 via-amber-500/[0.02] to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm">Управление входящими счетами</p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.02]">
            <Plus className="mr-2 h-4 w-4" />
            Новый счёт
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Фильтр:</span>
            </div>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[220px]">
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
                placeholder="Поиск по поставщику, № счёта или проекту..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          {invoicesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Загрузка...</span>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <EmptyState
              type={searchQuery ? 'search' : 'invoices'}
              action={
                !searchQuery
                  ? {
                      label: 'Новый счёт',
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
                  <TableHead className="hidden md:table-cell">№ счёта</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="hidden lg:table-cell">Дата</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((inv) => (
                  <TableRow
                    key={inv.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors duration-150"
                    onClick={() => openDetail(inv)}
                  >
                    <TableCell>
                      <ChevronDown className="h-4 w-4" />
                    </TableCell>
                    <TableCell className="font-medium">{inv.project.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">{inv.supplier.name}</TableCell>
                    <TableCell className="hidden md:table-cell">{inv.invoiceNumber || '—'}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-sm">
                      {formatAmount(inv.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{formatDate(inv.receivedAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {inv.status === 'received' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleVerify(inv.id)}
                            disabled={updateMutation.isPending}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Проверить
                          </Button>
                        )}
                        {(inv.status === 'verified' || inv.status === 'discrepancy') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprove(inv.id)}
                            disabled={updateMutation.isPending}
                          >
                            Одобрить
                          </Button>
                        )}
                        {inv.status === 'approved' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPaymentInvoiceId(inv.id)
                              setPaymentOpen(true)
                            }}
                          >
                            <CreditCard className="mr-1 h-3 w-3" />
                            Оплатить
                          </Button>
                        )}
                        {inv.status !== 'cancelled' && inv.status !== 'paid' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setCancelId(inv.id)}
                          >
                            Отменить
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Create Invoice Dialog ──────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) resetCreateDialog() }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новый счёт от поставщика</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Project & Supplier */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Проект</Label>
                <Select value={newProjectId} onValueChange={setNewProjectId}>
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
              </div>
              <div className="space-y-2">
                <Label>Поставщик</Label>
                <Select value={newSupplierId} onValueChange={setNewSupplierId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите поставщика" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Invoice number & amount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Номер счёта</Label>
                <Input
                  value={newInvoiceNumber}
                  onChange={(e) => setNewInvoiceNumber(e.target.value)}
                  placeholder="№ счёта"
                />
              </div>
              <div className="space-y-2">
                <Label>Общая сумма</Label>
                <Input
                  type="number"
                  value={newTotalAmount || ''}
                  onChange={(e) => setNewTotalAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
              </div>
            </div>

            <Separator />

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Позиции счёта</Label>
                <Button size="sm" variant="outline" onClick={addNewItem}>
                  <Plus className="mr-1 h-3 w-3" />
                  Добавить
                </Button>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {newItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4">
                      {idx === 0 && <Label className="text-xs text-muted-foreground">Наименование</Label>}
                      <Input
                        value={item.name}
                        onChange={(e) => updateNewItem(idx, 'name', e.target.value)}
                        placeholder="Наименование"
                      />
                    </div>
                    <div className="col-span-2">
                      {idx === 0 && <Label className="text-xs text-muted-foreground">Кол-во</Label>}
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateNewItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-2">
                      {idx === 0 && <Label className="text-xs text-muted-foreground">Цена</Label>}
                      <Input
                        type="number"
                        value={item.price}
                        onChange={(e) => updateNewItem(idx, 'price', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-3">
                      {idx === 0 && <Label className="text-xs text-muted-foreground">Позиция проекта</Label>}
                      <Select
                        value={item.projectItemId || 'none'}
                        onValueChange={(val) =>
                          updateNewItem(idx, 'projectItemId', val === 'none' ? null : val)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Не привязана" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Не привязана</SelectItem>
                          {projectDetail?.items?.map((pi) => (
                            <SelectItem key={pi.id} value={pi.id}>
                              {pi.name} ({pi.quantity} {pi.unit})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive h-9 w-9 p-0"
                        onClick={() => removeNewItem(idx)}
                        disabled={newItems.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button
              type="button"
              onClick={handleCreate}
              disabled={
                createMutation.isPending ||
                !newProjectId ||
                !newSupplierId ||
                newItems.every((i) => !i.name.trim())
              }
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Создать счёт
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Invoice Detail Dialog ──────────────────────────── */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Счёт {detailInvoice?.invoiceNumber ? `№ ${detailInvoice.invoiceNumber}` : ''}
            </DialogTitle>
          </DialogHeader>
          {detailInvoice && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Проект</p>
                  <p className="font-medium">{detailInvoice.project.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Поставщик</p>
                  <p className="font-medium">{detailInvoice.supplier.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Сумма</p>
                  <p className="font-medium">{formatAmount(detailInvoice.totalAmount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Статус</p>
                  <StatusBadge status={detailInvoice.status} />
                </div>
              </div>

              <Separator />

              {/* Items with match status */}
              <div>
                <h4 className="text-sm font-semibold mb-2">Позиции счёта</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Наименование</TableHead>
                      <TableHead className="text-center">Кол-во</TableHead>
                      <TableHead className="text-right">Цена</TableHead>
                      <TableHead className="text-center">Совпадение</TableHead>
                      <TableHead>Причина расхождения</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailInvoice.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div>
                            <p>{item.name}</p>
                            {item.projectItem && (
                              <p className="text-xs text-muted-foreground">
                                Проект: {item.projectItem.name} ({item.projectItem.quantity} {item.projectItem.unit})
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">
                          {item.price > 0 ? formatAmount(item.price) : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          {detailInvoice.status === 'verified' ||
                          detailInvoice.status === 'discrepancy' ||
                          detailInvoice.status === 'approved' ||
                          detailInvoice.status === 'paid' ? (
                            item.isMatch ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                            )
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.mismatchReason ? (
                            <span className="text-xs text-red-600 dark:text-red-400">
                              {item.mismatchReason}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mismatch summary */}
              {(detailInvoice.status === 'verified' || detailInvoice.status === 'discrepancy') && (
                <>
                  <Separator />
                  <div
                    className={`rounded-md p-3 ${
                      detailInvoice.items.every((i) => i.isMatch)
                        ? 'bg-green-50 dark:bg-green-900/20'
                        : 'bg-red-50 dark:bg-red-900/20'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {detailInvoice.items.every((i) => i.isMatch) ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {detailInvoice.items.every((i) => i.isMatch)
                            ? 'Все позиции совпадают'
                            : 'Обнаружены расхождения'}
                        </p>
                        {!detailInvoice.items.every((i) => i.isMatch) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {detailInvoice.items.filter((i) => !i.isMatch).length} из{' '}
                            {detailInvoice.items.length} позиций не совпадают
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Action buttons */}
              <Separator />
              <div className="flex flex-wrap gap-2">
                {detailInvoice.status === 'received' && (
                  <Button
                    onClick={() => {
                      handleVerify(detailInvoice.id)
                      setDetailOpen(false)
                    }}
                    disabled={updateMutation.isPending}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Проверить
                  </Button>
                )}
                {(detailInvoice.status === 'verified' || detailInvoice.status === 'discrepancy') && (
                  <Button
                    onClick={() => {
                      handleApprove(detailInvoice.id)
                      setDetailOpen(false)
                    }}
                    disabled={updateMutation.isPending}
                  >
                    Одобрить
                  </Button>
                )}
                {detailInvoice.status === 'approved' && (
                  <Button
                    onClick={() => {
                      setPaymentInvoiceId(detailInvoice.id)
                      setPaymentOpen(true)
                    }}
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Оплатить
                  </Button>
                )}
                {detailInvoice.status !== 'cancelled' && detailInvoice.status !== 'paid' && (
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setCancelId(detailInvoice.id)
                      setDetailOpen(false)
                    }}
                  >
                    Отменить
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Payment Dialog ─────────────────────────────────── */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Подтверждение оплаты</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Отметить счёт как оплаченный? Дата оплаты будет установлена автоматически.
            </p>
            <div className="rounded-md bg-muted p-3 text-sm">
              <p>Дата оплаты: {new Date().toLocaleDateString('ru-RU')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)}>
              Отмена
            </Button>
            <Button type="button" onClick={handlePay} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <CreditCard className="mr-2 h-4 w-4" />
              Подтвердить оплату
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Confirmation ────────────────────────────── */}
      <AlertDialog open={!!cancelId} onOpenChange={(open) => !open && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить счёт?</AlertDialogTitle>
            <AlertDialogDescription>
              Счёт будет помечен как отменённый. Это действие нельзя отменить.
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
