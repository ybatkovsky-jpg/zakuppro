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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
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
} from 'lucide-react'
import { EmptyState } from '@/components/app/empty-state'
import { exportToCSV } from '@/lib/export-csv'
import { motion, AnimatePresence } from 'framer-motion'

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

// ── Invoice Workflow Visualization ──────────────────────────

const WORKFLOW_STEPS = [
  { status: 'received', label: 'Получен', color: 'slate', circleBg: 'bg-slate-200 dark:bg-slate-700', circleText: 'text-slate-700 dark:text-slate-300', activeBg: 'bg-slate-500', glowColor: 'shadow-slate-400/50' },
  { status: 'verified', label: 'Проверен', color: 'sky', circleBg: 'bg-sky-200 dark:bg-sky-700', circleText: 'text-sky-700 dark:text-sky-300', activeBg: 'bg-sky-500', glowColor: 'shadow-sky-400/50' },
  { status: 'approved', label: 'Одобрен', color: 'emerald', circleBg: 'bg-emerald-200 dark:bg-emerald-700', circleText: 'text-emerald-700 dark:text-emerald-300', activeBg: 'bg-emerald-500', glowColor: 'shadow-emerald-400/50' },
  { status: 'paid', label: 'Оплачен', color: 'green', circleBg: 'bg-green-200 dark:bg-green-700', circleText: 'text-green-700 dark:text-green-300', activeBg: 'bg-green-500', glowColor: 'shadow-green-400/50' },
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
                <span className="text-sm font-bold">{count}</span>
                {isCurrentStep && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-current"
                    initial={{ scale: 1, opacity: 0.6 }}
                    animate={{ scale: 1.3, opacity: 0 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                  />
                )}
              </div>

              <span className={`text-xs font-medium whitespace-nowrap ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.label}
              </span>
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
  const hasDiscrepancy = match.nameMatch && (match.quantityMatch !== match.priceMatch)
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

  if (hasDiscrepancy) {
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

  // Show loading state while data is being fetched
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
            <div className="rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{summary.matchedItems}</p>
              <p className="text-xs text-muted-foreground">Совпадений</p>
            </div>
            <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-3 text-center">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{summary.quantityDiscrepancies + summary.priceDiscrepancies}</p>
              <p className="text-xs text-muted-foreground">Расхождений</p>
            </div>
            <div className="rounded-lg border bg-red-50 dark:bg-red-950/20 p-3 text-center">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.unmatchedRequestItems + summary.unmatchedInvoiceItems}</p>
              <p className="text-xs text-muted-foreground">Не сопоставлено</p>
            </div>
            <div className="rounded-lg border bg-sky-50 dark:bg-sky-950/20 p-3 text-center">
              <p className={`text-2xl font-bold ${summary.amountDifference > 0 ? 'text-red-600' : summary.amountDifference < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {summary.amountDifference > 0 ? '+' : ''}{formatAmount(summary.amountDifference)}
              </p>
              <p className="text-xs text-muted-foreground">Разница сумм</p>
            </div>
          </motion.div>

          {/* Two-column header */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-sky-700 dark:text-sky-400">
              <FileText className="h-4 w-4" />
              Запрос ({summary.totalRequestItems} поз.)
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
              <Receipt className="h-4 w-4" />
              Счёт ({summary.totalInvoiceItems} поз.)
            </div>
          </div>

          <Separator />

          {/* Matched items */}
          <AnimatePresence>
            {matches.map((match, idx) => (
              <motion.div
                key={`${match.requestItem.id}-${match.invoiceItem.id}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.25 }}
                className="rounded-lg border bg-card"
              >
                {/* Match status bar */}
                <div className={`px-3 py-1.5 rounded-t-lg text-xs font-medium flex items-center justify-between ${
                  match.nameMatch && match.quantityMatch && match.priceMatch
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

                {/* Two-column comparison */}
                <div className="grid grid-cols-2 gap-4 p-3">
                  {/* Request item */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{match.requestItem.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {match.requestItem.quantity} шт
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {formatAmount(match.requestItem.price)}
                      </span>
                    </div>
                  </div>

                  {/* Invoice item */}
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{match.invoiceItem.name}</p>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Package className="h-3 w-3" />
                        {match.invoiceItem.quantity} шт
                      </span>
                      <DifferenceIndicator request={match.requestItem.quantity} invoice={match.invoiceItem.quantity} type="quantity" />
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="h-3 w-3" />
                        {formatAmount(match.invoiceItem.price)}
                      </span>
                      <DifferenceIndicator request={match.requestItem.price} invoice={match.invoiceItem.price} type="price" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
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
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Итоги сверки
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Сумма по запросу</p>
                <p className="font-semibold">{formatAmount(summary.totalRequestAmount)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Сумма по счёту</p>
                <p className="font-semibold">{formatAmount(summary.totalInvoiceAmount)}</p>
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
          <div className={`rounded-lg p-4 ${
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
  const { data: reconciliationData, isLoading: reconciliationLoading } = useQuery({
    queryKey: ['reconcile', reconcileInvoiceId],
    queryFn: async () => {
      if (!reconcileInvoiceId) return null
      const res = await fetch(`/api/invoices/${reconcileInvoiceId}/reconcile`)
      if (!res.ok) throw new Error('Failed to fetch reconciliation data')
      return res.json() as Promise<ReconciliationResult>
    },
    enabled: !!reconcileInvoiceId,
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

  const openReconcile = (invoiceId: string) => {
    setReconcileInvoiceId(invoiceId)
    setReconcileOpen(true)
  }

  const handleReconcileVerify = () => {
    if (!reconcileInvoiceId) return
    // Determine status based on reconciliation result
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

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative -mx-6 -mt-6 px-6 pt-6 pb-5 bg-gradient-to-b from-amber-500/5 via-amber-500/[0.02] to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm">Управление входящими счетами</p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const csvData = filteredInvoices.map((inv) => ({
                  Проект: inv.project.name,
                  Поставщик: inv.supplier.name,
                  '№ счёта': inv.invoiceNumber || '',
                  Сумма: inv.totalAmount,
                  Статус: INVOICE_STATUS_MAP[inv.status]?.label ?? inv.status,
                  Дата: formatDate(inv.receivedAt),
                }))
                exportToCSV(csvData, 'invoices.csv', [
                  { key: 'Проект', header: 'Проект' },
                  { key: 'Поставщик', header: 'Поставщик' },
                  { key: '№ счёта', header: '№ счёта' },
                  { key: 'Сумма', header: 'Сумма' },
                  { key: 'Статус', header: 'Статус' },
                  { key: 'Дата', header: 'Дата' },
                ])
              }}
              className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30"
            >
              <FileDown className="h-4 w-4" />
              CSV
            </Button>
            <Button onClick={() => setCreateOpen(true)} className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.02]">
              <Plus className="mr-2 h-4 w-4" />
              Новый счёт
            </Button>
          </div>
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

      {/* Invoice Workflow Visualization */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Процесс обработки счетов</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoiceWorkflow invoices={invoicesList} />
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
                        {/* Reconcile button - for received and verified invoices */}
                        {(inv.status === 'received' || inv.status === 'verified' || inv.status === 'discrepancy') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openReconcile(inv.id)}
                            className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
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
