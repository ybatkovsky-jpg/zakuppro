'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  ArrowUpDown,
  Package,
  Warehouse as WarehouseIcon,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Clock,
  FileText,
} from 'lucide-react'

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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

// === Types ===
interface WarehouseItem {
  id: string
  name: string
  article: string
  category: string
  quantity: number
  minQuantity: number
  unit: string
  location: string
  createdAt: string
  updatedAt: string
}

interface WarehouseTransaction {
  id: string
  warehouseItemId: string
  projectItemId: string | null
  type: 'in' | 'out'
  quantity: number
  notes: string
  createdAt: string
  warehouseItem: {
    id: string
    name: string
    article: string
  }
  projectItem: {
    id: string
    name: string
    project: { id: string; name: string }
  } | null
}

interface ItemFormData {
  name: string
  article: string
  category: string
  quantity: number
  minQuantity: number
  unit: string
  location: string
}

interface TransactionFormData {
  type: 'in' | 'out'
  quantity: number
  notes: string
}

const emptyItemForm: ItemFormData = {
  name: '',
  article: '',
  category: '',
  quantity: 0,
  minQuantity: 0,
  unit: 'шт',
  location: '',
}

const emptyTransactionForm: TransactionFormData = {
  type: 'in',
  quantity: 1,
  notes: '',
}

// === API Functions ===
async function fetchWarehouseItems(search: string): Promise<WarehouseItem[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  const res = await fetch(`/api/warehouse?${params.toString()}`)
  if (!res.ok) throw new Error('Ошибка загрузки складских позиций')
  return res.json()
}

async function createWarehouseItem(data: ItemFormData): Promise<WarehouseItem> {
  const res = await fetch('/api/warehouse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Ошибка создания позиции')
  }
  return res.json()
}

async function updateWarehouseItem({ id, data }: { id: string; data: Partial<ItemFormData> }): Promise<WarehouseItem> {
  const res = await fetch(`/api/warehouse/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Ошибка обновления позиции')
  }
  return res.json()
}

async function deleteWarehouseItem(id: string): Promise<void> {
  const res = await fetch(`/api/warehouse/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Ошибка удаления позиции')
  }
}

async function fetchTransactions(): Promise<WarehouseTransaction[]> {
  const res = await fetch('/api/warehouse/transactions')
  if (!res.ok) throw new Error('Ошибка загрузки транзакций')
  return res.json()
}

async function createTransaction(data: {
  warehouseItemId: string
  type: string
  quantity: number
  notes: string
}): Promise<WarehouseTransaction> {
  const res = await fetch('/api/warehouse/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Ошибка создания транзакции')
  }
  return res.json()
}

// === Utility ===
function formatDate(dateStr: string): string {
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

// === Sub-components ===

function ItemFormFields({
  form,
  onChange,
}: {
  form: ItemFormData
  onChange: (field: keyof ItemFormData, value: string | number) => void
}) {
  return (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label htmlFor="item-name">
          Наименование <span className="text-destructive">*</span>
        </Label>
        <Input
          id="item-name"
          placeholder="Название товара/материала"
          value={form.name}
          onChange={(e) => onChange('name', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="article">Артикул</Label>
          <Input
            id="article"
            placeholder="Артикул"
            value={form.article}
            onChange={(e) => onChange('article', e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="category">Категория</Label>
          <Input
            id="category"
            placeholder="Категория"
            value={form.category}
            onChange={(e) => onChange('category', e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="quantity">Количество</Label>
          <Input
            id="quantity"
            type="number"
            min={0}
            value={form.quantity}
            onChange={(e) => onChange('quantity', parseInt(e.target.value) || 0)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="minQuantity">Мин. остаток</Label>
          <Input
            id="minQuantity"
            type="number"
            min={0}
            value={form.minQuantity}
            onChange={(e) => onChange('minQuantity', parseInt(e.target.value) || 0)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="unit">Ед. изм.</Label>
          <Input
            id="unit"
            placeholder="шт"
            value={form.unit}
            onChange={(e) => onChange('unit', e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="location">Место</Label>
          <Input
            id="location"
            placeholder="Стеллаж/полка"
            value={form.location}
            onChange={(e) => onChange('location', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

function StatusBadge({ item }: { item: WarehouseItem }) {
  if (item.quantity <= 0) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        Нет в наличии
      </Badge>
    )
  }
  if (item.minQuantity > 0 && item.quantity < item.minQuantity) {
    return (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25 gap-1">
        <AlertTriangle className="h-3 w-3" />
        Мало
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Package className="h-3 w-3" />
      В наличии
    </Badge>
  )
}

function TransactionFormFields({
  form,
  onChange,
  itemName,
  currentQuantity,
}: {
  form: TransactionFormData
  onChange: (field: keyof TransactionFormData, value: string | number) => void
  itemName: string
  currentQuantity: number
}) {
  return (
    <div className="grid gap-4 py-2">
      <div className="rounded-md bg-muted p-3 text-sm">
        <span className="text-muted-foreground">Товар:</span>{' '}
        <span className="font-medium">{itemName}</span>
        <br />
        <span className="text-muted-foreground">Текущий остаток:</span>{' '}
        <span className="font-medium">{currentQuantity} шт</span>
      </div>
      <div className="grid gap-2">
        <Label>Тип операции</Label>
        <Select
          value={form.type}
          onValueChange={(val) => onChange('type', val)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="in">
              <span className="flex items-center gap-2">
                <ArrowDownCircle className="h-4 w-4 text-emerald-600" />
                Приход
              </span>
            </SelectItem>
            <SelectItem value="out">
              <span className="flex items-center gap-2">
                <ArrowUpCircle className="h-4 w-4 text-red-600" />
                Расход
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="txn-quantity">Количество</Label>
        <Input
          id="txn-quantity"
          type="number"
          min={1}
          max={form.type === 'out' ? currentQuantity : undefined}
          value={form.quantity}
          onChange={(e) => onChange('quantity', parseInt(e.target.value) || 0)}
        />
        {form.type === 'out' && form.quantity > currentQuantity && (
          <p className="text-sm text-destructive">
            Недостаточно на складе. Доступно: {currentQuantity}
          </p>
        )}
      </div>
      <div className="grid gap-2">
        <Label htmlFor="txn-notes">Примечания</Label>
        <Textarea
          id="txn-notes"
          placeholder="Причина движения"
          value={form.notes}
          onChange={(e) => onChange('notes', e.target.value)}
          rows={2}
        />
      </div>
    </div>
  )
}

// === Main Component ===
export function Warehouse() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // State
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [transactionOpen, setTransactionOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState<WarehouseItem | null>(null)
  const [itemForm, setItemForm] = useState<ItemFormData>(emptyItemForm)
  const [txnForm, setTxnForm] = useState<TransactionFormData>(emptyTransactionForm)
  const [formError, setFormError] = useState('')
  const [txnError, setTxnError] = useState('')

  // Queries
  const {
    data: items = [],
    isLoading: itemsLoading,
    isError: itemsError,
  } = useQuery({
    queryKey: ['warehouse', search],
    queryFn: () => fetchWarehouseItems(search),
  })

  const {
    data: transactions = [],
    isLoading: txnLoading,
  } = useQuery({
    queryKey: ['warehouse-transactions'],
    queryFn: fetchTransactions,
  })

  // Derived data
  const lowStockItems = useMemo(
    () => items.filter((item) => item.minQuantity > 0 && item.quantity < item.minQuantity),
    [items]
  )

  const recentTransactions = useMemo(
    () => transactions.slice(0, 10),
    [transactions]
  )

  // Mutations
  const createItemMutation = useMutation({
    mutationFn: createWarehouseItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse'] })
      toast({ title: 'Позиция создана', description: 'Новая складская позиция добавлена' })
      closeAddDialog()
    },
    onError: (error: Error) => {
      setFormError(error.message)
    },
  })

  const updateItemMutation = useMutation({
    mutationFn: updateWarehouseItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse'] })
      toast({ title: 'Позиция обновлена', description: 'Данные позиции сохранены' })
      closeEditDialog()
    },
    onError: (error: Error) => {
      setFormError(error.message)
    },
  })

  const deleteItemMutation = useMutation({
    mutationFn: deleteWarehouseItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse'] })
      queryClient.invalidateQueries({ queryKey: ['warehouse-transactions'] })
      toast({ title: 'Позиция удалена', description: 'Складская позиция удалена' })
      setDeleteOpen(false)
      setSelectedItem(null)
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' })
    },
  })

  const createTransactionMutation = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse'] })
      queryClient.invalidateQueries({ queryKey: ['warehouse-transactions'] })
      toast({
        title: txnForm.type === 'in' ? 'Приход оформлен' : 'Расход оформлен',
        description: `Движение товара учтено`,
      })
      closeTransactionDialog()
    },
    onError: (error: Error) => {
      setTxnError(error.message)
    },
  })

  // Handlers
  const handleItemFormChange = useCallback((field: keyof ItemFormData, value: string | number) => {
    setItemForm((prev) => ({ ...prev, [field]: value }))
    setFormError('')
  }, [])

  const handleTxnFormChange = useCallback((field: keyof TransactionFormData, value: string | number) => {
    setTxnForm((prev) => ({ ...prev, [field]: value }))
    setTxnError('')
  }, [])

  const openAddDialog = useCallback(() => {
    setItemForm(emptyItemForm)
    setFormError('')
    setAddOpen(true)
  }, [])

  const closeAddDialog = useCallback(() => {
    setAddOpen(false)
    setItemForm(emptyItemForm)
    setFormError('')
  }, [])

  const openEditDialog = useCallback((item: WarehouseItem) => {
    setItemForm({
      name: item.name,
      article: item.article,
      category: item.category,
      quantity: item.quantity,
      minQuantity: item.minQuantity,
      unit: item.unit,
      location: item.location,
    })
    setFormError('')
    setSelectedItem(item)
    setEditOpen(true)
  }, [])

  const closeEditDialog = useCallback(() => {
    setEditOpen(false)
    setSelectedItem(null)
    setItemForm(emptyItemForm)
    setFormError('')
  }, [])

  const openDeleteDialog = useCallback((item: WarehouseItem) => {
    setSelectedItem(item)
    setDeleteOpen(true)
  }, [])

  const openTransactionDialog = useCallback((item: WarehouseItem) => {
    setSelectedItem(item)
    setTxnForm(emptyTransactionForm)
    setTxnError('')
    setTransactionOpen(true)
  }, [])

  const closeTransactionDialog = useCallback(() => {
    setTransactionOpen(false)
    setSelectedItem(null)
    setTxnForm(emptyTransactionForm)
    setTxnError('')
  }, [])

  const handleAddSubmit = useCallback(() => {
    if (!itemForm.name.trim()) {
      setFormError('Название позиции обязательно')
      return
    }
    createItemMutation.mutate(itemForm)
  }, [itemForm, createItemMutation])

  const handleEditSubmit = useCallback(() => {
    if (!selectedItem) return
    if (!itemForm.name.trim()) {
      setFormError('Название позиции обязательно')
      return
    }
    updateItemMutation.mutate({ id: selectedItem.id, data: itemForm })
  }, [itemForm, selectedItem, updateItemMutation])

  const handleDeleteConfirm = useCallback(() => {
    if (!selectedItem) return
    deleteItemMutation.mutate(selectedItem.id)
  }, [selectedItem, deleteItemMutation])

  const handleTransactionSubmit = useCallback(() => {
    if (!selectedItem) return
    if (!txnForm.quantity || txnForm.quantity <= 0) {
      setTxnError('Количество должно быть больше 0')
      return
    }
    if (txnForm.type === 'out' && txnForm.quantity > selectedItem.quantity) {
      setTxnError(`Недостаточно на складе. Доступно: ${selectedItem.quantity}`)
      return
    }
    createTransactionMutation.mutate({
      warehouseItemId: selectedItem.id,
      type: txnForm.type,
      quantity: txnForm.quantity,
      notes: txnForm.notes,
    })
  }, [selectedItem, txnForm, createTransactionMutation])

  // Render
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">
            Управление складскими запасами и движением товаров
          </p>
        </div>
        <Button onClick={openAddDialog} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Добавить на склад
        </Button>
      </div>

      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-base text-amber-800 dark:text-amber-300">
                Низкий остаток ({lowStockItems.length})
              </CardTitle>
            </div>
            <CardDescription className="text-amber-700/80 dark:text-amber-400/80">
              Следующие позиции ниже минимального остатка
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-md border border-amber-500/20 bg-background px-3 py-2"
                >
                  <div className="min-w-0 flex-1 mr-2">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    {item.article && (
                      <p className="text-xs text-muted-foreground">{item.article}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                      {item.quantity} / {item.minQuantity} {item.unit}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию, артикулу, категории..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Warehouse Table */}
      {itemsLoading ? (
        <TableSkeleton />
      ) : itemsError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <WarehouseIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Ошибка загрузки</h3>
            <p className="text-muted-foreground mt-1">
              Не удалось загрузить складские позиции. Попробуйте обновить страницу.
            </p>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <WarehouseIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">
              {search ? 'Ничего не найдено' : 'Склад пуст'}
            </h3>
            <p className="text-muted-foreground mt-1">
              {search
                ? 'Попробуйте изменить параметры поиска'
                : 'Добавьте первую позицию, нажав кнопку выше'}
            </p>
            {!search && (
              <Button onClick={openAddDialog} variant="outline" className="mt-4 gap-2">
                <Plus className="h-4 w-4" />
                Добавить на склад
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Наименование</TableHead>
                  <TableHead>Артикул</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead className="text-right">Количество</TableHead>
                  <TableHead className="text-right">Мин. остаток</TableHead>
                  <TableHead>Ед.</TableHead>
                  <TableHead>Место</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isLow = item.minQuantity > 0 && item.quantity < item.minQuantity
                  const isOut = item.quantity <= 0
                  return (
                    <TableRow
                      key={item.id}
                      className={isOut ? 'bg-destructive/5' : isLow ? 'bg-amber-500/5' : ''}
                    >
                      <TableCell className="font-medium max-w-[200px] truncate" title={item.name}>
                        {item.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.article || '—'}</TableCell>
                      <TableCell>
                        {item.category ? (
                          <Badge variant="outline" className="font-normal">{item.category}</Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-medium ${isOut ? 'text-destructive' : isLow ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {item.minQuantity || '—'}
                      </TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[120px] truncate" title={item.location}>
                        {item.location || '—'}
                      </TableCell>
                      <TableCell>
                        <StatusBadge item={item} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openTransactionDialog(item)}
                              >
                                <ArrowUpDown className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Движение</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditDialog(item)}
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
                                onClick={() => openDeleteDialog(item)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Удалить</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      )}

      {/* Recent Transactions */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Последние операции</h3>
        </div>
        {txnLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : recentTransactions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Нет операций на складе</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <ScrollArea className="max-h-[400px]">
              <div className="divide-y">
                {recentTransactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {txn.type === 'in' ? (
                        <ArrowDownCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                      ) : (
                        <ArrowUpCircle className="h-5 w-5 text-red-600 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {txn.warehouseItem.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {txn.warehouseItem.article && `${txn.warehouseItem.article} · `}
                          {formatDate(txn.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      {txn.projectItem && (
                        <Badge variant="outline" className="font-normal text-xs hidden sm:inline-flex">
                          {txn.projectItem.project.name}
                        </Badge>
                      )}
                      <span
                        className={`text-sm font-mono font-medium ${
                          txn.type === 'in' ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {txn.type === 'in' ? '+' : '-'}{txn.quantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        )}
      </div>

      {/* Add Item Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) closeAddDialog() }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Добавить на склад</DialogTitle>
            <DialogDescription>
              Заполните данные новой складской позиции
            </DialogDescription>
          </DialogHeader>
          {formError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {formError}
            </div>
          )}
          <ItemFormFields form={itemForm} onChange={handleItemFormChange} />
          <DialogFooter>
            <Button variant="outline" onClick={closeAddDialog} disabled={createItemMutation.isPending}>
              Отмена
            </Button>
            <Button onClick={handleAddSubmit} disabled={createItemMutation.isPending}>
              {createItemMutation.isPending ? 'Создание...' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Item Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) closeEditDialog() }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактировать позицию</DialogTitle>
            <DialogDescription>
              Измените данные складской позиции
            </DialogDescription>
          </DialogHeader>
          {formError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {formError}
            </div>
          )}
          <ItemFormFields form={itemForm} onChange={handleItemFormChange} />
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog} disabled={updateItemMutation.isPending}>
              Отмена
            </Button>
            <Button onClick={handleEditSubmit} disabled={updateItemMutation.isPending}>
              {updateItemMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Movement Dialog */}
      <Dialog open={transactionOpen} onOpenChange={(open) => { if (!open) closeTransactionDialog() }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Движение товара</DialogTitle>
            <DialogDescription>
              Оформите приход или расход складской позиции
            </DialogDescription>
          </DialogHeader>
          {txnError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {txnError}
            </div>
          )}
          {selectedItem && (
            <TransactionFormFields
              form={txnForm}
              onChange={handleTxnFormChange}
              itemName={selectedItem.name}
              currentQuantity={selectedItem.quantity}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeTransactionDialog} disabled={createTransactionMutation.isPending}>
              Отмена
            </Button>
            <Button onClick={handleTransactionSubmit} disabled={createTransactionMutation.isPending}>
              {createTransactionMutation.isPending ? 'Оформление...' : 'Оформить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить позицию?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить{' '}
              <strong>{selectedItem?.name}</strong>?
              Все связанные транзакции также будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteItemMutation.isPending}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteItemMutation.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteItemMutation.isPending ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
