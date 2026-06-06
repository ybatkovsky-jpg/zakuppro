'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useAuth } from '@/components/providers/auth-provider'
import { useEffect, useState } from 'react'
import {
  BarChart3,
  TrendingUp,
  Package,
  Truck,
  CreditCard,
  CheckCircle2,
  Users,
  Receipt,
  Building2,
  Target,
  Trophy,
  AlertTriangle,
  Inbox,
  ChevronRight,
  Printer,
} from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { authFetch } from '@/lib/auth-fetch'
import { openReport } from '@/lib/print-report'

// ── Types ──────────────────────────────────────────────────

interface StatsData {
  totalProjects: number
  activeProjects: number
  totalSuppliers: number
  budgetData: {
    totalBudget: number
    spentBudget: number
    pendingBudget: number
    byCategory: { category: string; budget: number; spent: number }[]
  }
  monthlyProjectsData: { month: string; count: number }[]
}

interface SupplierAnalytics {
  id: string
  name: string
  totalItems: number
  totalSpent: number
  avgDeliveryDays: number
  completionRate: number
}

interface PipelineData {
  total: number
  requested: number
  invoiced: number
  paid: number
  delivered: number
}

// ── Animation variants ─────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

// ── Pipeline step config ───────────────────────────────────

const PIPELINE_STEPS = [
  { key: 'total', label: 'Всего', color: 'bg-slate-500', textColor: 'text-slate-600', bgColor: 'bg-slate-500/10', borderColor: 'border-slate-500/20', icon: Package },
  { key: 'requested', label: 'Запрошено', color: 'bg-sky-500', textColor: 'text-sky-600', bgColor: 'bg-sky-500/10', borderColor: 'border-sky-500/20', icon: TrendingUp },
  { key: 'invoiced', label: 'В счёте', color: 'bg-amber-500', textColor: 'text-amber-600', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20', icon: CreditCard },
  { key: 'paid', label: 'Оплачено', color: 'bg-emerald-500', textColor: 'text-emerald-600', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20', icon: CreditCard },
  { key: 'delivered', label: 'Доставлено', color: 'bg-green-600', textColor: 'text-green-600', bgColor: 'bg-green-600/10', borderColor: 'border-green-600/20', icon: Truck },
]

// ── Format helpers ─────────────────────────────────────────

function formatNumber(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n)
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n)
}

function formatCurrencyShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}М ₽`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}К ₽`
  return `${n} ₽`
}

// ── Animated Count-Up Hook ─────────────────────────────────

function useCountUp(target: number, duration = 1200, enabled = true) {
  const [count, setCount] = useState(() => (!enabled || target === 0) ? target : 0)

  useEffect(() => {
    if (!enabled || target === 0) {
      // Schedule via rAF to avoid synchronous setState in effect
      const id = requestAnimationFrame(() => setCount(target))
      return () => cancelAnimationFrame(id)
    }

    const startTime = performance.now()
    let rafId: ReturnType<typeof requestAnimationFrame>

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(eased * target)
      setCount(current)
      if (progress < 1) {
        rafId = requestAnimationFrame(animate)
      }
    }

    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [target, duration, enabled])

  return count
}

// ── Empty State Component ──────────────────────────────────

function EmptyState({
  icon: Icon,
  title = 'Данных пока нет',
  description = 'Данные появятся после создания соответствующих записей',
}: {
  icon: React.ElementType
  title?: string
  description?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-10 text-center rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/20"
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-muted/60 mb-3">
        <Icon className="h-6 w-6 text-muted-foreground/60" />
      </div>
      <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground/60 max-w-[240px]">{description}</p>
    </motion.div>
  )
}

// ── Mini Sparkline ─────────────────────────────────────────

function MiniSparkline({
  values,
  color,
  width = 80,
  height = 24,
}: {
  values: number[]
  color: string
  width?: number
  height?: number
}) {
  if (values.length < 2) return null

  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  })

  const pathD = `M ${points.join(' L ')}`

  return (
    <svg width={width} height={height} className="opacity-50">
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ── KPI Scorecard ──────────────────────────────────────────

function KPIScorecard({
  icon: Icon,
  label,
  value,
  formattedValue,
  description,
  accentBg,
  accentText,
  accentIconBg,
  sparklineColor,
  sparklineValues,
  index,
}: {
  icon: React.ElementType
  label: string
  value: number
  formattedValue: string
  description: string
  accentBg: string
  accentText: string
  accentIconBg: string
  sparklineColor: string
  sparklineValues: number[]
  index: number
}) {
  const animatedCount = useCountUp(value, 1000 + index * 200, true)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
    >
      <Card className={`relative overflow-hidden ${accentBg} card-hover-elevate`}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className={`flex size-10 items-center justify-center rounded-full ${accentIconBg}`}>
                <Icon className={`h-5 w-5 ${accentText}`} />
              </div>
              <div>
                <p className="text-3xl font-bold tabular-nums tracking-tight">
                  {animatedCount !== value ? formatNumber(animatedCount) : formattedValue}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </div>
            <MiniSparkline values={sparklineValues} color={sparklineColor} />
          </div>
          <p className="text-[11px] text-muted-foreground/70 mt-3">{description}</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── KPI Section ────────────────────────────────────────────

function KPISection() {
  const { data: stats, isLoading: statsLoading } = useQuery<StatsData>({
    queryKey: ['analytics-kpi-stats'],
    queryFn: async () => {
      const res = await authFetch('/api/stats')
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json()
    },
  })

  const { data: pipelineData } = useQuery<PipelineData>({
    queryKey: ['analytics-kpi-pipeline'],
    queryFn: async () => {
      const res = await authFetch('/api/analytics/pipeline')
      if (!res.ok) return { total: 0, requested: 0, invoiced: 0, paid: 0, delivered: 0 }
      return res.json()
    },
  })

  const { data: suppliers = [] } = useQuery<SupplierAnalytics[]>({
    queryKey: ['analytics-kpi-suppliers'],
    queryFn: async () => {
      const res = await authFetch('/api/analytics/suppliers')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
  })

  const totalProcessed = pipelineData?.total ?? 0
  const totalSpent = stats?.budgetData?.spentBudget ?? 0
  const totalItems = pipelineData?.total ?? 1
  const avgInvoice = totalItems > 0 ? Math.round(totalSpent / totalItems) : 0
  const activeSuppliers = suppliers.filter(s => s.totalItems > 0).length
  const deliveredCount = pipelineData?.delivered ?? 0
  const completionRate = totalItems > 0 ? Math.round((deliveredCount / totalItems) * 100) : 0

  const kpis = [
    {
      icon: Package,
      label: 'Всего обработано',
      value: totalProcessed,
      formattedValue: formatNumber(totalProcessed),
      description: 'Позиций прошло через систему закупок',
      accentBg: 'bg-gradient-to-br from-emerald-500/5 to-emerald-500/[0.02]',
      accentText: 'text-emerald-600 dark:text-emerald-400',
      accentIconBg: 'bg-emerald-500/10',
      sparklineColor: '#10b981',
      sparklineValues: [0, totalProcessed * 0.2, totalProcessed * 0.4, totalProcessed * 0.6, totalProcessed * 0.85, totalProcessed],
    },
    {
      icon: Receipt,
      label: 'Средний чек',
      value: avgInvoice,
      formattedValue: formatCurrencyShort(avgInvoice),
      description: 'Средняя стоимость одной позиции',
      accentBg: 'bg-gradient-to-br from-amber-500/5 to-amber-500/[0.02]',
      accentText: 'text-amber-600 dark:text-amber-400',
      accentIconBg: 'bg-amber-500/10',
      sparklineColor: '#f59e0b',
      sparklineValues: [0, avgInvoice * 0.3, avgInvoice * 0.55, avgInvoice * 0.7, avgInvoice * 0.9, avgInvoice],
    },
    {
      icon: Building2,
      label: 'Поставщиков активно',
      value: activeSuppliers,
      formattedValue: formatNumber(activeSuppliers),
      description: 'С активными позициями в системе',
      accentBg: 'bg-gradient-to-br from-sky-500/5 to-sky-500/[0.02]',
      accentText: 'text-sky-600 dark:text-sky-400',
      accentIconBg: 'bg-sky-500/10',
      sparklineColor: '#0ea5e9',
      sparklineValues: [0, activeSuppliers * 0.25, activeSuppliers * 0.5, activeSuppliers * 0.7, activeSuppliers * 0.9, activeSuppliers],
    },
    {
      icon: Target,
      label: 'Процент выполнения',
      value: completionRate,
      formattedValue: `${completionRate}%`,
      description: 'Доставлено от общего числа позиций',
      accentBg: 'bg-gradient-to-br from-violet-500/5 to-violet-500/[0.02]',
      accentText: 'text-violet-600 dark:text-violet-400',
      accentIconBg: 'bg-violet-500/10',
      sparklineColor: '#8b5cf6',
      sparklineValues: [0, completionRate * 0.2, completionRate * 0.4, completionRate * 0.65, completionRate * 0.85, completionRate],
    },
  ]

  if (statsLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-10 w-10 rounded-full mb-3" />
              <Skeleton className="h-8 w-24 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi, idx) => (
        <KPIScorecard key={kpi.label} {...kpi} index={idx} />
      ))}
    </div>
  )
}

// ── Pipeline Card (Horizontal Steps) ───────────────────────

function PipelineCard() {
  const { data: itemStatusCounts, isLoading } = useQuery<PipelineData>({
    queryKey: ['analytics-item-statuses'],
    queryFn: async () => {
      const res = await authFetch('/api/analytics/pipeline')
      if (!res.ok) return { total: 0, requested: 0, invoiced: 0, paid: 0, delivered: 0 }
      return res.json()
    },
  })

  const steps = PIPELINE_STEPS.map((step) => ({
    ...step,
    count: itemStatusCounts?.[step.key as keyof PipelineData] ?? 0,
  }))

  const total = steps[0]?.count ?? 0
  const isEmpty = total === 0

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <BarChart3 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-base">Воронка закупок</CardTitle>
            <CardDescription>Движение позиций по этапам</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-1 min-w-[120px]">
                <Skeleton className="h-28 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <EmptyState
            icon={Package}
            title="Данных пока нет"
            description="Добавьте позиции в проекты, чтобы увидеть воронку закупок"
          />
        ) : (
          <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
            {steps.map((step, idx) => {
              const pct = idx === 0 ? 100 : (step.count > 0 && total > 0 ? Math.round((step.count / total) * 100) : 0)
              return (
                <div key={step.key} className="flex items-stretch shrink-0">
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.12, duration: 0.4 }}
                    className={`flex flex-col items-center justify-center w-[130px] rounded-xl border ${step.borderColor} ${step.bgColor} p-4 transition-all hover:shadow-md hover:scale-[1.02]`}
                  >
                    {/* Step number */}
                    <div className={`flex size-7 items-center justify-center rounded-full ${step.color} text-white text-xs font-bold mb-2`}>
                      {idx + 1}
                    </div>
                    {/* Step name */}
                    <p className="text-xs font-medium text-center mb-1">{step.label}</p>
                    {/* Count */}
                    <CountUpValue value={step.count} className="text-2xl font-bold tabular-nums" />
                    {/* Percentage */}
                    {idx > 0 && (
                      <span className="text-[10px] text-muted-foreground mt-1 tabular-nums">{pct}% от общего</span>
                    )}
                    {idx === 0 && (
                      <span className="text-[10px] text-muted-foreground mt-1">все позиции</span>
                    )}
                  </motion.div>
                  {/* Connecting arrow */}
                  {idx < steps.length - 1 && (
                    <div className="flex items-center px-1 shrink-0">
                      <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.12 + 0.2, duration: 0.3 }}
                      >
                        <ChevronRight className="h-5 w-5 text-muted-foreground/40" />
                      </motion.div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Count-Up Value ─────────────────────────────────────────

function CountUpValue({ value, className }: { value: number; className?: string }) {
  const animated = useCountUp(value, 800, true)
  return <span className={className}>{formatNumber(animated)}</span>
}

// ── Supplier Comparison Card (Improved) ────────────────────

function SupplierComparisonCard() {
  const { data: suppliers = [], isLoading } = useQuery<SupplierAnalytics[]>({
    queryKey: ['analytics-suppliers'],
    queryFn: async () => {
      const res = await authFetch('/api/analytics/suppliers')
      if (!res.ok) throw new Error('Failed to fetch supplier analytics')
      return res.json()
    },
  })

  const activeSuppliers = suppliers.filter(s => s.totalItems > 0 || s.totalSpent > 0)

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10">
            <Users className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <CardTitle className="text-base">Сравнение поставщиков</CardTitle>
            <CardDescription>Эффективность и надёжность</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : activeSuppliers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Данных пока нет"
            description="Привяжите позиции к поставщикам для отображения сравнения"
          />
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 text-center">#</TableHead>
                  <TableHead>Поставщик</TableHead>
                  <TableHead className="text-center">Позиций</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Ср. срок</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead className="text-center min-w-[140px]">Выполнение</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeSuppliers.map((s, idx) => {
                  const rateColor = s.completionRate >= 70
                    ? 'bg-emerald-500'
                    : s.completionRate >= 40
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  const rateTextColor = s.completionRate >= 70
                    ? 'text-emerald-600'
                    : s.completionRate >= 40
                      ? 'text-amber-600'
                      : 'text-red-600'
                  return (
                    <motion.tr
                      key={s.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05, duration: 0.3 }}
                      className={`transition-all duration-200 hover:bg-muted/50 ${idx % 2 === 1 ? 'bg-muted/20' : ''}`}
                    >
                      <TableCell className="text-center font-bold text-muted-foreground text-sm">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{s.name}</span>
                          {idx === 0 && (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px] px-1.5 py-0 h-5 gap-0.5">
                              <Trophy className="h-3 w-3" />
                              Топ
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center tabular-nums text-sm">{s.totalItems}</TableCell>
                      <TableCell className="text-center tabular-nums text-sm hidden sm:table-cell">
                        {s.avgDeliveryDays > 0 ? (
                          <span className="flex items-center justify-center gap-1">
                            {s.avgDeliveryDays}
                            <span className="text-muted-foreground text-[10px]">дн.</span>
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-mono text-sm">
                        {s.totalSpent > 0 ? formatCurrencyShort(s.totalSpent) : '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${rateColor}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(s.completionRate, 100)}%` }}
                              transition={{ delay: idx * 0.05 + 0.3, duration: 0.6, ease: 'easeOut' }}
                            />
                          </div>
                          <span className={`text-xs tabular-nums font-semibold min-w-[32px] text-right ${rateTextColor}`}>
                            {Math.round(s.completionRate)}%
                          </span>
                        </div>
                      </TableCell>
                    </motion.tr>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Category Spending Card (Improved) ──────────────────────

function CategorySpendingCard() {
  const { data: stats, isLoading } = useQuery<StatsData>({
    queryKey: ['analytics-stats-category'],
    queryFn: async () => {
      const res = await authFetch('/api/stats')
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json()
    },
  })

  const categories = stats?.budgetData?.byCategory ?? []
  const maxBudget = Math.max(...categories.map((c) => c.budget), 1)

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <CardTitle className="text-base">Затраты по категориям</CardTitle>
            <CardDescription>Бюджет vs. потрачено</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Данных пока нет"
            description="Затраты появятся после добавления позиций с бюджетом"
          />
        ) : (
          <div className="space-y-4">
            {categories.map((cat, idx) => {
              const budgetWidth = Math.round((cat.budget / maxBudget) * 100)
              const spentRatio = cat.budget > 0 ? cat.spent / cat.budget : 0
              const overspent = cat.spent > cat.budget
              const spentBarWidth = Math.min(Math.round(spentRatio * budgetWidth), 100)
              return (
                <motion.div
                  key={cat.category}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.06, duration: 0.35 }}
                  className="group"
                >
                  {/* Category header */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium truncate max-w-[55%] group-hover:text-primary transition-colors">
                      {cat.category}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {overspent && (
                        <Badge className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20 text-[9px] px-1.5 py-0 h-4 gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Перерасход
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatCurrencyShort(cat.spent)}
                      </span>
                      <span className="text-xs text-muted-foreground/60">/</span>
                      <span className="text-xs font-medium">{formatCurrencyShort(cat.budget)}</span>
                    </div>
                  </div>
                  {/* Bar chart */}
                  <div className="relative h-6 rounded-lg bg-muted/50 overflow-hidden">
                    {/* Budget bar (background) */}
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-primary/15 rounded-lg"
                      initial={{ width: 0 }}
                      animate={{ width: `${budgetWidth}%` }}
                      transition={{ delay: idx * 0.06 + 0.2, duration: 0.5 }}
                    />
                    {/* Spent bar (foreground) */}
                    <motion.div
                      className={`absolute inset-y-0 left-0 rounded-lg ${
                        overspent
                          ? 'bg-gradient-to-r from-red-500/80 to-red-500/60'
                          : 'bg-gradient-to-r from-emerald-500/80 to-emerald-500/60'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${spentBarWidth}%` }}
                      transition={{ delay: idx * 0.06 + 0.4, duration: 0.5, ease: 'easeOut' }}
                    />
                    {/* Amount label inside bar */}
                    {spentBarWidth > 25 && (
                      <motion.span
                        className="absolute inset-y-0 left-2 flex items-center text-[10px] font-medium text-white/90"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.06 + 0.7 }}
                      >
                        {formatCurrencyShort(cat.spent)}
                      </motion.span>
                    )}
                  </div>
                </motion.div>
              )
            })}
            {/* Legend */}
            <div className="flex items-center gap-4 pt-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded bg-primary/20" /> Бюджет
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded bg-emerald-500/60" /> Потрачено
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded bg-red-500/60" /> Перерасход
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Monthly Trends Card (Improved) ─────────────────────────

function MonthlyTrendsCard() {
  const { data: stats, isLoading } = useQuery<StatsData>({
    queryKey: ['analytics-stats-monthly'],
    queryFn: async () => {
      const res = await authFetch('/api/stats')
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json()
    },
  })

  const monthlyData = stats?.monthlyProjectsData ?? []
  const maxCount = Math.max(...monthlyData.map((m) => m.count), 1)
  const currentMonthIdx = monthlyData.length - 1

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-violet-500/10">
            <TrendingUp className="h-4 w-4 text-violet-600" />
          </div>
          <div>
            <CardTitle className="text-base">Месячные тренды</CardTitle>
            <CardDescription>Проекты по месяцам</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : monthlyData.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="Данных пока нет"
            description="Тренды появятся после создания проектов"
          />
        ) : monthlyData.every((m) => m.count === 0) ? (
          <EmptyState
            icon={Inbox}
            title="Данных пока нет"
            description="В последние месяцы не было создано ни одного проекта"
          />
        ) : (
          <div className="space-y-2">
            {monthlyData.map((month, idx) => {
              const barWidth = Math.round((month.count / maxCount) * 100)
              const isCurrentMonth = idx === currentMonthIdx
              return (
                <motion.div
                  key={month.month}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.08, duration: 0.35 }}
                  className={`flex items-center gap-3 rounded-lg p-2 -mx-2 transition-colors ${isCurrentMonth ? 'bg-violet-500/5 ring-1 ring-violet-500/10' : 'hover:bg-muted/30'}`}
                >
                  <span className={`text-xs w-20 shrink-0 text-right tabular-nums ${isCurrentMonth ? 'font-semibold text-violet-600 dark:text-violet-400' : 'text-muted-foreground'}`}>
                    {month.month}
                    {isCurrentMonth && (
                      <span className="ml-1 text-[9px]">(сейчас)</span>
                    )}
                  </span>
                  <div className="flex-1 h-8 rounded-lg bg-muted/30 overflow-hidden relative">
                    {/* Gradient area fill */}
                    <motion.div
                      className={`absolute inset-y-0 left-0 rounded-lg ${
                        isCurrentMonth
                          ? 'bg-gradient-to-r from-violet-500/30 via-violet-400/20 to-violet-300/10'
                          : 'bg-gradient-to-r from-violet-500/20 via-violet-400/10 to-transparent'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ delay: idx * 0.08 + 0.2, duration: 0.5, ease: 'easeOut' }}
                    />
                    {/* Bar edge line (trend line) */}
                    <motion.div
                      className={`absolute inset-y-0 w-[2px] rounded-full ${isCurrentMonth ? 'bg-violet-500' : 'bg-violet-500/50'}`}
                      initial={{ left: 0, opacity: 0 }}
                      animate={{ left: `${barWidth}%`, opacity: 1 }}
                      transition={{ delay: idx * 0.08 + 0.3, duration: 0.5, ease: 'easeOut' }}
                    />
                    {/* Count on bar */}
                    {month.count > 0 && barWidth > 15 && (
                      <motion.span
                        className="absolute inset-y-0 left-2.5 flex items-center text-[11px] font-medium text-foreground/70"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.08 + 0.5 }}
                      >
                        {month.count} пр.
                      </motion.span>
                    )}
                  </div>
                  <span className={`text-sm font-bold tabular-nums w-8 shrink-0 text-right ${isCurrentMonth ? 'text-violet-600 dark:text-violet-400' : ''}`}>
                    {month.count}
                  </span>
                </motion.div>
              )
            })}
            {/* Trend line connector (SVG) */}
            {monthlyData.length > 1 && (
              <div className="pt-2">
                <svg
                  className="w-full h-12"
                  viewBox={`0 0 ${monthlyData.length * 100 - 20} 40`}
                  preserveAspectRatio="none"
                >
                  {/* Area fill */}
                  <motion.path
                    d={getAreaPath(monthlyData, maxCount, 40, 80)}
                    fill="url(#violetGradient)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.8, duration: 0.5 }}
                  />
                  {/* Line */}
                  <motion.path
                    d={getLinePath(monthlyData, maxCount, 40, 80)}
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ delay: 0.5, duration: 1, ease: 'easeOut' }}
                  />
                  {/* Dots */}
                  {monthlyData.map((m, i) => {
                    const x = i * 80 + 40
                    const y = 38 - ((m.count / maxCount) * 34)
                    return (
                      <motion.circle
                        key={i}
                        cx={x}
                        cy={y}
                        r={i === currentMonthIdx ? 4 : 3}
                        fill={i === currentMonthIdx ? '#8b5cf6' : '#c4b5fd'}
                        stroke="white"
                        strokeWidth="2"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.8 + i * 0.1, duration: 0.3 }}
                      />
                    )
                  })}
                  <defs>
                    <linearGradient id="violetGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── SVG path helpers ───────────────────────────────────────

function getLinePath(
  data: { month: string; count: number }[],
  maxVal: number,
  svgHeight: number,
  stepX: number,
): string {
  if (data.length === 0) return ''
  const padding = 4
  return data.map((d, i) => {
    const x = i * stepX + stepX / 2
    const y = svgHeight - padding - ((d.count / maxVal) * (svgHeight - padding * 2))
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')
}

function getAreaPath(
  data: { month: string; count: number }[],
  maxVal: number,
  svgHeight: number,
  stepX: number,
): string {
  if (data.length === 0) return ''
  const padding = 4
  const linePath = data.map((d, i) => {
    const x = i * stepX + stepX / 2
    const y = svgHeight - padding - ((d.count / maxVal) * (svgHeight - padding * 2))
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')
  const lastX = (data.length - 1) * stepX + stepX / 2
  const firstX = stepX / 2
  return `${linePath} L ${lastX} ${svgHeight} L ${firstX} ${svgHeight} Z`
}

// ── Main Component ─────────────────────────────────────────

export function Analytics() {
  const { role } = useAuth()

  if (role === 'warehouse') {
    return (
      <div className="flex items-center justify-center py-20">
        <EmptyState
          icon={AlertTriangle}
          title="Доступ закрыт"
          description="Для просмотра аналитики обратитесь к руководителю"
        />
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
      {/* Gradient Header */}
      <div className="relative -mx-6 -mt-6 px-6 pt-6 pb-5 bg-gradient-to-b from-violet-500/5 via-violet-500/[0.02] to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm">
              Глубокий анализ закупочной деятельности
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openReport('procurement-report')}
            className="gap-1.5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
          >
            <Printer className="h-4 w-4" />
            Печать отчёта
          </Button>
        </div>
      </div>

      {/* KPI Scorecards */}
      <motion.div variants={itemVariants}>
        <KPISection />
      </motion.div>

      {/* Section 1: Procurement Pipeline */}
      <motion.div variants={itemVariants}>
        <PipelineCard />
      </motion.div>

      {/* Section 2: Supplier Comparison */}
      <motion.div variants={itemVariants}>
        <SupplierComparisonCard />
      </motion.div>

      {/* Section 3 & 4: Category Spending + Monthly Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={itemVariants}>
          <CategorySpendingCard />
        </motion.div>
        <motion.div variants={itemVariants}>
          <MonthlyTrendsCard />
        </motion.div>
      </div>
    </motion.div>
  )
}
