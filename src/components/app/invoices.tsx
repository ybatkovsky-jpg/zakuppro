'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
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
  FileDown,
  ArrowRight,
  Scale,
  ArrowUpRight,
  ArrowDownRight,
  Package,
  DollarSign,
  ShieldCheck,
  Printer,
  CalendarIcon,
  X,
  Clock,
  TrendingUp,
  CircleDot,
  CheckCheck,
  Wallet,
  FileSpreadsheet,
  Eye,
} from 'lucide-react'
import { EmptyState } from '@/components/app/empty-state'
import { exportToCSV } from '@/lib/export-csv'
import { openReport } from '@/lib/print-report'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

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

// ── Reconciliation Types ───────────────────────────────────

interface ReconcileMatchItem {
  id: string
  name: string
  quantity: number
  price: number
}

interface ReconcileMatch {
  requestItem: ReconcileMatchItem
  invoiceItem: ReconcileMatchItem
  nameMatch: boolean
  quantityMatch: boolean
  priceMatch: boolean
  matchScore: number
}

interface ReconcileSummary {
  totalRequestItems: number
  totalInvoiceItems: number
  matchedItems: number
  quantityDiscrepancies: number
  priceDiscrepancies: number
  unmatchedRequestItems: number
  unmatchedInvoiceItems: number
  totalRequestAmount: number
  totalInvoiceAmount: number
  amountDifference: number
}

interface ReconciliationResult {
  invoiceId: string
  requestId: string | null
  invoiceNumber: string
  projectName: string
  supplierName: string
  invoiceStatus: string
  matches: ReconcileMatch[]
  unmatchedRequestItems: ReconcileMatchItem[]
  unmatchedInvoiceItems: ReconcileMatchItem[]
  summary: ReconcileSummary
}

// ── Status helpers ─────────────────────────────────────────

const INVOICE_STATUS_MAP: Record<string, {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  className?: string
  leftBorder?: string
  animatedIcon?: string
  dotColor?: string
  bgColor?: string
  icon: typeof FileText
}> = {
  received: {
    label: 'Получен',
    variant: 'secondary',
    className: 'rounded-full',
    leftBorder: 'border-l-slate-400',
    animatedIcon: 'text-slate-500',
    dotColor: 'bg-slate-400',
    bgColor: 'bg-slate-100 dark:bg-slate-900/30',
    icon: FileText,
  },
  verified: {
    label: 'Проверен',
    variant: 'default',
    className: 'rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950/30 dark:text-sky-400 border-sky-200 dark:border-sky-800',
    leftBorder: 'border-l-sky-500',
    animatedIcon: 'text-sky-500',
    dotColor: 'bg-sky-500',
    bgColor: 'bg-sky-100 dark:bg-sky-900/30',
    icon: CheckCircle2,
  },
  discrepancy: {
    label: 'Расхождение',
    variant: 'destructive',
    className: 'rounded-full',
    leftBorder: 'border-l-red-500',
    animatedIcon: 'text-red-500',
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: AlertTriangle,
  },
  approved: {
    label: 'Утверждён',
    variant: 'default',
    className: 'rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    leftBorder: 'border-l-emerald-500',
    animatedIcon: 'text-emerald-500',
    dotColor: 'bg-emerald-500',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    icon: CheckCheck,
  },
  paid: {
    label: 'Оплачен',
    variant: 'default',
    className: 'rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
    leftBorder: 'border-l-green-500',
    animatedIcon: 'text-green-500',
    dotColor: 'bg-green-500',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    icon: Wallet,
  },
  cancelled: {
    label: 'Отменён',
    variant: 'destructive',
    className: 'rounded-full',
    leftBorder: 'border-l-red-400',
    animatedIcon: 'text-red-400',
    dotColor: 'bg-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    icon: XCircle,
  },
}

function StatusBadge({ status }: { status: string }) {
  const info = INVOICE_STATUS_MAP[status] || { label: status, variant: 'outline' as const, className: 'rounded-full', animatedIcon: '', icon: FileText }
  return (
    <div className="flex items-center gap-1.5">
      {info.animatedIcon && (
        <FileText className={`h-3.5 w-3.5 animate-status-icon ${info.animatedIcon}`} />
      )}
      <Badge variant={info.variant} className={info.className}>{info.label}</Badge>
    </div>
  )
}

// ── Relative time helper ──────────────────────────────────

function getRelativeTime(dateStr: string): string | null {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHrs = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'только что'
  if (diffMin < 60) return `${diffMin} мин назад`
  if (diffHrs < 24) return `${diffHrs} ч назад`
  if (diffDays < 7) return `${diffDays} дн назад`
  return null
}

// ── Skeleton Loading ───────────────────────────────────────

function InvoicePageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="relative -mx-6 -mt-6 px-6 pt-6 pb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      </div>

      {/* Summary cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline skeleton */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-2 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center flex-1 last:flex-initial">
                <div className="flex flex-col items-center gap-2">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <Skeleton className="h-3 w-16" />
                </div>
                {i < 3 && <Skeleton className="flex-1 h-0.5 mx-2" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filter bar skeleton */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4 items-center">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="flex-1 h-9" />
          </div>
        </CardContent>
      </Card>

      {/* Table skeleton */}
      <Card>
        <CardContent className="p-0">
          <div className="space-y-0">
            <div className="border-b px-4 py-3 flex gap-4">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="border-b px-4 py-3 flex gap-4 items-center">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-28" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ── Invoice Workflow Visualization ──────────────────────────

const WORKFLOW_STEPS = [
  { status: 'received', label: 'Получен', color: 'slate', circleBg: 'bg-slate-200 dark:bg-slate-700', circleText: 'text-slate-700 dark:text-slate-300', activeBg: 'bg-slate-500', glowColor: 'shadow-slate-400/50', icon: FileText },
  { status: 'verified', label: 'Проверен', color: 'sky', circleBg: 'bg-sky-200 dark:bg-sky-700', circleText: 'text-sky-700 dark:text-sky-300', activeBg: 'bg-sky-500', glowColor: 'shadow-sky-400/50', icon: CheckCircle2 },
  { status: 'approved', label: 'Утверждён', color: 'emerald', circleBg: 'bg-emerald-200 dark:bg-emerald-700', circleText: 'text-emerald-700 dark:text-emerald-300', activeBg: 'bg-emerald-500', glowColor: 'shadow-emerald-400/50', icon: CheckCheck },
  { status: 'paid', label: 'Оплачен', color: 'green', circleBg: 'bg-green-200 dark:bg-green-700', circleText: 'text-green-700 dark:text-green-300', activeBg: 'bg-green-500', glowColor: 'shadow-green-400/50', icon: Wallet },
] as const

function InvoiceWorkflow({ invoices }: { invoices: InvoiceListItem[] }) {
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    WORKFLOW_STEPS.forEach((s) => { counts[s.status] = 0 })
    invoices.forEach((inv) => {
      if (counts[inv.status] !== undefined) {
        counts[inv.status]++
      }
    })
    return counts
  }, [invoices])

  const activeStepIndex = useMemo(() => {
    let highest = -1
    WORKFLOW_STEPS.forEach((step, idx) => {
      if ((statusCounts[step.status] ?? 0) > 0) {
        highest = idx
      }
    })
    return highest
  }, [statusCounts])

  return (
    <div className="flex items-center justify-between gap-2 py-2">
      {WORKFLOW_STEPS.map((step, idx) => {
        const count = statusCounts[step.status] ?? 0
        const isActive = idx <= activeStepIndex
        const isCurrentStep = idx === activeStepIndex
        const StepIcon = step.icon

        return (
          <div key={step.status} className="flex items-center flex-1 last:flex-initial">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1, duration: 0.3 }}
              className="flex flex-col items-center gap-2"
            >
              <div
                className={`
                  relative flex size-12 items-center justify-center rounded-full transition-all duration-500
                  ${isActive
                    ? `${step.activeBg} text-white ${isCurrentStep ? `shadow-lg ${step.glowColor} ring-2 ring-offset-2 ring-offset-background ${step.activeBg.replace('bg-', 'ring-')}` : ''}`
                    : `${step.circleBg} ${step.circleText}`
                  }
                `}
              >
                {isActive ? (
                  <StepIcon className="h-5 w-5" />
                ) : (
                  <span className="text-sm font-bold">{count}</span>
                )}
                {isCurrentStep && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-current"
                    initial={{ scale: 1, opacity: 0.6 }}
                    animate={{ scale: 1.3, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
              </div>

              <div className="flex flex-col items-center">
                <span className={`text-xs font-medium whitespace-nowrap ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
                <span className={`text-[10px] ${isActive ? 'text-foreground/70' : 'text-muted-foreground/60'}`}>
                  {count} сч.
                </span>
              </div>
            </motion.div>

            {idx < WORKFLOW_STEPS.length - 1 && (
              <div className="flex-1 flex items-center justify-center px-1 -mt-5">
                <div className="h-[2px] w-full rounded-full bg-muted relative overflow-hidden">
                  <motion.div
                    className={`absolute inset-y-0 left-0 rounded-full ${idx < activeStepIndex ? step.activeBg : 'bg-muted-foreground/30'}`}
                    initial={{ width: '0%' }}
                    animate={{ width: idx < activeStepIndex ? '100%' : '0%' }}
                    transition={{ delay: idx * 0.1 + 0.2, duration: 0.4 }}
                  />
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 -ml-0.5" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── New invoice item type ──────────────────────────────────

interface NewInvoiceItem {
  name: string
  quantity: number
  price: number
  projectItemId: string | null
}

// ── Match Status Icon Component ────────────────────────────

function MatchStatusIcon({ match }: { match: ReconcileMatch }) {
  const isFullMatch = match.nameMatch && match.quantityMatch && match.priceMatch
  const isPartialMatch = match.nameMatch && (!match.quantityMatch || !match.priceMatch)
  const isNoMatch = !match.nameMatch

  if (isFullMatch) {
    return (
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Совпадение</span>
      </div>
    )
  }

  if (isPartialMatch) {
    return (
      <div className="flex items-center gap-1.5">
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Расхождение</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <XCircle className="h-5 w-5 text-red-500" />
      <span className="text-xs font-medium text-red-600 dark:text-red-400">Не совпадает</span>
    </div>
  )
}

// ── Quantity/Price Difference Indicator ────────────────────

function DifferenceIndicator({ request, invoice, type }: { request: number; invoice: number; type: 'quantity' | 'price' }) {
  const diff = invoice - request
  if (diff === 0) return null

  const isIncrease = diff > 0
  const absDiff = Math.abs(diff)
  const formattedDiff = type === 'price'
    ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(absDiff)
    : String(absDiff)

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isIncrease ? 'text-red-500' : 'text-amber-500'}`}>
      {isIncrease ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {formattedDiff}
    </span>
  )
}

// ── Reconciliation Sheet Component ─────────────────────────

function ReconciliationSheet({
  open,
  onOpenChange,
  reconciliation,
  onVerify,
  isVerifying,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  reconciliation: ReconciliationResult | null
  onVerify: () => void
  isVerifying: boolean
}) {
  const formatAmount = (n: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(n)

  const { matches, unmatchedRequestItems, unmatchedInvoiceItems, summary } = reconciliation ?? {
    matches: [], unmatchedRequestItems: [], unmatchedInvoiceItems: [],
    summary: {
      totalRequestItems: 0, totalInvoiceItems: 0, matchedItems: 0,
      quantityDiscrepancies: 0, priceDiscrepancies: 0,
      unmatchedRequestItems: 0, unmatchedInvoiceItems: 0,
      totalRequestAmount: 0, totalInvoiceAmount: 0, amountDifference: 0,
    },
  }

  if (!reconciliation) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto p-0">
          <SheetHeader className="p-4">
            <SheetTitle>Сверка счёта</SheetTitle>
            <SheetDescription>Загрузка данных сверки...</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Сравнение позиций запроса и счёта...</p>
          </div>
        </SheetContent>
      </Sheet>
    )
  }
  const allGood = summary.unmatchedRequestItems === 0 && summary.unmatchedInvoiceItems === 0 && summary.quantityDiscrepancies === 0 && summary.priceDiscrepancies === 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b">
          <SheetHeader className="p-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/30">
                <Scale className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <SheetTitle className="text-lg">
                  Сверка счёта {reconciliation.invoiceNumber ? `№ ${reconciliation.invoiceNumber}` : ''}
                </SheetTitle>
                <SheetDescription className="text-sm">
                  {reconciliation.projectName} • {reconciliation.supplierName}
                </SheetDescription>
              </div>
              <div className="ml-auto">
                <StatusBadge status={reconciliation.invoiceStatus} />
              </div>
            </div>
          </SheetHeader>
        </div>

        <div className="p-4 space-y-5">
          {/* Summary Cards */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/20 p-3 text-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summary.matchedItems}</p>
              <p className="text-xs text-muted-foreground">Совпадений</p>
            </div>
            <div className="rounded-xl border bg-amber-50 dark:bg-amber-950/20 p-3 text-center">
              <AlertTriangle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary.quantityDiscrepancies + summary.priceDiscrepancies}</p>
              <p className="text-xs text-muted-foreground">Расхождений</p>
            </div>
            <div className="rounded-xl border bg-red-50 dark:bg-red-950/20 p-3 text-center">
              <XCircle className="h-5 w-5 text-red-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.unmatchedRequestItems + summary.unmatchedInvoiceItems}</p>
              <p className="text-xs text-muted-foreground">Не сопоставлено</p>
            </div>
            <div className="rounded-xl border bg-sky-50 dark:bg-sky-950/20 p-3 text-center">
              <DollarSign className="h-5 w-5 text-sky-500 mx-auto mb-1" />
              <p className={`text-2xl font-bold ${summary.amountDifference > 0 ? 'text-red-600' : summary.amountDifference < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {summary.amountDifference > 0 ? '+' : ''}{formatAmount(summary.amountDifference)}
              </p>
              <p className="text-xs text-muted-foreground">Разница сумм</p>
            </div>
          </motion.div>

          {/* Visual comparison header */}
          <div className="grid grid-cols-[1fr,40px,1fr] gap-2 items-center">
            <div className="flex items-center gap-2 text-sm font-semibold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/20 rounded-lg px-3 py-2">
              <FileText className="h-4 w-4" />
              Запрос ({summary.totalRequestItems} поз.)
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-lg px-3 py-2">
              <Receipt className="h-4 w-4" />
              Счёт ({summary.totalInvoiceItems} поз.)
            </div>
          </div>

          <Separator />

          {/* Matched items - improved visual comparison */}
          <AnimatePresence>
            {matches.map((match, idx) => {
              const isFullMatch = match.nameMatch && match.quantityMatch && match.priceMatch
              return (
                <motion.div
                  key={`${match.requestItem.id}-${match.invoiceItem.id}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.25 }}
                  className={`rounded-xl border overflow-hidden ${
                    isFullMatch
                      ? 'border-emerald-200 dark:border-emerald-800'
                      : match.nameMatch
                        ? 'border-amber-200 dark:border-amber-800'
                        : 'border-red-200 dark:border-red-800'
                  }`}
                >
                  {/* Match status bar */}
                  <div className={`px-3 py-1.5 text-xs font-medium flex items-center justify-between ${
                    isFullMatch
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400'
                      : match.nameMatch
                        ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400'
                        : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400'
                  }`}>
                    <MatchStatusIcon match={match} />
                    {match.matchScore < 1 && (
                      <span className="text-xs opacity-70">
                        Совпадение имён: {Math.round(match.matchScore * 100)}%
                      </span>
                    )}
                  </div>

                  {/* Two-column visual comparison */}
                  <div className="grid grid-cols-[1fr,40px,1fr] gap-0">
                    {/* Request item */}
                    <div className="p-3 border-r bg-sky-50/30 dark:bg-sky-950/10 space-y-1.5">
                      <p className="text-sm font-medium">{match.requestItem.name}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 bg-background/80 rounded px-1.5 py-0.5 text-muted-foreground">
                          <Package className="h-3 w-3" />
                          {match.requestItem.quantity} шт
                        </span>
                        <span className="inline-flex items-center gap-1 bg-background/80 rounded px-1.5 py-0.5 text-muted-foreground">
                          <DollarSign className="h-3 w-3" />
                          {formatAmount(match.requestItem.price)}
                        </span>
                      </div>
                    </div>

                    {/* Center arrow / status */}
                    <div className="flex items-center justify-center bg-muted/20">
                      {isFullMatch ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                    </div>

                    {/* Invoice item */}
                    <div className="p-3 bg-amber-50/30 dark:bg-amber-950/10 space-y-1.5">
                      <p className="text-sm font-medium">{match.invoiceItem.name}</p>
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="inline-flex items-center gap-1 bg-background/80 rounded px-1.5 py-0.5 text-muted-foreground">
                          <Package className="h-3 w-3" />
                          {match.invoiceItem.quantity} шт
                        </span>
                        <DifferenceIndicator request={match.requestItem.quantity} invoice={match.invoiceItem.quantity} type="quantity" />
                      </div>
                      <div className="flex items-center gap-2 text-xs flex-wrap">
                        <span className="inline-flex items-center gap-1 bg-background/80 rounded px-1.5 py-0.5 text-muted-foreground">
                          <DollarSign className="h-3 w-3" />
                          {formatAmount(match.invoiceItem.price)}
                        </span>
                        <DifferenceIndicator request={match.requestItem.price} invoice={match.invoiceItem.price} type="price" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* Unmatched request items */}
          {unmatchedRequestItems.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                В запросе без соответствия в счёте ({unmatchedRequestItems.length})
              </h4>
              {unmatchedRequestItems.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/10 p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{item.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{item.quantity} шт</span>
                      <span>{formatAmount(item.price)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Unmatched invoice items */}
          {unmatchedInvoiceItems.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                В счёте без соответствия в запросе ({unmatchedInvoiceItems.length})
              </h4>
              {unmatchedInvoiceItems.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/10 p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{item.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{item.quantity} шт</span>
                      <span>{formatAmount(item.price)}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Totals comparison */}
          <Separator />
          <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Итоги сверки
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg bg-sky-50 dark:bg-sky-950/10 p-3">
                <p className="text-muted-foreground text-xs">Сумма по запросу</p>
                <p className="font-semibold text-lg">{formatAmount(summary.totalRequestAmount)}</p>
              </div>
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/10 p-3">
                <p className="text-muted-foreground text-xs">Сумма по счёту</p>
                <p className="font-semibold text-lg">{formatAmount(summary.totalInvoiceAmount)}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Разница</span>
              <span className={`text-sm font-bold ${
                summary.amountDifference === 0
                  ? 'text-emerald-600'
                  : 'text-red-600'
              }`}>
                {summary.amountDifference > 0 ? '+' : ''}{formatAmount(summary.amountDifference)}
              </span>
            </div>
          </div>

          {/* Overall result */}
          <div className={`rounded-xl p-4 ${
            allGood
              ? 'bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800'
              : 'bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800'
          }`}>
            <div className="flex items-start gap-3">
              {allGood ? (
                <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="text-sm font-semibold">
                  {allGood
                    ? 'Полное совпадение — все позиции сверены'
                    : 'Обнаружены расхождения'}
                </p>
                {!allGood && (
                  <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                    {summary.quantityDiscrepancies > 0 && (
                      <li>• {summary.quantityDiscrepancies} поз. с расхождением количества</li>
                    )}
                    {summary.priceDiscrepancies > 0 && (
                      <li>• {summary.priceDiscrepancies} поз. с расхождением цены</li>
                    )}
                    {summary.unmatchedRequestItems > 0 && (
                      <li>• {summary.unmatchedRequestItems} поз. в запросе без соответствия</li>
                    )}
                    {summary.unmatchedInvoiceItems > 0 && (
                      <li>• {summary.unmatchedInvoiceItems} поз. в счёте без соответствия</li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer with actions */}
        <SheetFooter className="border-t p-4 bg-background sticky bottom-0">
          <div className="flex gap-2 w-full sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Закрыть
            </Button>
            {(reconciliation.invoiceStatus === 'received' || reconciliation.invoiceStatus === 'verified' || reconciliation.invoiceStatus === 'discrepancy') && (
              <Button
                type="button"
                onClick={onVerify}
                disabled={isVerifying}
                className={allGood ? '' : 'bg-amber-600 hover:bg-amber-700'}
              >
                {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <ShieldCheck className="mr-2 h-4 w-4" />
                {allGood ? 'Подтвердить сверку' : 'Подтвердить с расхождениями'}
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ── Main Component ─────────────────────────────────────────

export function Invoices() {
  const queryClient = useQueryClient()

  // Filters
  const [projectFilter, setProjectFilter] = useState<string>('all')
  const [supplierFilter, setSupplierFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined)
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined)
  const [calendarOpen, setCalendarOpen] = useState<'from' | 'to' | null>(null)

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

  // Reconciliation sheet
  const [reconcileOpen, setReconcileOpen] = useState(false)
  const [reconcileInvoiceId, setReconcileInvoiceId] = useState<string | null>(null)

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

  // Reconciliation data query
  const { data: reconciliationData } = useQuery({
    queryKey: ['reconcile', reconcileInvoiceId],
    queryFn: async () => {
      if (!reconcileInvoiceId) return null
      const res = await fetch(`/api/invoices/${reconcileInvoiceId}/reconcile`)
      if (!res.ok) throw new Error('Failed to fetch reconciliation data')
      return res.json() as Promise<ReconciliationResult>
    },
    enabled: !!reconcileInvoiceId,
  })

  // ── Filtered invoices ──────────────────────────────────────

  const filteredInvoices = useMemo(() => {
    let result = invoicesList

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (inv) =>
          inv.supplier.name.toLowerCase().includes(q) ||
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.project.name.toLowerCase().includes(q)
      )
    }

    // Status filter
    if (statusFilter && statusFilter !== 'all') {
      result = result.filter((inv) => inv.status === statusFilter)
    }

    // Supplier filter
    if (supplierFilter && supplierFilter !== 'all') {
      result = result.filter((inv) => inv.supplierId === supplierFilter)
    }

    // Date range filter
    if (dateFrom) {
      result = result.filter((inv) => new Date(inv.receivedAt) >= dateFrom)
    }
    if (dateTo) {
      const toDate = new Date(dateTo)
      toDate.setHours(23, 59, 59, 999)
      result = result.filter((inv) => new Date(inv.receivedAt) <= toDate)
    }

    return result
  }, [invoicesList, searchQuery, statusFilter, supplierFilter, dateFrom, dateTo])

  // ── Summary calculations ───────────────────────────────────

  const summary = useMemo(() => {
    const total = invoicesList.length
    const totalAmount = invoicesList.reduce((sum, inv) => sum + inv.totalAmount, 0)
    const byStatus: Record<string, { count: number; amount: number }> = {}
    Object.keys(INVOICE_STATUS_MAP).forEach((status) => {
      const statusInvoices = invoicesList.filter((inv) => inv.status === status)
      byStatus[status] = {
        count: statusInvoices.length,
        amount: statusInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      }
    })
    const paidAmount = byStatus.paid?.amount ?? 0
    const pendingAmount = totalAmount - paidAmount
    return { total, totalAmount, byStatus, paidAmount, pendingAmount }
  }, [invoicesList])

  const filteredSummary = useMemo(() => {
    const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0)
    return { total: filteredInvoices.length, totalAmount }
  }, [filteredInvoices])

  const hasActiveFilters = statusFilter !== 'all' || supplierFilter !== 'all' || dateFrom || dateTo || searchQuery.trim()

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

  const openReconcile = (invoiceId: string) => {
    setReconcileInvoiceId(invoiceId)
    setReconcileOpen(true)
  }

  const handleReconcileVerify = () => {
    if (!reconcileInvoiceId) return
    const hasDiscrepancies = reconciliationData && (
      reconciliationData.summary.quantityDiscrepancies > 0 ||
      reconciliationData.summary.priceDiscrepancies > 0 ||
      reconciliationData.summary.unmatchedRequestItems > 0 ||
      reconciliationData.summary.unmatchedInvoiceItems > 0
    )
    const newStatus = hasDiscrepancies ? 'discrepancy' : 'verified'
    updateMutation.mutate(
      { id: reconcileInvoiceId, data: { status: newStatus } },
      {
        onSuccess: () => {
          setReconcileOpen(false)
          setReconcileInvoiceId(null)
          queryClient.invalidateQueries({ queryKey: ['reconcile'] })
          toast({
            title: hasDiscrepancies ? 'Сверка завершена с расхождениями' : 'Сверка подтверждена',
            description: hasDiscrepancies
              ? 'Счёт помечен как имеющий расхождения'
              : 'Все позиции совпадают, счёт проверен',
          })
        },
      }
    )
  }

  const formatDate = (d: string | null) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const formatAmount = (n: number) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(n)

  const clearAllFilters = () => {
    setProjectFilter('all')
    setSupplierFilter('all')
    setStatusFilter('all')
    setSearchQuery('')
    setDateFrom(undefined)
    setDateTo(undefined)
  }

  // ── Render ─────────────────────────────────────────────────

  if (invoicesLoading) {
    return <InvoicePageSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative -mx-6 -mt-6 px-6 pt-6 pb-5 bg-gradient-to-b from-amber-500/5 via-amber-500/[0.02] to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Receipt className="h-6 w-6 text-amber-600" />
              Счета
            </h2>
            <p className="text-muted-foreground text-sm">Управление входящими счетами от поставщиков</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const csvData = filteredInvoices.map((inv) => ({
                  Проект: inv.project.name,
                  Поставщик: inv.supplier.name,
                  '№ счёта': inv.invoiceNumber || '',
                  Сумма: inv.totalAmount,
                  Статус: INVOICE_STATUS_MAP[inv.status]?.label ?? inv.status,
                  'Дата получения': formatDate(inv.receivedAt),
                  'Дата оплаты': formatDate(inv.paidAt),
                }))
                exportToCSV(csvData, 'invoices.csv', [
                  { key: 'Проект', header: 'Проект' },
                  { key: 'Поставщик', header: 'Поставщик' },
                  { key: '№ счёта', header: '№ счёта' },
                  { key: 'Сумма', header: 'Сумма' },
                  { key: 'Статус', header: 'Статус' },
                  { key: 'Дата получения', header: 'Дата получения' },
                  { key: 'Дата оплаты', header: 'Дата оплаты' },
                ])
              }}
              className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30"
            >
              <FileDown className="h-4 w-4" />
              CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openReport('invoice-report')}
              className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30"
            >
              <Printer className="h-4 w-4" />
              Печать
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)} className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.02]">
              <Plus className="mr-2 h-4 w-4" />
              Новый счёт
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/30">
                <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Всего счетов</p>
                <p className="text-xl font-bold">{summary.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 dark:bg-sky-950/30">
                <TrendingUp className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Общая сумма</p>
                <p className="text-xl font-bold tabular-nums">{formatAmount(summary.totalAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/30">
                <Wallet className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Оплачено</p>
                <p className="text-xl font-bold tabular-nums text-green-600 dark:text-green-400">{formatAmount(summary.paidAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30">
                <Clock className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">К оплате</p>
                <p className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">{formatAmount(summary.pendingAmount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Status Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <span className="text-sm font-medium text-muted-foreground mr-1">По статусам:</span>
              {Object.entries(INVOICE_STATUS_MAP).map(([status, info]) => {
                const data = summary.byStatus[status]
                if (!data || data.count === 0) return null
                return (
                  <div
                    key={status}
                    className={`flex items-center gap-2 rounded-full px-3 py-1.5 border ${info.bgColor} cursor-pointer transition-all hover:shadow-sm`}
                    onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                  >
                    <div className={`h-2 w-2 rounded-full ${info.dotColor}`} />
                    <span className="text-xs font-medium">{info.label}</span>
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold">
                      {data.count}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{formatAmount(data.amount)}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Invoice Workflow Visualization */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-amber-500" />
            Процесс обработки счетов
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Processing Timeline Bar */}
          <div className="mb-4 flex items-center gap-1">
            {WORKFLOW_STEPS.map((step, idx) => (
              <div key={step.status} className="flex items-center flex-1 last:flex-initial">
                <div className="flex-1 h-2 rounded-full overflow-hidden bg-muted">
                  <motion.div
                    className={`h-full rounded-full ${step.activeBg}`}
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ delay: idx * 0.15 + 0.3, duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <div className="w-2 shrink-0">
                    <div className="h-px bg-muted-foreground/20" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <InvoiceWorkflow invoices={invoicesList} />
        </CardContent>
      </Card>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="flex items-center gap-2 shrink-0">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Фильтр:</span>
              </div>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
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
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  {Object.entries(INVOICE_STATUS_MAP).map(([status, info]) => (
                    <SelectItem key={status} value={status}>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${info.dotColor}`} />
                        {info.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              {/* Date range filter */}
              <div className="flex items-center gap-2">
                <Popover open={calendarOpen === 'from'} onOpenChange={(o) => setCalendarOpen(o ? 'from' : null)}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`w-[160px] justify-start text-left font-normal ${!dateFrom && 'text-muted-foreground'}`}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {dateFrom ? format(dateFrom, 'dd.MM.yyyy', { locale: ru }) : 'С даты'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateFrom}
                      onSelect={(d) => { setDateFrom(d); setCalendarOpen(null) }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground text-xs">—</span>
                <Popover open={calendarOpen === 'to'} onOpenChange={(o) => setCalendarOpen(o ? 'to' : null)}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={`w-[160px] justify-start text-left font-normal ${!dateTo && 'text-muted-foreground'}`}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {dateTo ? format(dateTo, 'dd.MM.yyyy', { locale: ru }) : 'По дату'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateTo}
                      onSelect={(d) => { setDateTo(d); setCalendarOpen(null) }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {(dateFrom || dateTo) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => { setDateFrom(undefined); setDateTo(undefined) }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {/* Search Input */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по поставщику, № счёта или проекту..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-muted-foreground shrink-0">
                  <X className="mr-1 h-3.5 w-3.5" />
                  Сбросить
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          {filteredInvoices.length === 0 ? (
            <EmptyState
              type={searchQuery || hasActiveFilters ? 'search' : 'invoices'}
              action={
                !searchQuery && !hasActiveFilters
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
                  <TableHead className="hidden xl:table-cell">Обновлено</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence mode="popLayout">
                  {filteredInvoices.map((inv, idx) => {
                    const statusInfo = INVOICE_STATUS_MAP[inv.status]
                    const relativeTime = getRelativeTime(inv.updatedAt)
                    const isRecentlyUpdated = relativeTime !== null
                    return (
                    <motion.tr
                      key={inv.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ delay: idx * 0.02, duration: 0.2 }}
                      className={`cursor-pointer hover:bg-muted/50 transition-colors duration-150 border-l-3 ${statusInfo?.leftBorder ?? 'border-l-transparent'}`}
                      onClick={() => openDetail(inv)}
                    >
                      <TableCell>
                        <Eye className="h-4 w-4 text-muted-foreground/50" />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{inv.project.name}</div>
                        <div className="text-xs text-muted-foreground sm:hidden">{inv.supplier.name}</div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{inv.supplier.name}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                          {inv.invoiceNumber || '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-sm">
                        {formatAmount(inv.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={inv.status} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {formatDate(inv.receivedAt)}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        {isRecentlyUpdated ? (
                          <div className="flex items-center gap-1">
                            <CircleDot className="h-3 w-3 text-amber-500" />
                            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{relativeTime}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{formatDate(inv.updatedAt)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {/* Inline status action buttons */}
                          {(inv.status === 'received' || inv.status === 'verified' || inv.status === 'discrepancy') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openReconcile(inv.id)}
                              className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30 h-7 text-xs"
                            >
                              <Scale className="mr-1 h-3 w-3" />
                              Сверить
                            </Button>
                          )}
                          {inv.status === 'received' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleVerify(inv.id)}
                              disabled={updateMutation.isPending}
                              className="h-7 text-xs border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-400 dark:hover:bg-sky-950/30"
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
                              className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                            >
                              Утвердить
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
                              className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/30"
                            >
                              <CreditCard className="mr-1 h-3 w-3" />
                              Оплатить
                            </Button>
                          )}
                          {inv.status !== 'cancelled' && inv.status !== 'paid' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive h-7 text-xs"
                              onClick={() => setCancelId(inv.id)}
                            >
                              Отменить
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom Summary */}
      {filteredInvoices.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-sm font-medium">
                      Итого: {filteredSummary.total} {filteredSummary.total === 1 ? 'счёт' : filteredSummary.total < 5 ? 'счёта' : 'счетов'}
                      {hasActiveFilters && <span className="text-muted-foreground"> (из {invoicesList.length})</span>}
                    </p>
                    {hasActiveFilters && (
                      <p className="text-xs text-muted-foreground">С учётом активных фильтров</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Общая сумма</p>
                    <p className="text-lg font-bold tabular-nums">{formatAmount(filteredSummary.totalAmount)}</p>
                  </div>
                  <Separator orientation="vertical" className="h-8" />
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Оплачено</p>
                    <p className="text-lg font-bold tabular-nums text-green-600 dark:text-green-400">
                      {formatAmount(filteredInvoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0))}
                    </p>
                  </div>
                  <Separator orientation="vertical" className="h-8" />
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">К оплате</p>
                    <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
                      {formatAmount(filteredSummary.totalAmount - filteredInvoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.totalAmount, 0))}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

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
                {/* Reconcile button in detail dialog */}
                {(detailInvoice.status === 'received' || detailInvoice.status === 'verified' || detailInvoice.status === 'discrepancy') && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      openReconcile(detailInvoice.id)
                      setDetailOpen(false)
                    }}
                    className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
                  >
                    <Scale className="mr-2 h-4 w-4" />
                    Сверить
                  </Button>
                )}
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
                    Утвердить
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

      {/* ── Reconciliation Sheet ───────────────────────────── */}
      <ReconciliationSheet
        open={reconcileOpen}
        onOpenChange={(open) => {
          setReconcileOpen(open)
          if (!open) setReconcileInvoiceId(null)
        }}
        reconciliation={reconciliationData ?? null}
        onVerify={handleReconcileVerify}
        isVerifying={updateMutation.isPending}
      />
    </div>
  )
}
