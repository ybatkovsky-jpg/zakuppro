'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
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
} from 'lucide-react'

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

const REQUEST_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Черновик', variant: 'secondary' },
  sent: { label: 'Отправлен', variant: 'default' },
  responded: { label: 'Ответ получен', variant: 'default' },
  partial: { label: 'Частичный ответ', variant: 'outline' },
  cancelled: { label: 'Отменён', variant: 'destructive' },
}

function StatusBadge({ status }: { status: string }) {
  const info = REQUEST_STATUS_MAP[status] || { label: status, variant: 'outline' as const }
  return <Badge variant={info.variant}>{info.label}</Badge>
}

// ── Main Component ─────────────────────────────────────────

export function Requests() {
  const queryClient = useQueryClient()

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')

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

  // ── Queries ────────────────────────────────────────────────

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['requests', statusFilter, supplierFilter],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (supplierFilter && supplierFilter !== 'all') params.set('supplierId', supplierFilter)
      const res = await fetch(`/api/requests?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch requests')
      return res.json() as Promise<PurchaseRequest[]>
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
    queryKey: ['project', selectedProjectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${selectedProjectId}`)
      if (!res.ok) throw new Error('Failed to fetch project')
      return res.json() as Promise<Project & { items: ProjectItem[] }>
    },
    enabled: !!selectedProjectId,
  })

  const { data: companyData } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const res = await fetch('/api/company')
      if (!res.ok) throw new Error('Failed to fetch company')
      return res.json() as Promise<{ companyName: string; inn: string; email: string; phone: string }>
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
      const res = await fetch('/api/requests', {
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
      const res = await fetch(`/api/requests/${id}`, {
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

  const formatDate = (d: string | null) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // ── Step labels ────────────────────────────────────────────

  const stepLabels = ['Проект', 'Поставщик', 'Позиции', 'Письмо', 'Проверка']

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">Управление запросами на закупку</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Новый запрос
        </Button>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Фильтры:</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                <SelectItem value="draft">Черновик</SelectItem>
                <SelectItem value="sent">Отправлен</SelectItem>
                <SelectItem value="responded">Ответ получен</SelectItem>
                <SelectItem value="partial">Частичный ответ</SelectItem>
                <SelectItem value="cancelled">Отменён</SelectItem>
              </SelectContent>
            </Select>
            <Select value={supplierFilter} onValueChange={setSupplierFilter}>
              <SelectTrigger className="w-[200px]">
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
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardContent className="p-0">
          {requestsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Загрузка...</span>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mb-2" />
              <p>Запросы не найдены</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Проект</TableHead>
                  <TableHead>Поставщик</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-center">Позиций</TableHead>
                  <TableHead>Отправлено</TableHead>
                  <TableHead>Ответ получен</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <>
                    <TableRow
                      key={req.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedId(expandedId === req.id ? null : req.id)}
                    >
                      <TableCell>
                        {expandedId === req.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{req.project.name}</TableCell>
                      <TableCell>{req.supplier.name}</TableCell>
                      <TableCell>
                        <StatusBadge status={req.status} />
                      </TableCell>
                      <TableCell className="text-center">{req.items.length}</TableCell>
                      <TableCell>{formatDate(req.sentAt)}</TableCell>
                      <TableCell>{formatDate(req.responseAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {req.status === 'draft' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMarkSent(req.id)}
                              disabled={updateMutation.isPending}
                            >
                              <Send className="mr-1 h-3 w-3" />
                              Отправить
                            </Button>
                          )}
                          {(req.status === 'sent' || req.status === 'partial') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openResponseDialog(req)}
                            >
                              <MessageSquare className="mr-1 h-3 w-3" />
                              Записать ответ
                            </Button>
                          )}
                          {req.status !== 'cancelled' && req.status !== 'responded' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
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
                        <TableCell colSpan={8} className="bg-muted/30 p-4">
                          <div className="space-y-4">
                            {/* Items */}
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Позиции запроса</h4>
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Наименование</TableHead>
                                    <TableHead>Артикул</TableHead>
                                    <TableHead className="text-center">Кол-во</TableHead>
                                    <TableHead className="text-right">Цена</TableHead>
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
                            {/* Email preview */}
                            {req.emailTo && (
                              <>
                                <Separator />
                                <div>
                                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                                    <Mail className="h-4 w-4" />
                                    Email
                                  </h4>
                                  <div className="text-sm space-y-1 bg-background rounded-md p-3 border">
                                    <p><span className="text-muted-foreground">Кому:</span> {req.emailTo}</p>
                                    <p><span className="text-muted-foreground">Тема:</span> {req.emailSubject}</p>
                                    <div className="mt-2 whitespace-pre-wrap text-muted-foreground text-xs max-h-40 overflow-y-auto">
                                      {req.emailBody}
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

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
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                    i + 1 <= step
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </div>
                {i < stepLabels.length - 1 && (
                  <div
                    className={`h-0.5 w-6 ${
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
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Назад
              </Button>
            )}
            {step < 5 ? (
              <Button
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
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
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
            <Button variant="outline" onClick={() => setResponseOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleRecordResponse} disabled={updateMutation.isPending}>
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
              Запрос будет помечен как отменённый. Это действие нельзя отменить.
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
