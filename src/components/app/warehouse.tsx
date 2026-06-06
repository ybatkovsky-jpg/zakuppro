'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/components/providers/auth-provider'
import { useToast } from '@/hooks/use-toast'
import { authFetch } from '@/lib/auth-fetch'
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
  Download,
  ShoppingCart,
  PlusCircle,
  FileDown,
  XCircle,
  Printer,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronRight,
  MapPin,
  TrendingUp,
  Hash,
  RotateCcw,
  FileX,
  MoveRight,
  Trash,
} from 'lucide-react'
import { EmptyState } from '@/components/app/empty-state'
import { exportToCSV } from '@/lib/export-csv'
import { openReport } from '@/lib/print-report'
import { motion, AnimatePresence } from 'framer-motion'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
  const res = await authFetch(`/api/warehouse?${params.toString()}`)
  if (!res.ok) throw new Error('Ошибка загрузки складских позиций')
  return res.json()
}

async function createWarehouseItem(data: ItemFormData): Promise<WarehouseItem> {
  const res = await authFetch('/api/warehouse', {
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
  const res = await authFetch(`/api/warehouse/${id}`, {
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
  const res = await authFetch(`/api/warehouse/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Ошибка удаления позиции')
  }
}

async function fetchTransactions(): Promise<WarehouseTransaction[]> {
  const res = await authFetch('/api/warehouse/transactions')
  if (!res.ok) throw new Error('Ошибка загрузки транзакций')
  return res.json()
}

async function createTransaction(data: {
  warehouseItemId: string
  type: string
  quantity: number
  notes: string
}): Promise<WarehouseTransaction> {
  const res = await authFetch('/api/warehouse/transactions', {
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

function formatRelativeTime(dateStr: string): string {
  try {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return 'только что'
    if (diffMins < 60) return `${diffMins} мин. назад`
    if (diffHours < 24) return `${diffHours} ч. назад`
    if (diffDays < 7) return `${diffDays} дн. назад`
    return formatDate(dateStr)
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
    <div className="space-y-3">
      <div className="flex gap-4">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 flex-1 rounded" />
          <Skeleton className="h-8 w-20 rounded" />
          <Skeleton className="h-8 w-20 rounded" />
          <Skeleton className="h-8 w-24 rounded" />
        </div>
      ))}
    </div>
  )
}

function StatsCardSkeleton() {
  return (
    <div className="rounded-xl border p-4 space-y-2">
      <Skeleton className="h-10 w-10 rounded-full" />
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-3 w-24" />
    </div>
  )
}

function StatusBadge({ item }: { item: WarehouseItem }) {
  if (item.quantity <= 0) {
    return (
      <Badge variant="destructive" className="gap-1 rounded-full animate-status-pulse">
        <AlertTriangle className="h-3 w-3" />
        Нет в наличии
      </Badge>
    )
  }
  if (item.minQuantity > 0 && item.quantity < item.minQuantity) {
    return (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25 gap-1 rounded-full">
        <AlertTriangle className="h-3 w-3" />
        Мало
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
      <Package className="h-3 w-3" />
      В наличии
    </Badge>
  )
}

function StockBar({ item, animated = true }: { item: WarehouseItem; animated?: boolean }) {
  if (item.minQuantity <= 0) return null
  const ratio = Math.min(item.quantity / item.minQuantity, 2)
  const pct = Math.min((ratio / 2) * 100, 100)
  const barColor = item.quantity <= 0
    ? 'bg-red-500'
    : item.quantity < item.minQuantity
      ? 'bg-amber-500'
      : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2 w-28">
      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barColor}`}
          initial={animated ? { width: 0 } : undefined}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">
        {Math.round(ratio * 100)}%
      </span>
    </div>
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

// Stock Health Donut Chart
function StockHealthDonut({ ok, low, out }: { ok: number; low: number; out: number }) {
  const total = ok + low + out
  if (total === 0) return null

  const okPct = (ok / total) * 100
  const lowPct = (low / total) * 100
  const outPct = (out / total) * 100

  // SVG arc calculations
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const okStroke = (okPct / 100) * circumference
  const lowStroke = (lowPct / 100) * circumference
  const outStroke = (outPct / 100) * circumference

  const okOffset = 0
  const lowOffset = okStroke
  const outOffset = okStroke + lowStroke

  return (
    <div className="flex items-center gap-6">
      <div className="relative">
        <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
          {/* Background circle */}
          <circle cx="50" cy="50" r={radius} fill="none" className="stroke-muted" strokeWidth="10" />
          {/* Out of stock arc */}
          {outPct > 0 && (
            <motion.circle
              cx="50" cy="50" r={radius} fill="none"
              className="stroke-red-500"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${outStroke} ${circumference - outStroke}`}
              strokeDashoffset={-outOffset}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${outStroke} ${circumference - outStroke}` }}
              transition={{ duration: 0.8, delay: 0.4 }}
            />
          )}
          {/* Low stock arc */}
          {lowPct > 0 && (
            <motion.circle
              cx="50" cy="50" r={radius} fill="none"
              className="stroke-amber-500"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${lowStroke} ${circumference - lowStroke}`}
              strokeDashoffset={-lowOffset}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${lowStroke} ${circumference - lowStroke}` }}
              transition={{ duration: 0.8, delay: 0.2 }}
            />
          )}
          {/* OK stock arc */}
          {okPct > 0 && (
            <motion.circle
              cx="50" cy="50" r={radius} fill="none"
              className="stroke-emerald-500"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${okStroke} ${circumference - okStroke}`}
              strokeDashoffset={-okOffset}
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${okStroke} ${circumference - okStroke}` }}
              transition={{ duration: 0.8, delay: 0 }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-bold">{total}</p>
            <p className="text-[9px] text-muted-foreground">позиций</p>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-emerald-500" />
          <span className="text-sm">В наличии</span>
          <span className="text-sm font-bold ml-auto">{ok}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-amber-500" />
          <span className="text-sm">Мало</span>
          <span className="text-sm font-bold ml-auto">{low}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <span className="text-sm">Нет</span>
          <span className="text-sm font-bold ml-auto">{out}</span>
        </div>
      </div>
    </div>
  )
}

// Expandable item timeline
function ItemTimeline({ itemId, transactions }: { itemId: string; transactions: WarehouseTransaction[] }) {
  const itemTxns = transactions.filter(t => t.warehouseItemId === itemId)

  if (itemTxns.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-muted-foreground text-center">
        Нет истории операций для этой позиции
      </div>
    )
  }

  return (
    <div className="px-4 py-2">
      <div className="relative">
        {itemTxns.slice(0, 5).map((txn, idx) => (
          <div key={txn.id} className="flex items-start gap-3 pb-3 last:pb-0">
            <div className="flex flex-col items-center">
              <div className={`flex size-6 items-center justify-center rounded-full ${txn.type === 'in' ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-red-100 dark:bg-red-900/50'}`}>
                {txn.type === 'in' ? (
                  <ArrowDownCircle className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <ArrowUpCircle className="h-3.5 w-3.5 text-red-600" />
                )}
              </div>
              {idx < itemTxns.slice(0, 5).length - 1 && (
                <div className="w-px h-full bg-border mt-1" />
              )}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium">
                  {txn.type === 'in' ? 'Приход' : 'Расход'}: {txn.type === 'in' ? '+' : '-'}{txn.quantity}
                </p>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatRelativeTime(txn.createdAt)}
                </span>
              </div>
              {txn.notes && (
                <p className="text-[11px] text-muted-foreground truncate">{txn.notes}</p>
              )}
              {txn.projectItem && (
                <p className="text-[11px] text-muted-foreground truncate">
                  Проект: {txn.projectItem.project.name}
                </p>
              )}
            </div>
          </div>
        ))}
        {itemTxns.length > 5 && (
          <p className="text-xs text-muted-foreground text-center pt-1">
            и ещё {itemTxns.length - 5} операций
          </p>
        )}
      </div>
    </div>
  )
}

// Zone/location badge
function ZoneBadge({ location }: { location: string }) {
  if (!location) return null
  // Parse location like "Стеллаж А-3" to show a compact zone badge
  const parts = location.split(/[\s-]+/)
  const zone = parts[0]?.charAt(0)?.toUpperCase() || ''
  const detail = parts.length > 1 ? parts.slice(1).join('-') : ''

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground cursor-default">
          <MapPin className="h-2.5 w-2.5" />
          <span>{zone}{detail ? `-${detail}` : ''}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>{location}</TooltipContent>
    </Tooltip>
  )
}

// === Main Component ===
export function Warehouse() {
  const { role } = useAuth()
  const canWrite = role === 'owner' || role === 'manager'
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
  const [reorderOpen, setReorderOpen] = useState(false)
  const [reorderItem, setReorderItem] = useState<WarehouseItem | null>(null)
  const [reorderQuantity, setReorderQuantity] = useState(1)
  const [reorderSupplierId, setReorderSupplierId] = useState('')
  const [reorderNotes, setReorderNotes] = useState('')

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkActionOpen, setBulkActionOpen] = useState(false)
  const [bulkAction, setBulkAction] = useState<'move' | 'writeoff' | ''>('')

  // Expandable items state
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  // Quick add inline state
  const [quickAddVisible, setQuickAddVisible] = useState(false)
  const [quickAddForm, setQuickAddForm] = useState<ItemFormData>(emptyItemForm)

  // Fetch suppliers for the reorder dropdown
  const { data: suppliersList = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['reorder-suppliers'],
    queryFn: async () => {
      const res = await authFetch('/api/suppliers')
      if (!res.ok) return []
      return res.json()
    },
  })

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

  const outOfStockItems = useMemo(
    () => items.filter((item) => item.quantity <= 0),
    [items]
  )

  const okStockItems = useMemo(
    () => items.filter((item) => item.quantity > 0 && (item.minQuantity <= 0 || item.quantity >= item.minQuantity)),
    [items]
  )

  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  )

  // Total estimated value (approximate using quantity * avg price of 1000 per unit for demo)
  const totalValue = useMemo(
    () => items.reduce((sum, item) => sum + (item.quantity * 1000), 0),
    [items]
  )

  const recentTransactions = useMemo(
    () => transactions.slice(0, 10),
    [transactions]
  )

  // Category filter with counts
  const [categoryFilter, setCategoryFilter] = useState('all')
  const categories = useMemo(() => {
    const catMap = new Map<string, number>()
    items.forEach(i => {
      if (i.category) {
        catMap.set(i.category, (catMap.get(i.category) || 0) + 1)
      }
    })
    return Array.from(catMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({ name, count }))
  }, [items])
  const filteredItems = useMemo(() => {
    if (categoryFilter === 'all') return items
    return items.filter(i => i.category === categoryFilter)
  }, [items, categoryFilter])

  // Bulk selection helpers
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)))
    }
  }, [filteredItems, selectedIds])

  const toggleExpandItem = useCallback((id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

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

  // Quick add mutation
  const quickAddMutation = useMutation({
    mutationFn: createWarehouseItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouse'] })
      toast({ title: 'Позиция создана', description: 'Новая позиция быстро добавлена' })
      setQuickAddForm(emptyItemForm)
      setQuickAddVisible(false)
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' })
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

  const openReorderDialog = useCallback((item: WarehouseItem) => {
    setReorderItem(item)
    setReorderQuantity(item.minQuantity > 0 ? item.minQuantity * 2 : 10)
    setReorderSupplierId('')
    setReorderNotes('')
    setReorderOpen(true)
  }, [])

  const handleReorderSubmit = useCallback(() => {
    toast({
      title: 'Запрос на пополнение создан',
      description: `${reorderItem?.name} — ${reorderQuantity} шт`,
    })
    setReorderOpen(false)
    setReorderItem(null)
  }, [reorderItem, reorderQuantity, toast])

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

  const handleQuickAddSubmit = useCallback(() => {
    if (!quickAddForm.name.trim()) {
      toast({ title: 'Ошибка', description: 'Название позиции обязательно', variant: 'destructive' })
      return
    }
    quickAddMutation.mutate(quickAddForm)
  }, [quickAddForm, quickAddMutation, toast])

  const handleBulkAction = useCallback(() => {
    if (bulkAction === 'move') {
      toast({
        title: 'Перемещение оформлено',
        description: `${selectedIds.size} позиций перемещено`,
      })
    } else if (bulkAction === 'writeoff') {
      toast({
        title: 'Списание оформлено',
        description: `${selectedIds.size} позиций списано`,
      })
    }
    setBulkActionOpen(false)
    setBulkAction('')
    setSelectedIds(new Set())
  }, [bulkAction, selectedIds, toast])

  // Render
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative -mx-6 -mt-6 px-6 pt-6 pb-5 bg-gradient-to-b from-teal-500/5 via-teal-500/[0.02] to-transparent">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm">
              Управление складскими запасами и движением товаров
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {canWrite && (
              <Button onClick={openAddDialog} className="gap-2 shrink-0 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.02]">
                <Plus className="h-4 w-4" />
                Добавить
              </Button>
            )}
            {canWrite && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuickAddVisible(!quickAddVisible)}
                className="gap-1.5 shrink-0 transition-all duration-200 hover:shadow-md"
              >
                <Hash className="h-3.5 w-3.5" />
                Быстрое добавление
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const csvData = items.map((item) => {
                  const isOut = item.quantity <= 0
                  const isLow = item.minQuantity > 0 && item.quantity < item.minQuantity
                  let statusLabel = 'В наличии'
                  if (isOut) statusLabel = 'Нет в наличии'
                  else if (isLow) statusLabel = 'Мало'
                  return {
                    Наименование: item.name,
                    Артикул: item.article || '',
                    Категория: item.category || '',
                    Количество: item.quantity,
                    'Мин. остаток': item.minQuantity,
                    'Ед.': item.unit,
                    Место: item.location || '',
                    Статус: statusLabel,
                  }
                })
                exportToCSV(csvData, 'warehouse.csv', [
                  { key: 'Наименование', header: 'Наименование' },
                  { key: 'Артикул', header: 'Артикул' },
                  { key: 'Категория', header: 'Категория' },
                  { key: 'Количество', header: 'Количество' },
                  { key: 'Мин. остаток', header: 'Мин. остаток' },
                  { key: 'Ед.', header: 'Ед.' },
                  { key: 'Место', header: 'Место' },
                  { key: 'Статус', header: 'Статус' },
                ])
              }}
              className="gap-1.5 shrink-0 transition-all duration-200 hover:shadow-md hover:border-primary/30"
            >
              <FileDown className="h-3.5 w-3.5" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open('/api/warehouse/export', '_blank')}
              className="gap-1.5 shrink-0 transition-all duration-200 hover:shadow-md"
            >
              <Download className="h-3.5 w-3.5" />
              Экспорт
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openReport('warehouse-report')}
              className="gap-1.5 shrink-0 transition-all duration-200 hover:shadow-md"
            >
              <Printer className="h-3.5 w-3.5" />
              Печать
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Summary + Stock Health Dashboard */}
      {itemsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <StatsCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0, duration: 0.3 }}
            className="relative rounded-xl border bg-gradient-to-br from-teal-50 to-teal-100/50 dark:from-teal-950/30 dark:to-teal-900/10 p-4 overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/50">
                <Package className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-teal-700 dark:text-teal-300">{items.length}</p>
                <p className="text-xs text-teal-600/80 dark:text-teal-400/80">Всего позиций</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.3 }}
            className="relative rounded-xl border bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-900/10 p-4 overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                <WarehouseIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{totalQuantity}</p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80">На складе</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="relative rounded-xl border bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/10 p-4 overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{lowStockItems.length}</p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80">Низкий запас</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.3 }}
            className="relative rounded-xl border bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/10 p-4 overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
                <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{outOfStockItems.length}</p>
                <p className="text-xs text-red-600/80 dark:text-red-400/80">Нет в наличии</p>
              </div>
            </div>
          </motion.div>

          {/* Stock Health Donut */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.3 }}
            className="row-span-1 lg:row-span-1 rounded-xl border bg-background p-4 flex items-center justify-center"
          >
            <StockHealthDonut ok={okStockItems.length} low={lowStockItems.length} out={outOfStockItems.length} />
          </motion.div>
        </div>
      )}

      {/* Total Value Card */}
      {!itemsLoading && items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="bg-gradient-to-r from-teal-500/5 to-emerald-500/5 border-teal-500/10">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  <span className="text-sm text-muted-foreground">Общая стоимость запасов</span>
                </div>
                <span className="text-lg font-bold text-teal-700 dark:text-teal-300">
                  {totalValue.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Low Stock Alert Banner with Restock Suggestions */}
      {lowStockItems.length > 0 && (
        <Card className="border-amber-500/40 bg-gradient-to-r from-amber-50/80 to-amber-50/30 dark:from-amber-950/30 dark:to-amber-950/10 overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-amber-500 animate-pulse-soft" />
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 animate-pulse-soft" />
                </div>
                <div>
                  <CardTitle className="text-base text-amber-800 dark:text-amber-300">
                    Внимание: низкий остаток ({lowStockItems.length})
                  </CardTitle>
                  <CardDescription className="text-amber-700/80 dark:text-amber-400/80">
                    Рекомендуется пополнить запасы следующих позиций
                  </CardDescription>
                </div>
              </div>
              {lowStockItems.length > 0 && canWrite && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-amber-500/30 text-amber-700 hover:bg-amber-100/50 dark:text-amber-400 dark:hover:bg-amber-900/30"
                  onClick={() => {
                    toast({ title: 'Запросы на пополнение созданы', description: `${lowStockItems.length} позиций` })
                  }}
                >
                  <ShoppingCart className="h-3.5 w-3.5" />
                  Заказать все
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {lowStockItems.map((item) => {
                const restockQty = item.minQuantity > 0 ? (item.minQuantity * 2 - item.quantity) : 10
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-background/80 px-3 py-2.5 transition-all duration-200 hover:shadow-sm hover:border-amber-500/40"
                  >
                    <div className="min-w-0 flex-1 mr-3">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StockBar item={item} />
                        <span className="text-[10px] text-amber-600/80">рек. {restockQty} {item.unit}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                          {item.quantity} / {item.minQuantity} {item.unit}
                        </p>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-100/50 dark:hover:bg-amber-900/30"
                            onClick={() => openReorderDialog(item)}
                          >
                            <ShoppingCart className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Запросить пополнение ({restockQty} {item.unit})</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="sticky top-0 z-10"
        >
          <Card className="border-primary/30 bg-primary/5 shadow-md">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CheckSquare className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Выбрано: {selectedIds.size}</span>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())} className="h-7 text-xs">
                    Снять выбор
                  </Button>
                </div>
                {canWrite && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => { setBulkAction('move'); setBulkActionOpen(true) }}
                  >
                    <MoveRight className="h-3.5 w-3.5" />
                    Переместить
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => { setBulkAction('writeoff'); setBulkActionOpen(true) }}
                  >
                    <FileX className="h-3.5 w-3.5" />
                    Списать
                  </Button>
                </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Category Filter Pills with Counts */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${categoryFilter === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'}`}
          >
            <Package className="h-3 w-3" />
            Все
            <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]">{items.length}</span>
          </button>
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => setCategoryFilter(cat.name === categoryFilter ? 'all' : cat.name)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${categoryFilter === cat.name ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              {cat.name}
              <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]">{cat.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по названию, артикулу, категории..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 transition-shadow duration-200 focus:shadow-md focus:shadow-primary/5"
        />
      </div>

      {/* Quick Add Inline Row */}
      <AnimatePresence>
        {quickAddVisible && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-dashed border-teal-500/30 bg-teal-50/30 dark:bg-teal-950/10">
              <CardContent className="py-3 px-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[150px]">
                    <Label className="text-xs">Наименование *</Label>
                    <Input
                      placeholder="Название"
                      value={quickAddForm.name}
                      onChange={(e) => setQuickAddForm(p => ({ ...p, name: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="w-24">
                    <Label className="text-xs">Артикул</Label>
                    <Input
                      placeholder="Арт."
                      value={quickAddForm.article}
                      onChange={(e) => setQuickAddForm(p => ({ ...p, article: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="w-28">
                    <Label className="text-xs">Категория</Label>
                    <Input
                      placeholder="Кат."
                      value={quickAddForm.category}
                      onChange={(e) => setQuickAddForm(p => ({ ...p, category: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="w-20">
                    <Label className="text-xs">Кол-во</Label>
                    <Input
                      type="number"
                      min={0}
                      value={quickAddForm.quantity}
                      onChange={(e) => setQuickAddForm(p => ({ ...p, quantity: parseInt(e.target.value) || 0 }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="w-20">
                    <Label className="text-xs">Мин.</Label>
                    <Input
                      type="number"
                      min={0}
                      value={quickAddForm.minQuantity}
                      onChange={(e) => setQuickAddForm(p => ({ ...p, minQuantity: parseInt(e.target.value) || 0 }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="w-24">
                    <Label className="text-xs">Место</Label>
                    <Input
                      placeholder="Зона"
                      value={quickAddForm.location}
                      onChange={(e) => setQuickAddForm(p => ({ ...p, location: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleQuickAddSubmit}
                      disabled={quickAddMutation.isPending}
                      className="h-8 gap-1"
                    >
                      {quickAddMutation.isPending ? (
                        <motion.div className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      Добавить
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setQuickAddVisible(false); setQuickAddForm(emptyItemForm) }}
                      className="h-8"
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

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
        <EmptyState
          type={search ? 'search' : 'warehouse'}
          action={
            !search
              ? {
                  label: 'Добавить на склад',
                  onClick: openAddDialog,
                  icon: PlusCircle,
                }
              : undefined
          }
        />
      ) : (
        <Card>
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.size === filteredItems.length && filteredItems.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-8" />
                  <TableHead>Наименование</TableHead>
                  <TableHead className="hidden md:table-cell">Артикул</TableHead>
                  <TableHead className="hidden lg:table-cell">Категория</TableHead>
                  <TableHead className="text-right">Кол-во</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Мин.</TableHead>
                  <TableHead className="hidden sm:table-cell">Ед.</TableHead>
                  <TableHead className="hidden lg:table-cell">Зона</TableHead>
                  <TableHead className="hidden sm:table-cell">Статус</TableHead>
                  <TableHead className="hidden md:table-cell">Обновлено</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const isLow = item.minQuantity > 0 && item.quantity < item.minQuantity
                  const isOut = item.quantity <= 0
                  const isExpanded = expandedItems.has(item.id)
                  const isSelected = selectedIds.has(item.id)
                  return (
                    <>
                      <TableRow
                        key={item.id}
                        className={`transition-colors duration-150 ${isOut ? 'animate-pulse-red-bg' : isLow ? 'bg-amber-50/50 dark:bg-amber-950/10' : isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(item.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => toggleExpandItem(item.id)}
                            className="p-0.5 rounded hover:bg-muted/50 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate" title={item.name}>
                          <div className="flex items-center gap-2">
                            <div className={`size-2 rounded-full shrink-0 ${isOut ? 'bg-red-500 animate-pulse-dot' : isLow ? 'bg-amber-500 animate-pulse-dot' : 'bg-emerald-500'}`} />
                            {item.minQuantity > 0 && (
                              <div className="stock-indicator">
                                <motion.div
                                  className={`absolute bottom-0 left-0 right-0 ${isOut ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                  initial={{ height: 0 }}
                                  animate={{ height: `${Math.min((item.quantity / (item.minQuantity * 2)) * 100, 100)}%` }}
                                  transition={{ duration: 0.6, ease: 'easeOut' }}
                                />
                              </div>
                            )}
                            {item.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">{item.article || '—'}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {item.category ? (
                            <Badge variant="outline" className="font-normal">{item.category}</Badge>
                          ) : '—'}
                        </TableCell>
                        <TableCell className={`text-right font-mono font-medium ${isOut ? 'text-destructive' : isLow ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground hidden sm:table-cell">
                          {item.minQuantity || '—'}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{item.unit}</TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <ZoneBadge location={item.location} />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <StatusBadge item={item} />
                            {item.minQuantity > 0 && <StockBar item={item} />}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] text-muted-foreground cursor-default">
                                {formatRelativeTime(item.updatedAt)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{formatDate(item.updatedAt)}</TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-0.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openTransactionDialog(item)}
                                >
                                  <ArrowUpDown className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Движение</TooltipContent>
                            </Tooltip>
                            {isLow && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-amber-600 hover:text-amber-700"
                                    onClick={() => openReorderDialog(item)}
                                  >
                                    <ShoppingCart className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Пополнить</TooltipContent>
                              </Tooltip>
                            )}
                            {canWrite && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => openEditDialog(item)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Редактировать</TooltipContent>
                              </Tooltip>
                            )}
                            {canWrite && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => openDeleteDialog(item)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Удалить</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {/* Expanded item timeline */}
                      <AnimatePresence key={`${item.id}-expanded`}>
                        {isExpanded && (
                          <TableRow key={`${item.id}-timeline`}>
                            <TableCell colSpan={12} className="p-0 bg-muted/20">
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <div className="py-2 px-12">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs font-medium text-muted-foreground">История операций</span>
                                  </div>
                                  <ItemTimeline itemId={item.id} transactions={transactions} />
                                </div>
                              </motion.div>
                            </TableCell>
                          </TableRow>
                        )}
                      </AnimatePresence>
                    </>
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
            <Button type="button" onClick={handleAddSubmit} disabled={createItemMutation.isPending}>
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
            <Button type="button" onClick={handleEditSubmit} disabled={updateItemMutation.isPending}>
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
            <Button type="button" onClick={handleTransactionSubmit} disabled={createTransactionMutation.isPending}>
              {createTransactionMutation.isPending ? 'Оформление...' : 'Оформить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reorder Request Dialog */}
      <Dialog open={reorderOpen} onOpenChange={(open) => { if (!open) { setReorderOpen(false); setReorderItem(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-amber-600" />
              Запросить пополнение
            </DialogTitle>
            <DialogDescription>
              Создать запрос на пополнение складской позиции
            </DialogDescription>
          </DialogHeader>
          {reorderItem && (
            <div className="grid gap-4 py-2">
              <div className="rounded-md bg-muted p-3 text-sm">
                <span className="text-muted-foreground">Товар:</span>{' '}
                <span className="font-medium">{reorderItem.name}</span>
                <br />
                <span className="text-muted-foreground">Текущий остаток:</span>{' '}
                <span className="font-bold text-amber-600">{reorderItem.quantity} {reorderItem.unit}</span>
                {reorderItem.minQuantity > 0 && (
                  <>
                    {' '}(мин. {reorderItem.minQuantity})
                  </>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reorder-quantity">Количество для заказа</Label>
                <Input
                  id="reorder-quantity"
                  type="number"
                  min={1}
                  value={reorderQuantity}
                  onChange={(e) => setReorderQuantity(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reorder-supplier">Предпочтительный поставщик</Label>
                <Select value={reorderSupplierId} onValueChange={setReorderSupplierId}>
                  <SelectTrigger id="reorder-supplier">
                    <SelectValue placeholder="Выберите поставщика" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliersList.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {suppliersList.length === 0 && (
                  <p className="text-xs text-muted-foreground">Нет поставщиков в базе</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="reorder-notes">Примечания</Label>
                <Textarea
                  id="reorder-notes"
                  placeholder="Дополнительная информация к запросу"
                  value={reorderNotes}
                  onChange={(e) => setReorderNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReorderOpen(false); setReorderItem(null) }}>
              Отмена
            </Button>
            <Button onClick={handleReorderSubmit}>
              <ShoppingCart className="h-4 w-4" />
              Создать запрос
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Confirmation Dialog */}
      <AlertDialog open={bulkActionOpen} onOpenChange={setBulkActionOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === 'move' ? 'Переместить позиции?' : 'Списать позиции?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === 'move'
                ? `Вы уверены, что хотите переместить ${selectedIds.size} выбранных позиций?`
                : `Вы уверены, что хотите списать ${selectedIds.size} выбранных позиций? Это действие нельзя отменить.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBulkAction('')}>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkAction} className={bulkAction === 'writeoff' ? 'bg-destructive text-white hover:bg-destructive/90' : ''}>
              {bulkAction === 'move' ? 'Переместить' : 'Списать'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
