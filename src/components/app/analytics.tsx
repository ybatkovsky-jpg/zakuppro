'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BarChart3,
  TrendingUp,
  Package,
  Truck,
  CreditCard,
  CheckCircle2,
  Loader2,
  Users,
  ArrowRight,
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

// ── Types ──────────────────────────────────────────────────

interface StatsData {
  totalProjects: number
  activeProjects: number
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

// ── Pipeline step colors ───────────────────────────────────

const PIPELINE_STEPS = [
  { key: 'total', label: 'Всего позиций', color: 'bg-slate-500', icon: Package },
  { key: 'requested', label: 'Запрошено', color: 'bg-violet-500', icon: TrendingUp },
  { key: 'invoiced', label: 'В счёте', color: 'bg-amber-500', icon: CreditCard },
  { key: 'paid', label: 'Оплачено', color: 'bg-emerald-500', icon: CreditCard },
  { key: 'delivered', label: 'Доставлено', color: 'bg-green-600', icon: Truck },
]

// ── Format helpers ─────────────────────────────────────────

function formatNumber(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(n)
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n)
}

// ── Sub-components ─────────────────────────────────────────

function PipelineCard({ stats, isLoading }: { stats: StatsData | undefined; isLoading: boolean }) {
  // For pipeline we need item-level status counts. Use the budgetData as proxy,
  // but also derive pipeline from project items
  const { data: pipelineData, isLoading: pipelineLoading } = useQuery({
    queryKey: ['analytics-pipeline'],
    queryFn: async () => {
      const res = await fetch('/api/stats')
      if (!res.ok) throw new Error('Failed to fetch pipeline data')
      return res.json()
    },
  })

  const loading = isLoading || pipelineLoading

  // Count items by status from all project items
  const totalItems = pipelineData?.budgetData?.byCategory?.reduce(
    (sum: number, cat: { budget: number; spent: number }) => sum + 1, 0
  ) ?? 0

  // We'll use the stats endpoint data for pipeline calculations
  // Fetching from project items status counts
  const { data: itemStatusCounts } = useQuery({
    queryKey: ['analytics-item-statuses'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/pipeline')
      if (!res.ok) {
        // Fallback: return zeroes
        return { total: 0, requested: 0, invoiced: 0, paid: 0, delivered: 0 }
      }
      return res.json()
    },
  })

  const steps = [
    { ...PIPELINE_STEPS[0], count: itemStatusCounts?.total ?? 0 },
    { ...PIPELINE_STEPS[1], count: itemStatusCounts?.requested ?? 0 },
    { ...PIPELINE_STEPS[2], count: itemStatusCounts?.invoiced ?? 0 },
    { ...PIPELINE_STEPS[3], count: itemStatusCounts?.paid ?? 0 },
    { ...PIPELINE_STEPS[4], count: itemStatusCounts?.delivered ?? 0 },
  ]

  const maxCount = Math.max(...steps.map((s) => s.count), 1)

  return (
    <Card>
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
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {steps.map((step, idx) => {
              const pct = step.count > 0 && idx > 0
                ? Math.round((step.count / steps[0].count) * 100)
                : idx === 0 ? 100 : 0
              const barWidth = maxCount > 0 ? Math.round((step.count / maxCount) * 100) : 0
              return (
                <motion.div
                  key={step.key}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1, duration: 0.4 }}
                  className="flex items-center gap-3"
                >
                  <div className={`flex size-7 shrink-0 items-center justify-center rounded-full ${step.color} text-white`}>
                    <step.icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate">{step.label}</span>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-sm font-bold tabular-nums">{formatNumber(step.count)}</span>
                        {idx > 0 && step.count > 0 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 tabular-nums">
                            {pct}%
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${step.color}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${barWidth}%` }}
                        transition={{ delay: idx * 0.1 + 0.3, duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                  {idx < steps.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 shrink-0 hidden sm:block" />
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SupplierComparisonCard() {
  const { data: suppliers = [], isLoading } = useQuery<SupplierAnalytics[]>({
    queryKey: ['analytics-suppliers'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/suppliers')
      if (!res.ok) throw new Error('Failed to fetch supplier analytics')
      return res.json()
    },
  })

  return (
    <Card>
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
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Нет данных о поставщиках</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Поставщик</TableHead>
                  <TableHead className="text-center">Позиций</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Ср. срок (дн.)</TableHead>
                  <TableHead className="text-right">Сумма заказов</TableHead>
                  <TableHead className="text-center">Выполнение</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s, idx) => (
                  <motion.tr
                    key={s.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05, duration: 0.3 }}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-center tabular-nums">{s.totalItems}</TableCell>
                    <TableCell className="text-center tabular-nums hidden sm:table-cell">
                      {s.avgDeliveryDays > 0 ? s.avgDeliveryDays : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-mono text-sm">
                      {s.totalSpent > 0 ? formatCurrency(s.totalSpent) : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-1.5 w-12 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              s.completionRate >= 80
                                ? 'bg-emerald-500'
                                : s.completionRate >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                            }`}
                            style={{ width: `${s.completionRate}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums font-medium">
                          {Math.round(s.completionRate)}%
                        </span>
                      </div>
                    </TableCell>
                  </motion.tr>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CategorySpendingCard() {
  const { data: stats, isLoading } = useQuery<StatsData>({
    queryKey: ['analytics-stats-category'],
    queryFn: async () => {
      const res = await fetch('/api/stats')
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json()
    },
  })

  const categories = stats?.budgetData?.byCategory ?? []
  const maxBudget = Math.max(...categories.map((c) => c.budget), 1)

  return (
    <Card>
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
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Package className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Нет данных о затратах</p>
          </div>
        ) : (
          <div className="space-y-4">
            {categories.map((cat, idx) => {
              const budgetWidth = Math.round((cat.budget / maxBudget) * 100)
              const spentWidth = cat.budget > 0 ? Math.round((cat.spent / cat.budget) * 100) : 0
              const overspent = cat.spent > cat.budget
              return (
                <motion.div
                  key={cat.category}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.06, duration: 0.35 }}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium truncate max-w-[60%]">{cat.category}</span>
                    <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                      <span>{formatCurrency(cat.spent)}</span>
                      <span>/</span>
                      <span className="font-medium text-foreground">{formatCurrency(cat.budget)}</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-primary/30"
                        initial={{ width: 0 }}
                        animate={{ width: `${budgetWidth}%` }}
                        transition={{ delay: idx * 0.06 + 0.2, duration: 0.5 }}
                      />
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden -mt-1">
                      <motion.div
                        className={`h-full rounded-full ${overspent ? 'bg-red-500' : 'bg-emerald-500'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(spentWidth, 100)}%` }}
                        transition={{ delay: idx * 0.06 + 0.4, duration: 0.5 }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="size-2 rounded-full bg-primary/30" /> Бюджет
                    </span>
                    <span className="flex items-center gap-1">
                      <span className={`size-2 rounded-full ${overspent ? 'bg-red-500' : 'bg-emerald-500'}`} /> Потрачено
                    </span>
                    {overspent && (
                      <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4">
                        Перерасход
                      </Badge>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function MonthlyTrendsCard() {
  const { data: stats, isLoading } = useQuery<StatsData>({
    queryKey: ['analytics-stats-monthly'],
    queryFn: async () => {
      const res = await fetch('/api/stats')
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json()
    },
  })

  const monthlyData = stats?.monthlyProjectsData ?? []
  const maxCount = Math.max(...monthlyData.map((m) => m.count), 1)

  return (
    <Card>
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
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : monthlyData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <TrendingUp className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Нет данных о трендах</p>
          </div>
        ) : (
          <div className="space-y-3">
            {monthlyData.map((month, idx) => {
              const barWidth = Math.round((month.count / maxCount) * 100)
              return (
                <motion.div
                  key={month.month}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.08, duration: 0.35 }}
                  className="flex items-center gap-3"
                >
                  <span className="text-xs text-muted-foreground w-24 shrink-0 text-right tabular-nums">
                    {month.month}
                  </span>
                  <div className="flex-1 h-6 rounded-md bg-muted overflow-hidden relative">
                    <motion.div
                      className="h-full rounded-md bg-gradient-to-r from-violet-500 to-violet-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidth}%` }}
                      transition={{ delay: idx * 0.08 + 0.2, duration: 0.5, ease: 'easeOut' }}
                    />
                    {month.count > 0 && (
                      <span className="absolute inset-0 flex items-center px-2 text-[11px] font-medium text-white mix-blend-difference">
                        {month.count}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold tabular-nums w-8 shrink-0">
                    {month.count}
                  </span>
                </motion.div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Main Component ─────────────────────────────────────────

export function Analytics() {
  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Gradient Header */}
      <div className="relative -mx-6 -mt-6 px-6 pt-6 pb-5 bg-gradient-to-b from-violet-500/5 via-violet-500/[0.02] to-transparent">
        <div>
          <p className="text-muted-foreground text-sm">
            Глубокий анализ закупочной деятельности
          </p>
        </div>
      </div>

      {/* Section 1: Procurement Pipeline */}
      <motion.div variants={itemVariants}>
        <PipelineCard stats={undefined} isLoading={false} />
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
