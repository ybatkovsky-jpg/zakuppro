'use client'

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAppStore } from '@/store/app-store'
import { useToast } from '@/hooks/use-toast'
import { authFetch } from '@/lib/auth-fetch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { motion, AnimatePresence } from 'framer-motion'
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
  Download,
  DollarSign,
  Building2,
  ArrowRight,
  Lightbulb,
  RefreshCcw,
  User,
  CalendarDays,
  MessageSquare,
  Check,
  Ban,
  FileText as FileTextIcon,
  Settings2,
  Receipt,
  CreditCard,
  Truck,
  Printer,
  MapPin,
  Navigation,
} from 'lucide-react'
import { ProjectTimeline } from '@/components/app/project-timeline'
import { EmptyState } from '@/components/app/empty-state'
import { openReport } from '@/lib/print-report'

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
  fromStatus: string
  toStatus: string
  comment: string
  changedBy: string
  notes: string
  createdAt: string
}

interface Delivery {
  id: string
  projectId: string
  supplierId: string
  invoiceId: string | null
  status: string
  trackingNumber: string
  carrier: string
  estimatedDate: string | null
  actualDate: string | null
  notes: string
  createdAt: string
  updatedAt: string
  project: { id: string; name: string; status: string }
  supplier: { id: string; name: string; email: string; phone: string }
  invoice: { id: string; invoiceNumber: string; totalAmount: number } | null
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

// --- Valid Status Transitions ---

const VALID_TRANSITIONS: Record<string, string[]> = {
  'new': ['processing', 'cancelled'],
  'processing': ['requested', 'cancelled'],
  'requested': ['invoiced', 'processing', 'cancelled'],
  'invoiced': ['paid', 'requested', 'cancelled'],
  'paid': ['delivered', 'invoiced'],
  'delivered': ['completed', 'paid'],
  'completed': [],
  'cancelled': [],
}

// Transitions that require a mandatory comment
const MANDATORY_COMMENT_TRANSITIONS = ['cancelled']

// --- Next Step suggestions ---

const STATUS_NEXT_STEP: Record<string, string> = {
  new: 'Создайте запросы поставщикам',
  processing: 'Отправьте запросы и дождитесь ответа',
  requested: 'Получите счета от поставщиков',
  invoiced: 'Проверьте и оплатите счета',
  paid: 'Ожидайте доставку',
  delivered: 'Завершите проект',
  completed: 'Проект завершён',
  cancelled: 'Проект отменён',
}

// --- Category color map ---

const CATEGORY_COLORS = [
  'bg-emerald-500',
  'bg-sky-500',
  'bg-violet-500',
  'bg-amber-500',
  'bg-teal-500',
  'bg-rose-500',
  'bg-orange-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-lime-500',
]

// --- Status helpers ---

const PROJECT_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string; bannerClass?: string }> = {
  new: { label: 'Новый', variant: 'secondary', bannerClass: 'bg-sky-50 border-sky-200 text-sky-800 dark:bg-sky-950/30 dark:border-sky-800 dark:text-sky-300' },
  processing: { label: 'В обработке', variant: 'default', bannerClass: 'bg-violet-50 border-violet-200 text-violet-800 dark:bg-violet-950/30 dark:border-violet-800 dark:text-violet-300' },
  requested: { label: 'Запрошено', variant: 'outline', bannerClass: 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300' },
  invoiced: { label: 'Счета', variant: 'outline', className: 'border-amber-500 text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30 rounded-full', bannerClass: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-300' },
  paid: { label: 'Оплачено', variant: 'outline', className: 'border-green-500 text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/30 rounded-full', bannerClass: 'bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300' },
  delivered: { label: 'Доставлено', variant: 'outline', className: 'border-green-600 text-green-800 bg-green-50 dark:text-green-400 dark:bg-green-950/30 rounded-full', bannerClass: 'bg-teal-50 border-teal-200 text-teal-800 dark:bg-teal-950/30 dark:border-teal-800 dark:text-teal-300' },
  completed: { label: 'Завершено', variant: 'outline', className: 'border-green-700 text-green-900 bg-green-100 dark:text-green-300 dark:bg-green-950/40 rounded-full', bannerClass: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300' },
  cancelled: { label: 'Отменено', variant: 'destructive', bannerClass: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-300' },
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

const DELIVERY_STATUS_MAP: Record<string, { label: string; color: string; bgColor: string; borderColor: string; progress: number }> = {
  pending: { label: 'Ожидание', color: 'text-slate-600 dark:text-slate-400', bgColor: 'bg-slate-100 dark:bg-slate-900/40', borderColor: 'border-slate-300 dark:border-slate-700', progress: 0 },
  shipped: { label: 'Отправлено', color: 'text-sky-600 dark:text-sky-400', bgColor: 'bg-sky-100 dark:bg-sky-900/40', borderColor: 'border-sky-300 dark:border-sky-700', progress: 33 },
  in_transit: { label: 'В пути', color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/40', borderColor: 'border-amber-300 dark:border-amber-700', progress: 66 },
  delivered: { label: 'Доставлено', color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-900/40', borderColor: 'border-emerald-300 dark:border-emerald-700', progress: 100 },
  cancelled: { label: 'Отменено', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/40', borderColor: 'border-red-300 dark:border-red-700', progress: 0 },
}

const CARRIERS = ['Деловые Линии', 'ПЭК', 'СДЭК', 'Байкал Сервис', 'КИТ', 'ЖелДорЭкспедиция', 'Энергия', 'Другое']

// --- Status flow diagram config ---

const STATUS_FLOW_STEPS = [
  { key: 'new', label: 'Новый', icon: FileTextIcon, color: 'sky' },
  { key: 'processing', label: 'Обработка', icon: Settings2, color: 'violet' },
  { key: 'requested', label: 'Запросы', icon: Send, color: 'blue' },
  { key: 'invoiced', label: 'Счета', icon: Receipt, color: 'amber' },
  { key: 'paid', label: 'Оплата', icon: CreditCard, color: 'green' },
  { key: 'delivered', label: 'Доставка', icon: Truck, color: 'teal' },
  { key: 'completed', label: 'Завершён', icon: CheckCircle2, color: 'emerald' },
] as const

const STATUS_FLOW_COLORS: Record<string, { bg: string; text: string; border: string; activeBg: string; activeBorder: string; completedBg: string; completedBorder: string }> = {
  sky: {
    bg: 'bg-sky-100 dark:bg-sky-950/40',
    text: 'text-sky-600 dark:text-sky-400',
    border: 'border-sky-300 dark:border-sky-700',
    activeBg: 'bg-sky-500 dark:bg-sky-600',
    activeBorder: 'border-sky-500 dark:border-sky-600',
    completedBg: 'bg-green-500 dark:bg-green-600',
    completedBorder: 'border-green-500 dark:border-green-600',
  },
  violet: {
    bg: 'bg-violet-100 dark:bg-violet-950/40',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-300 dark:border-violet-700',
    activeBg: 'bg-violet-500 dark:bg-violet-600',
    activeBorder: 'border-violet-500 dark:border-violet-600',
    completedBg: 'bg-green-500 dark:bg-green-600',
    completedBorder: 'border-green-500 dark:border-green-600',
  },
  blue: {
    bg: 'bg-blue-100 dark:bg-blue-950/40',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-300 dark:border-blue-700',
    activeBg: 'bg-blue-500 dark:bg-blue-600',
    activeBorder: 'border-blue-500 dark:border-blue-600',
    completedBg: 'bg-green-500 dark:bg-green-600',
    completedBorder: 'border-green-500 dark:border-green-600',
  },
  amber: {
    bg: 'bg-amber-100 dark:bg-amber-950/40',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-300 dark:border-amber-700',
    activeBg: 'bg-amber-500 dark:bg-amber-600',
    activeBorder: 'border-amber-500 dark:border-amber-600',
    completedBg: 'bg-green-500 dark:bg-green-600',
    completedBorder: 'border-green-500 dark:border-green-600',
  },
  green: {
    bg: 'bg-green-100 dark:bg-green-950/40',
    text: 'text-green-600 dark:text-green-400',
    border: 'border-green-300 dark:border-green-700',
    activeBg: 'bg-green-500 dark:bg-green-600',
    activeBorder: 'border-green-500 dark:border-green-600',
    completedBg: 'bg-green-500 dark:bg-green-600',
    completedBorder: 'border-green-500 dark:border-green-600',
  },
  teal: {
    bg: 'bg-teal-100 dark:bg-teal-950/40',
    text: 'text-teal-600 dark:text-teal-400',
    border: 'border-teal-300 dark:border-teal-700',
    activeBg: 'bg-teal-500 dark:bg-teal-600',
    activeBorder: 'border-teal-500 dark:border-teal-600',
    completedBg: 'bg-green-500 dark:bg-green-600',
    completedBorder: 'border-green-500 dark:border-green-600',
  },
  emerald: {
    bg: 'bg-emerald-100 dark:bg-emerald-950/40',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-300 dark:border-emerald-700',
    activeBg: 'bg-emerald-500 dark:bg-emerald-600',
    activeBorder: 'border-emerald-500 dark:border-emerald-600',
    completedBg: 'bg-green-500 dark:bg-green-600',
    completedBorder: 'border-green-500 dark:border-green-600',
  },
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

// --- Status Flow Diagram ---

function StatusFlowDiagram({ currentStatus }: { currentStatus: string }) {
  const stepsOrder = STATUS_FLOW_STEPS.map(s => s.key)
  const currentIndex = stepsOrder.indexOf(currentStatus)
  const isCancelled = currentStatus === 'cancelled'
  const availableNext = VALID_TRANSITIONS[currentStatus] ?? []

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <RefreshCcw className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Жизненный цикл проекта</h3>
      </div>

      {/* Desktop horizontal flow */}
      <div className="hidden md:block">
        <div className="flex items-start justify-between relative">
          {STATUS_FLOW_STEPS.map((step, idx) => {
            const colorConfig = STATUS_FLOW_COLORS[step.color]
            let state: 'completed' | 'current' | 'future'
            if (isCancelled) {
              state = 'future'
            } else if (idx < currentIndex) {
              state = 'completed'
            } else if (idx === currentIndex) {
              state = 'current'
            } else {
              state = 'future'
            }

            const isNextAvailable = availableNext.includes(step.key)

            return (
              <div
                key={step.key}
                className="flex flex-col items-center relative"
                style={{ flex: 1, maxWidth: `${100 / STATUS_FLOW_STEPS.length}%` }}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.06, duration: 0.3 }}
                  className="relative"
                >
                  <motion.div
                    className={`
                      size-10 rounded-full border-2 flex items-center justify-center transition-all duration-300
                      ${state === 'completed'
                        ? `${colorConfig.completedBg} ${colorConfig.completedBorder}`
                        : state === 'current'
                          ? `${colorConfig.activeBg} ${colorConfig.activeBorder}`
                          : isNextAvailable
                            ? `${colorConfig.bg} ${colorConfig.border} ring-2 ring-dashed ring-primary/30`
                            : `${colorConfig.bg} ${colorConfig.border} opacity-40`
                      }
                    `}
                    animate={
                      state === 'current'
                        ? { scale: [1, 1.08, 1], transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' } }
                        : {}
                    }
                  >
                    {state === 'completed' ? (
                      <Check className="size-5 text-white" strokeWidth={3} />
                    ) : state === 'current' ? (
                      <step.icon className="size-5 text-white" />
                    ) : (
                      <step.icon className={`size-4 ${colorConfig.text} ${isNextAvailable ? 'opacity-70' : 'opacity-40'}`} />
                    )}
                  </motion.div>

                  {/* Current step pulse glow */}
                  {state === 'current' && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-primary/30"
                      animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                </motion.div>

                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 + 0.1 }}
                  className={`
                    mt-2 text-xs font-medium text-center leading-tight
                    ${state === 'completed'
                      ? 'text-green-700 dark:text-green-400'
                      : state === 'current'
                        ? 'text-foreground'
                        : isNextAvailable
                          ? 'text-primary/70'
                          : 'text-muted-foreground opacity-50'
                    }
                  `}
                >
                  {step.label}
                </motion.p>
              </div>
            )
          })}
        </div>

        {/* Connecting lines */}
        <div className="relative mt-[-88px] mb-[56px] px-5 pointer-events-none">
          <div className="flex">
            {STATUS_FLOW_STEPS.map((step, idx) => {
              if (idx === 0) return null
              const prevState = isCancelled
                ? 'future'
                : idx - 1 < currentIndex ? 'completed' : idx - 1 === currentIndex ? 'current' : 'future'
              const currState = isCancelled
                ? 'future'
                : idx < currentIndex ? 'completed' : idx === currentIndex ? 'current' : 'future'
              const lineCompleted = prevState === 'completed' && (currState === 'completed' || currState === 'current')

              return (
                <div key={`line-${step.key}`} className="relative h-0.5" style={{ flex: 1 }}>
                  <div className="absolute inset-0 bg-border" />
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: lineCompleted ? 1 : 0 }}
                    transition={{ duration: 0.4, delay: idx * 0.06 }}
                    className={`absolute inset-y-0 left-0 origin-left ${lineCompleted ? 'bg-green-500 dark:bg-green-600' : 'bg-border'}`}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Cancelled indicator */}
        {isCancelled && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400"
          >
            <Ban className="h-4 w-4" />
            <span className="text-sm font-semibold">Проект отменён</span>
          </motion.div>
        )}
      </div>

      {/* Mobile vertical flow */}
      <div className="md:hidden">
        <div className="relative">
          {STATUS_FLOW_STEPS.map((step, idx) => {
            const colorConfig = STATUS_FLOW_COLORS[step.color]
            let state: 'completed' | 'current' | 'future'
            if (isCancelled) {
              state = 'future'
            } else if (idx < currentIndex) {
              state = 'completed'
            } else if (idx === currentIndex) {
              state = 'current'
            } else {
              state = 'future'
            }
            const isNextAvailable = availableNext.includes(step.key)
            const isLast = idx === STATUS_FLOW_STEPS.length - 1

            return (
              <div key={step.key}>
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center shrink-0">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.06 }}
                      className="relative"
                    >
                      <motion.div
                        className={`
                          size-8 rounded-full border-2 flex items-center justify-center
                          ${state === 'completed'
                            ? `${colorConfig.completedBg} ${colorConfig.completedBorder}`
                            : state === 'current'
                              ? `${colorConfig.activeBg} ${colorConfig.activeBorder}`
                              : isNextAvailable
                                ? `${colorConfig.bg} ${colorConfig.border} ring-2 ring-dashed ring-primary/30`
                                : `${colorConfig.bg} ${colorConfig.border} opacity-40`
                          }
                        `}
                        animate={state === 'current' ? { scale: [1, 1.1, 1], transition: { duration: 2, repeat: Infinity } } : {}}
                      >
                        {state === 'completed' ? (
                          <Check className="size-4 text-white" strokeWidth={3} />
                        ) : state === 'current' ? (
                          <step.icon className="size-4 text-white" />
                        ) : (
                          <step.icon className={`size-3.5 ${colorConfig.text} ${isNextAvailable ? 'opacity-70' : 'opacity-40'}`} />
                        )}
                      </motion.div>
                      {state === 'current' && (
                        <motion.div
                          className="absolute inset-0 rounded-full border-2 border-primary/30"
                          animate={{ scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}
                    </motion.div>
                    {!isLast && (
                      <div className={`w-0.5 h-6 ${state === 'completed' || state === 'current' ? 'bg-green-400 dark:bg-green-600' : 'bg-border'}`} />
                    )}
                  </div>
                  <div className="pb-3 pt-0.5">
                    <p className={`text-sm font-medium ${
                      state === 'completed' ? 'text-green-700 dark:text-green-400'
                        : state === 'current' ? 'text-foreground'
                          : isNextAvailable ? 'text-primary/70'
                            : 'text-muted-foreground opacity-50'
                    }`}>
                      {step.label}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
          {isCancelled && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 mt-2 text-red-600 dark:text-red-400 pl-11"
            >
              <Ban className="h-4 w-4" />
              <span className="text-sm font-semibold">Проект отменён</span>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Status Transition Modal ---

function StatusTransitionModal({
  open,
  onOpenChange,
  currentStatus,
  projectId,
  onSuccess,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentStatus: string
  projectId: string
  onSuccess: () => void
}) {
  const { toast } = useToast()
  const [nextStatus, setNextStatus] = useState<string>('')
  const [comment, setComment] = useState('')
  const [changedAt, setChangedAt] = useState('')

  const allowedTransitions = VALID_TRANSITIONS[currentStatus] ?? []
  const isCommentRequired = MANDATORY_COMMENT_TRANSITIONS.includes(nextStatus)
  const canSubmit = nextStatus && (!isCommentRequired || comment.trim().length > 0)

  const changeStatusMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = { status: nextStatus }
      if (comment.trim()) body.comment = comment.trim()
      if (changedAt) body.changedAt = new Date(changedAt).toISOString()

      const res = await authFetch(`/api/projects/${projectId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка изменения статуса')
      }
      return res.json()
    },
    onSuccess: () => {
      onSuccess()
      onOpenChange(false)
      setNextStatus('')
      setComment('')
      setChangedAt('')
      toast({ title: 'Статус успешно изменён' })
    },
    onError: (err: Error) => {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' })
    },
  })

  const currentConfig = PROJECT_STATUS_MAP[currentStatus]
  const nextConfig = PROJECT_STATUS_MAP[nextStatus]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCcw className="h-5 w-5 text-primary" />
            Изменение статуса проекта
          </DialogTitle>
          <DialogDescription>
            Выберите новый статус и добавьте комментарий к переходу
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current → Next preview */}
          <div className="flex items-center justify-center gap-3 py-3">
            <div className="flex flex-col items-center gap-1">
              <Badge
                variant={currentConfig?.variant ?? 'secondary'}
                className={currentConfig?.className}
              >
                {currentConfig?.label ?? currentStatus}
              </Badge>
              <span className="text-[10px] text-muted-foreground">Текущий</span>
            </div>
            <motion.div
              initial={{ x: -5 }}
              animate={{ x: 5 }}
              transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            >
              <ArrowRight className="h-5 w-5 text-primary" />
            </motion.div>
            <div className="flex flex-col items-center gap-1">
              {nextStatus ? (
                <Badge
                  variant={nextConfig?.variant ?? 'secondary'}
                  className={nextConfig?.className}
                >
                  {nextConfig?.label ?? nextStatus}
                </Badge>
              ) : (
                <Badge variant="outline" className="opacity-50">???</Badge>
              )}
              <span className="text-[10px] text-muted-foreground">Новый</span>
            </div>
          </div>

          {/* Next status select */}
          <div className="space-y-2">
            <Label>Новый статус</Label>
            <Select value={nextStatus} onValueChange={setNextStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите статус" />
              </SelectTrigger>
              <SelectContent>
                {allowedTransitions.length === 0 ? (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    Нет доступных переходов
                  </div>
                ) : (
                  allowedTransitions.map((status) => {
                    const config = PROJECT_STATUS_MAP[status]
                    return (
                      <SelectItem key={status} value={status}>
                        <div className="flex items-center gap-2">
                          {status === 'cancelled' && <Ban className="h-3.5 w-3.5 text-red-500" />}
                          <span>{config?.label ?? status}</span>
                        </div>
                      </SelectItem>
                    )
                  })
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Комментарий
              {isCommentRequired && <span className="text-red-500 text-xs">(обязательно)</span>}
            </Label>
            <Textarea
              placeholder={isCommentRequired ? 'Укажите причину изменения статуса...' : 'Добавьте комментарий (необязательно)...'}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* Date picker */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              Дата изменения
            </Label>
            <input
              type="datetime-local"
              value={changedAt}
              onChange={(e) => setChangedAt(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            {!changedAt && (
              <p className="text-xs text-muted-foreground">Если не указана, используется текущее время</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            onClick={() => changeStatusMutation.mutate()}
            disabled={!canSubmit || changeStatusMutation.isPending}
          >
            {changeStatusMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-1" />
            )}
            Подтвердить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// --- Enhanced Timeline ---

function EnhancedTimeline({ statusHistory, currentStatus }: { statusHistory: StatusHistoryEntry[]; currentStatus: string }) {
  // Sort history chronologically (oldest first)
  const sortedHistory = useMemo(() => {
    return [...statusHistory].sort((a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  }, [statusHistory])

  const availableNext = VALID_TRANSITIONS[currentStatus] ?? []

  function formatTimelineDate(dateStr: string) {
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

  return (
    <div className="space-y-1">
      {sortedHistory.map((entry, idx) => {
        const isCurrent = entry.toStatus === currentStatus || (!entry.toStatus && entry.status === currentStatus)
        const prevConfig = entry.fromStatus ? PROJECT_STATUS_MAP[entry.fromStatus] : null
        const nextConfig = PROJECT_STATUS_MAP[entry.toStatus || entry.status]

        return (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05, duration: 0.3 }}
            className="flex items-start gap-3 relative"
          >
            {/* Vertical line + dot */}
            <div className="flex flex-col items-center shrink-0">
              <div className={`
                size-3 rounded-full mt-1.5
                ${isCurrent
                  ? 'bg-primary ring-4 ring-primary/20 animate-pulse'
                  : 'bg-green-500 dark:bg-green-600'
                }
              `} />
              {idx < sortedHistory.length - 1 && (
                <div className="w-0.5 h-full min-h-[24px] bg-border" />
              )}
            </div>

            {/* Content */}
            <div className={`flex-1 pb-4 ${isCurrent ? '' : ''}`}>
              <div className="flex items-center gap-2 flex-wrap">
                {prevConfig && (
                  <>
                    <Badge variant={prevConfig.variant} className={`text-xs ${prevConfig.className}`}>
                      {prevConfig.label}
                    </Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </>
                )}
                <Badge variant={nextConfig?.variant ?? 'secondary'} className={`text-xs ${nextConfig?.className}`}>
                  {nextConfig?.label ?? entry.status}
                </Badge>
              </div>

              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTimelineDate(entry.createdAt)}
                </span>
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {entry.changedBy || 'Система'}
                </span>
              </div>

              {entry.comment && (
                <div className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/40 rounded-md px-2 py-1.5">
                  <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                  <span>{entry.comment}</span>
                </div>
              )}
            </div>
          </motion.div>
        )
      })}

      {/* Available next statuses as ghost badges */}
      {availableNext.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-3 pt-3 border-t"
        >
          <p className="text-xs text-muted-foreground mb-2">Доступные переходы:</p>
          <div className="flex flex-wrap gap-2">
            {availableNext.map((status) => {
              const config = PROJECT_STATUS_MAP[status]
              return (
                <Badge
                  key={status}
                  variant="outline"
                  className="opacity-50 text-xs border-dashed"
                >
                  {config?.label ?? status}
                </Badge>
              )
            })}
          </div>
        </motion.div>
      )}

      {sortedHistory.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">История изменений пуста</p>
        </div>
      )}
    </div>
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
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [addDeliveryOpen, setAddDeliveryOpen] = useState(false)
  const [editDeliveryId, setEditDeliveryId] = useState<string | null>(null)

  // --- Delivery form state ---
  const [deliverySupplierId, setDeliverySupplierId] = useState('')
  const [deliveryCarrier, setDeliveryCarrier] = useState('')
  const [deliveryTrackingNumber, setDeliveryTrackingNumber] = useState('')
  const [deliveryEstimatedDate, setDeliveryEstimatedDate] = useState('')
  const [deliveryNotes, setDeliveryNotes] = useState('')

  // --- Queries ---

  const {
    data: project,
    isLoading,
    isError,
  } = useQuery<ProjectDetail>({
    queryKey: ['project', selectedProjectId],
    queryFn: async () => {
      const res = await authFetch(`/api/projects/${selectedProjectId}`)
      if (!res.ok) throw new Error('Не удалось загрузить проект')
      const data = await res.json()
      // Map API response to frontend ProjectDetail shape with safe defaults
      return {
        id: String(data.id),
        name: data.name || '',
        description: data.client || '',
        status: data.status || 'Проектирование',
        fileName: '',
        customerName: data.client || '',
        createdAt: data.created_at || new Date().toISOString(),
        updatedAt: data.updated_at || '',
        items: (data.items || []).map((item: any) => ({
          id: String(item.id),
          name: item.name || '',
          sku: item.sku || '',
          qty: item.qty || 0,
          status: item.status || 'К закупке',
          supplierId: item.supplier_id ? String(item.supplier_id) : null,
          stockItemId: item.stock_item_id ? String(item.stock_item_id) : null,
          projectId: String(item.project_id),
          createdAt: item.created_at || '',
          updatedAt: item.updated_at || '',
        })),
        purchaseRequests: data.purchaseRequests || [],
        invoices: data.invoices || [],
        statusHistory: data.statusHistory || [],
      }
    },
    enabled: !!selectedProjectId,
  })

  const {
    data: statusHistory = [],
  } = useQuery<StatusHistoryEntry[]>({
    queryKey: ['project-history', selectedProjectId],
    queryFn: async () => {
      const res = await authFetch(`/api/projects/${selectedProjectId}/history`)
      if (!res.ok) return []
      return res.json()
    },
    enabled: !!selectedProjectId,
  })

  const { data: deliveries = [] } = useQuery<Delivery[]>({
    queryKey: ['project-deliveries', selectedProjectId],
    queryFn: async () => {
      const res = await authFetch(`/api/deliveries?projectId=${selectedProjectId}`)
      if (!res.ok) return []
      return res.json()
    },
    enabled: !!selectedProjectId,
  })

  const { data: suppliers = [] } = useQuery<{ id: string; name: string; email: string }[]>({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const res = await authFetch('/api/suppliers')
      if (!res.ok) return []
      return res.json()
    },
  })

  // --- Mutations ---

  const updateProjectStatus = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      const res = await authFetch(`/api/projects/${selectedProjectId}/status`, {
        method: 'PUT',
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
        const res = await authFetch('/api/requests', {
          method: 'PUT',
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
      const res = await authFetch(`/api/invoices/${invoiceId}`, {
        method: 'PUT',
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
      const res = await authFetch(`/api/projects/${selectedProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemUpdates: [{ itemId, status }] }),
      })
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

  // --- Delivery mutations ---

  const createDeliveryMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch('/api/deliveries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: selectedProjectId,
          supplierId: deliverySupplierId,
          carrier: deliveryCarrier,
          trackingNumber: deliveryTrackingNumber,
          estimatedDate: deliveryEstimatedDate || null,
          notes: deliveryNotes,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка создания доставки')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-deliveries', selectedProjectId] })
      setAddDeliveryOpen(false)
      resetDeliveryForm()
      toast({ title: 'Доставка создана' })
    },
    onError: (err: Error) => {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' })
    },
  })

  const updateDeliveryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await authFetch(`/api/deliveries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Ошибка обновления доставки')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-deliveries', selectedProjectId] })
      toast({ title: 'Доставка обновлена' })
    },
    onError: (err: Error) => {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' })
    },
  })

  const resetDeliveryForm = useCallback(() => {
    setDeliverySupplierId('')
    setDeliveryCarrier('')
    setDeliveryTrackingNumber('')
    setDeliveryEstimatedDate('')
    setDeliveryNotes('')
    setEditDeliveryId(null)
  }, [])

  // --- Budget summary computations (must be before early returns) ---
  const budgetSummary = useMemo(() => {
    if (!project) return { totalBudget: 0, totalItems: 0, uniqueSuppliers: 0, requestCount: 0 }
    const totalBudget = project.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    const totalItems = project.items.length
    const uniqueSuppliers = new Set(project.items.filter(i => i.supplierId).map(i => i.supplierId)).size
    const requestCount = project.purchaseRequests.length
    return { totalBudget, totalItems, uniqueSuppliers, requestCount }
  }, [project])

  const budgetByCategory = useMemo(() => {
    if (!project) return []
    const catMap: Record<string, number> = {}
    for (const item of project.items) {
      const cat = item.category || 'Без категории'
      catMap[cat] = (catMap[cat] || 0) + item.price * item.quantity
    }
    const entries = Object.entries(catMap).sort((a, b) => b[1] - a[1])
    const maxAmount = entries.length > 0 ? entries[0][1] : 1
    return entries.map(([category, amount], idx) => ({
      category,
      amount,
      percent: (amount / maxAmount) * 100,
      color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
    }))
  }, [project])

  // --- Invalidate queries after status change ---
  const handleStatusChangeSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['project', selectedProjectId] })
    queryClient.invalidateQueries({ queryKey: ['project-history', selectedProjectId] })
    queryClient.invalidateQueries({ queryKey: ['projects'] })
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

  // --- Status banner color ---
  const statusBanner = PROJECT_STATUS_MAP[project?.status ?? 'new']
  const nextStep = STATUS_NEXT_STEP[project?.status ?? 'new']
  const allowedTransitions = VALID_TRANSITIONS[project.status] ?? []
  const canChangeStatus = allowedTransitions.length > 0

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      {project && statusBanner?.bannerClass && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`-mx-6 -mt-6 px-6 py-4 border-b ${statusBanner.bannerClass}`}
        >
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3 text-sm font-medium">
              <div className="flex size-8 items-center justify-center rounded-full bg-current/10">
                <div className="size-2.5 rounded-full bg-current opacity-80" />
              </div>
              <div>
                <span className="font-semibold">Статус: {statusBanner.label}</span>
                {project.customerName && (
                  <span className="opacity-60 ml-2">• Заказчик: {project.customerName}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {nextStep && project.status !== 'completed' && project.status !== 'cancelled' && (
                <div className="flex items-center gap-1.5 text-xs opacity-80">
                  <Lightbulb className="h-3.5 w-3.5" />
                  <span>Следующий шаг: {nextStep}</span>
                  <ArrowRight className="h-3 w-3" />
                </div>
              )}
              {canChangeStatus && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs bg-background/50"
                  onClick={() => setStatusModalOpen(true)}
                >
                  <RefreshCcw className="h-3 w-3" />
                  Изменить статус
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      )}

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
          <Button
            variant="outline"
            onClick={() => openReport('project-summary', project.id)}
            className="gap-2 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
          >
            <Printer className="h-4 w-4" />
            Печать отчёта
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(`/api/projects/${project.id}/export`, '_blank')}
            className="gap-2 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
          >
            <Download className="h-4 w-4" />
            Экспорт в Excel
          </Button>
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

      {/* Status Flow Diagram */}
      <StatusFlowDiagram currentStatus={project.status} />

      {/* Budget Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="rounded-xl border bg-gradient-to-br from-emerald-50/80 to-transparent dark:from-emerald-950/30 dark:to-transparent p-4 hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10">
              <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {budgetSummary.totalBudget.toLocaleString('ru-RU')} ₽
              </p>
              <p className="text-xs text-muted-foreground">Бюджет</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-xl border bg-gradient-to-br from-sky-50/80 to-transparent dark:from-sky-950/30 dark:to-transparent p-4 hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-sky-500/10">
              <Package className="h-5 w-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-sky-700 dark:text-sky-300">
                {budgetSummary.totalItems}
              </p>
              <p className="text-xs text-muted-foreground">Позиций</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-xl border bg-gradient-to-br from-violet-50/80 to-transparent dark:from-violet-950/30 dark:to-transparent p-4 hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-violet-500/10">
              <Building2 className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-violet-700 dark:text-violet-300">
                {budgetSummary.uniqueSuppliers}
              </p>
              <p className="text-xs text-muted-foreground">Поставщиков</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border bg-gradient-to-br from-amber-50/80 to-transparent dark:from-amber-950/30 dark:to-transparent p-4 hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-amber-500/10">
              <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">
                {budgetSummary.requestCount}
              </p>
              <p className="text-xs text-muted-foreground">Запросов</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="items">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="items" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-primary">
            <Package className="h-4 w-4" />
            Позиции
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] rounded-full">
              {project.items.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-primary">
            <Mail className="h-4 w-4" />
            Запросы
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] rounded-full">
              {project.purchaseRequests.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-primary">
            <FileText className="h-4 w-4" />
            Счета
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] rounded-full">
              {project.invoices.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="deliveries" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-primary">
            <Truck className="h-4 w-4" />
            Доставка
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] rounded-full">
              {deliveries.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:border-b-2 data-[state=active]:border-primary">
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
            <EmptyState type="items" />
          ) : (
            <div className="space-y-4">
              {/* Budget Breakdown by Category */}
              {budgetByCategory.length > 0 && (
                <div className="rounded-xl border p-4 bg-gradient-to-br from-muted/30 to-transparent">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4 text-primary" />
                    Бюджет по категориям
                  </h3>
                  <div className="space-y-2.5">
                    {budgetByCategory.map((cat, idx) => (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-muted-foreground hover:text-foreground transition-colors">
                            {cat.category}
                          </span>
                          <span className="font-semibold">
                            {cat.amount.toLocaleString('ru-RU')} ₽
                          </span>
                        </div>
                        <div className="h-2.5 rounded-full bg-muted/60 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${cat.percent}%` }}
                            transition={{ duration: 0.6, delay: idx * 0.08, ease: 'easeOut' }}
                            className={`h-full rounded-full ${cat.color} opacity-80`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-2 border-t flex items-center justify-between text-xs">
                    <span className="font-medium">Итого</span>
                    <span className="font-bold text-sm">
                      {budgetSummary.totalBudget.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                </div>
              )}

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
                      <div className="flex items-center gap-2 rounded-lg border bg-gradient-to-r from-primary/5 to-transparent px-4 py-2.5 cursor-pointer hover:from-primary/10 transition-all duration-200">
                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 text-primary/60 transition-transform" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-primary/60 transition-transform" />
                        )}
                        <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <Package className="size-3.5" />
                        </div>
                        <span className="font-medium text-sm">
                          {supplierName}
                        </span>
                        <Badge variant="secondary" className="text-xs rounded-full">
                          {group.items.length} поз.
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="rounded-b-lg border border-t-0" style={{ animation: 'slide-down 0.3s ease-out' }}>
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
            </div>
          )}
        </TabsContent>

        {/* ===== Tab: Запросы ===== */}
        <TabsContent value="requests" className="space-y-4">
          {project.purchaseRequests.length === 0 ? (
            <EmptyState type="requests" />
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
                                  {ri.price.toLocaleString('ru-RU')} ₽
                                </TableCell>
                                <TableCell>
                                  {ri.available ? (
                                    <Badge variant="outline" className="text-xs border-green-500 text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-950/30">
                                      Да ({ri.availableQty})
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-xs">
                                      Нет
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>{ri.deliveryDays || '—'}</TableCell>
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

        {/* ===== Tab: Счета ===== */}
        <TabsContent value="invoices" className="space-y-4">
          {project.invoices.length === 0 ? (
            <EmptyState type="invoices" />
          ) : (
            <div className="space-y-2">
              {project.invoices.map((invoice) => {
                const isOpen = expandedInvoices[invoice.id] ?? false

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
                              <StatusBadge
                                status={invoice.status}
                                map={INVOICE_STATUS_MAP}
                              />
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {invoice.invoiceNumber} • {invoice.totalAmount.toLocaleString('ru-RU')} ₽ • {formatShortDate(invoice.receivedAt)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {invoice.status === 'received' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                verifyInvoiceMutation.mutate(invoice.id)
                              }}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Проверить
                            </Button>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {invoice.items.length} поз.
                          </Badge>
                        </div>
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
                              <TableHead>Совпадение</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {invoice.items.map((ii) => (
                              <TableRow key={ii.id}>
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
                                  {ii.isMatch ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <XCircle className="h-4 w-4 text-red-500" />
                                  )}
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

        {/* ===== Tab: Доставка ===== */}
        <TabsContent value="deliveries" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => { resetDeliveryForm(); setAddDeliveryOpen(true) }}>
              <Truck className="h-4 w-4" />
              Новая доставка
            </Button>
            <Button variant="outline" onClick={() => window.open(`/api/reports?type=project-summary&projectId=${project.id}`, '_blank')}>
              <Printer className="h-4 w-4" />
              Печать отчёта
            </Button>
          </div>

          {/* Add/Edit delivery dialog */}
          <Dialog open={addDeliveryOpen} onOpenChange={setAddDeliveryOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  Новая доставка
                </DialogTitle>
                <DialogDescription>Добавить отслеживание доставки для проекта</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Поставщик *</Label>
                  <Select value={deliverySupplierId} onValueChange={setDeliverySupplierId}>
                    <SelectTrigger><SelectValue placeholder="Выберите поставщика" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Перевозчик (ТК)</Label>
                    <Select value={deliveryCarrier} onValueChange={setDeliveryCarrier}>
                      <SelectTrigger><SelectValue placeholder="Выберите ТК" /></SelectTrigger>
                      <SelectContent>
                        {CARRIERS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Трек-номер</Label>
                    <Input placeholder="XXX-123456789" value={deliveryTrackingNumber} onChange={e => setDeliveryTrackingNumber(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Ожидаемая дата доставки</Label>
                  <input type="date" value={deliveryEstimatedDate} onChange={e => setDeliveryEstimatedDate(e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                </div>
                <div className="space-y-2">
                  <Label>Примечания</Label>
                  <Textarea placeholder="Комментарий к доставке..." value={deliveryNotes} onChange={e => setDeliveryNotes(e.target.value)} className="min-h-[60px] resize-none" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddDeliveryOpen(false)}>Отмена</Button>
                <Button disabled={!deliverySupplierId || createDeliveryMutation.isPending} onClick={() => createDeliveryMutation.mutate()}>
                  {createDeliveryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Truck className="h-4 w-4 mr-1" />}
                  Создать
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delivery cards */}
          {deliveries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Нет доставок</p>
              <p className="text-xs mt-1">Создайте доставку для отслеживания</p>
            </div>
          ) : (
            <div className="space-y-4">
              {deliveries.map((delivery, idx) => {
                const statusConfig = DELIVERY_STATUS_MAP[delivery.status] ?? DELIVERY_STATUS_MAP.pending
                return (
                  <motion.div
                    key={delivery.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06 }}
                  >
                    <Card className={`border-l-4 ${statusConfig.borderColor} overflow-hidden`}>
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            {/* Header */}
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`flex size-8 items-center justify-center rounded-full ${statusConfig.bgColor}`}>
                                <Truck className={`size-4 ${statusConfig.color}`} />
                              </div>
                              <div>
                                <p className="font-semibold text-sm">{delivery.carrier || 'Не указан'}</p>
                                <p className="text-xs text-muted-foreground">{delivery.supplier.name}</p>
                              </div>
                              <Badge className={`ml-auto ${statusConfig.bgColor} ${statusConfig.color} border ${statusConfig.borderColor}`}>
                                {statusConfig.label}
                              </Badge>
                            </div>

                            {/* Progress bar */}
                            <div className="mb-3">
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                                <span>Ожидание</span><span>Отправлено</span><span>В пути</span><span>Доставлено</span>
                              </div>
                              <Progress value={statusConfig.progress} className="h-2" />
                            </div>

                            {/* Details grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                              {delivery.trackingNumber && (
                                <div className="flex items-center gap-1.5">
                                  <Navigation className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-muted-foreground">Трек:</span>
                                  <span className="font-mono font-medium">{delivery.trackingNumber}</span>
                                </div>
                              )}
                              {delivery.estimatedDate && (
                                <div className="flex items-center gap-1.5">
                                  <Clock className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-muted-foreground">Ожид.:</span>
                                  <span>{new Date(delivery.estimatedDate).toLocaleDateString('ru-RU')}</span>
                                </div>
                              )}
                              {delivery.actualDate && (
                                <div className="flex items-center gap-1.5">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                  <span className="text-muted-foreground">Факт.:</span>
                                  <span>{new Date(delivery.actualDate).toLocaleDateString('ru-RU')}</span>
                                </div>
                              )}
                              {delivery.invoice && (
                                <div className="flex items-center gap-1.5">
                                  <Receipt className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-muted-foreground">Счёт:</span>
                                  <span>{delivery.invoice.invoiceNumber || delivery.invoice.id.slice(0, 8)}</span>
                                </div>
                              )}
                            </div>

                            {delivery.notes && (
                              <div className="mt-2 text-xs text-muted-foreground bg-muted/30 rounded-md px-2 py-1.5">
                                {delivery.notes}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                          {delivery.status === 'pending' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => updateDeliveryMutation.mutate({ id: delivery.id, data: { status: 'shipped' } })}>
                              <Navigation className="h-3 w-3" /> Отправлено
                            </Button>
                          )}
                          {delivery.status === 'shipped' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => updateDeliveryMutation.mutate({ id: delivery.id, data: { status: 'in_transit' } })}>
                              <Truck className="h-3 w-3" /> В пути
                            </Button>
                          )}
                          {delivery.status === 'in_transit' && (
                            <Button size="sm" className="h-7 text-xs gap-1" onClick={() => updateDeliveryMutation.mutate({ id: delivery.id, data: { status: 'delivered' } })}>
                              <CheckCircle2 className="h-3 w-3" /> Доставлено
                            </Button>
                          )}
                          {!['delivered', 'cancelled'].includes(delivery.status) && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-red-500" onClick={() => updateDeliveryMutation.mutate({ id: delivery.id, data: { status: 'cancelled' } })}>
                              <Ban className="h-3 w-3" /> Отменить
                            </Button>
                          )}
                          {delivery.status !== 'cancelled' && delivery.status !== 'delivered' && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 ml-auto" onClick={() => {
                              const newTracking = prompt('Введите трек-номер:', delivery.trackingNumber)
                              if (newTracking !== null) updateDeliveryMutation.mutate({ id: delivery.id, data: { trackingNumber: newTracking } })
                            }}>
                              <Navigation className="h-3 w-3" /> Трек-номер
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ===== Tab: История ===== */}
        <TabsContent value="history" className="space-y-4">
          <div className="rounded-xl border bg-card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">История изменений статуса</h3>
              </div>
              {canChangeStatus && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => setStatusModalOpen(true)}
                >
                  <RefreshCcw className="h-3 w-3" />
                  Изменить статус
                </Button>
              )}
            </div>
            <EnhancedTimeline statusHistory={statusHistory} currentStatus={project.status} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Status Transition Modal */}
      <StatusTransitionModal
        open={statusModalOpen}
        onOpenChange={setStatusModalOpen}
        currentStatus={project.status}
        projectId={project.id}
        onSuccess={handleStatusChangeSuccess}
      />
    </div>
  )
}
