'use client'

import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/store/app-store'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { motion } from 'framer-motion'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
} from 'recharts'
import {
  FolderKanban,
  Building2,
  Warehouse,
  Mail,
  FileText,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle2,
  DollarSign,
  Plus,
  Package,
  Users,
  ArrowRight,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/utils'

// ── Types ───────────────────────────────────────────────────────────────────

interface RecentProject {
  id: string
  name: string
  description: string
  status: string
  fileName: string
  customerName: string
  createdAt: string
  updatedAt: string
  _count: { items: number }
}

interface CategoryBudget {
  category: string
  budget: number
  spent: number
}

interface BudgetData {
  totalBudget: number
  spentBudget: number
  pendingBudget: number
  byCategory: CategoryBudget[]
}

interface ProjectCostItem {
  projectName: string
  budget: number
  spent: number
  status: string
}

interface StatsData {
  totalProjects: number
  activeProjects: number
  completedProjects: number
  totalSuppliers: number
  totalWarehouseItems: number
  lowStockItems: number
  pendingRequests: number
  sentRequests: number
  unpaidInvoices: number
  totalInvoiceAmount: number
  recentProjects: RecentProject[]
  budgetData: BudgetData
  projectCostData: ProjectCostItem[]
  projectStatusData: Array<{ name: string; value: number; color: string }>
  monthlyProjectsData: Array<{ month: string; count: number }>
  warehouseStockData: Array<{ name: string; quantity: number; minQuantity: number; status: 'ok' | 'warning' | 'low' }>
}

interface ActivityItem {
  id: string
  type: 'project_created' | 'status_changed' | 'request_created' | 'invoice_received' | 'warehouse_transaction'
  title: string
  description: string
  timestamp: string
}

// ── Status helpers ──────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  new: 'Новый',
  processing: 'В обработке',
  requested: 'Запрошено',
  invoiced: 'Счёт выставлен',
  paid: 'Оплачено',
  delivered: 'Доставлено',
  completed: 'Завершён',
  cancelled: 'Отменён',
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'new':
      return <Badge variant="secondary" className="rounded-full px-2.5 text-[11px] font-medium">{STATUS_LABELS[status]}</Badge>
    case 'processing':
      return <Badge variant="default" className="rounded-full px-2.5 text-[11px] font-medium">{STATUS_LABELS[status]}</Badge>
    case 'requested':
      return (
        <Badge variant="outline" className="rounded-full border-primary/30 text-primary px-2.5 text-[11px] font-medium">
          {STATUS_LABELS[status]}
        </Badge>
      )
    case 'invoiced':
      return (
        <Badge
          variant="default"
          className="rounded-full bg-amber-500 hover:bg-amber-500/90 text-white px-2.5 text-[11px] font-medium"
        >
          {STATUS_LABELS[status]}
        </Badge>
      )
    case 'paid':
      return (
        <Badge
          variant="default"
          className="rounded-full bg-emerald-600 hover:bg-emerald-600/90 text-white px-2.5 text-[11px] font-medium gap-1"
        >
          <CheckCircle2 className="size-3" />
          {STATUS_LABELS[status]}
        </Badge>
      )
    case 'delivered':
      return (
        <Badge
          variant="default"
          className="rounded-full bg-emerald-600 hover:bg-emerald-600/90 text-white px-2.5 text-[11px] font-medium"
        >
          {STATUS_LABELS[status]}
        </Badge>
      )
    case 'completed':
      return (
        <Badge
          variant="default"
          className="rounded-full bg-emerald-600 hover:bg-emerald-600/90 text-white px-2.5 text-[11px] font-medium gap-1"
        >
          <CheckCircle2 className="size-3" />
          {STATUS_LABELS[status]}
        </Badge>
      )
    case 'cancelled':
      return <Badge variant="destructive" className="rounded-full px-2.5 text-[11px] font-medium">{STATUS_LABELS[status]}</Badge>
    default:
      return <Badge variant="outline" className="rounded-full px-2.5 text-[11px] font-medium">{status}</Badge>
  }
}

// ── Date formatting ─────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

// ── Sparkline bars ──────────────────────────────────────────────────────────

function MiniSparkline({ color, bars = 7 }: { color: string; bars?: number }) {
  const heights = Array.from({ length: bars }, () => 20 + Math.random() * 80)
  return (
    <div className="flex items-end gap-[2px] h-6">
      {heights.map((h, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full ${color}`}
          style={{ height: `${h}%`, opacity: 0.4 + (i / bars) * 0.5 }}
        />
      ))}
    </div>
  )
}

// ── Animation variants ──────────────────────────────────────────────────────

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
}

const activityItemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
}

// ── Stat Card Component ─────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  iconClassName,
  borderColor,
  sparkColor,
  cardClassName,
  valueClassName,
  onClick,
}: {
  title: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  description?: string
  iconClassName?: string
  borderColor?: string
  sparkColor?: string
  cardClassName?: string
  valueClassName?: string
  onClick?: () => void
}) {
  const isClickable = !!onClick
  return (
    <motion.div variants={itemVariants} className="h-full">
      <Card
        className={`relative overflow-hidden transition-all duration-200 ${borderColor ? `border-l-4 ${borderColor}` : ''} ${cardClassName ?? ''} ${isClickable ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5 hover:scale-[1.02] active:scale-[0.98]' : ''}`}
        onClick={onClick}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardDescription className="text-sm font-medium">
            {title}
          </CardDescription>
          <div className="flex items-center gap-2">
            {sparkColor && <MiniSparkline color={sparkColor} />}
            <Icon className={`size-5 shrink-0 ${iconClassName ?? 'text-muted-foreground'}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold tracking-tight ${valueClassName ?? ''}`}>
            {value}
          </div>
          {description && (
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── Circular Progress Ring ──────────────────────────────────────────────────

function CircularProgressRing({ percent, size = 140, strokeWidth = 10 }: { percent: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (percent / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-emerald-500 transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold">{percent.toFixed(0)}%</span>
        <span className="text-[11px] text-muted-foreground">освоено</span>
      </div>
    </div>
  )
}

// ── Activity Feed Component ─────────────────────────────────────────────────

function ActivityFeed() {
  const { data: activities, isLoading } = useQuery<ActivityItem[]>({
    queryKey: ['activity'],
    queryFn: async () => {
      const res = await fetch('/api/activity')
      if (!res.ok) throw new Error('Failed to fetch activity')
      return res.json()
    },
    refetchInterval: 30_000,
  })

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'project_created':
        return <FolderKanban className="size-4" />
      case 'status_changed':
        return <ArrowRight className="size-4" />
      case 'request_created':
        return <Mail className="size-4" />
      case 'invoice_received':
        return <FileText className="size-4" />
      case 'warehouse_transaction':
        return <Package className="size-4" />
    }
  }

  const getActivityDotColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'project_created':
        return 'bg-emerald-500'
      case 'status_changed':
        return 'bg-sky-500'
      case 'request_created':
        return 'bg-violet-500'
      case 'invoice_received':
        return 'bg-amber-500'
      case 'warehouse_transaction':
        return 'bg-teal-500'
    }
  }

  const getActivityBg = (type: ActivityItem['type']) => {
    switch (type) {
      case 'project_created':
        return 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
      case 'status_changed':
        return 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400'
      case 'request_created':
        return 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400'
      case 'invoice_received':
        return 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
      case 'warehouse_transaction':
        return 'bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400'
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-5 text-muted-foreground" />
          Последняя активность
        </CardTitle>
        <CardDescription>Последние действия в системе</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : !activities || activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Clock className="size-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm text-muted-foreground">Нет активности</p>
          </div>
        ) : (
          <motion.div
            className="max-h-80 space-y-1 overflow-y-auto pr-1 custom-scrollbar"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {activities.map((activity) => (
              <motion.div
                key={activity.id}
                variants={activityItemVariants}
                className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
              >
                <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${getActivityBg(activity.type)}`}>
                  {getActivityIcon(activity.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`size-1.5 shrink-0 rounded-full ${getActivityDotColor(activity.type)}`} />
                    <p className="truncate text-sm font-medium">{activity.title}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{activity.description}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                    {formatRelativeTime(activity.timestamp)}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Skeleton Loader ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-5 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="size-5 rounded" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ── Custom Tooltip for Category Chart ───────────────────────────────────────

function CategoryTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; color: string }>; label?: string }) {
  if (!active || !payload) return null
  const formatVal = (v: number) =>
    new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v)

  return (
    <div className="rounded-lg border bg-background p-3 shadow-lg">
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.dataKey === 'budget' ? 'Бюджет' : 'Потрачено'}: {formatVal(entry.value)} ₽
        </p>
      ))}
    </div>
  )
}

// ── Dashboard Component ─────────────────────────────────────────────────────

export function Dashboard() {
  const { navigate, navigateToProject } = useAppStore()

  const { data, isLoading, error } = useQuery<StatsData>({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await fetch('/api/stats')
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json()
    },
    refetchInterval: 30_000,
  })

  if (isLoading) return <DashboardSkeleton />

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            Ошибка загрузки данных
          </CardTitle>
          <CardDescription>
            Не удалось загрузить статистику. Попробуйте обновить страницу.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!data) return null

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(amount)

  const formatCompact = (amount: number) =>
    new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(amount)

  // Budget calculations
  const budgetData = data.budgetData || { totalBudget: 0, spentBudget: 0, pendingBudget: 0, byCategory: [] }
  const spentPercent = budgetData.totalBudget > 0
    ? (budgetData.spentBudget / budgetData.totalBudget) * 100
    : 0

  const projectCostData = data.projectCostData || []

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Section Title with gradient bg ────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        className="relative -mx-6 -mt-6 px-6 pt-6 pb-4 bg-gradient-to-b from-primary/5 via-primary/[0.02] to-transparent"
      >
        <h2 className="text-xl font-bold tracking-tight">
          <span className="gradient-text">ЗакупПро</span>
          <span className="text-muted-foreground font-normal text-base ml-2">— обзор</span>
        </h2>
        <p className="text-muted-foreground mt-1">
          Ключевые показатели и последние проекты
        </p>
      </motion.div>

      {/* ── Stats Row 1 (4 cards) ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Всего проектов"
          value={data.totalProjects}
          icon={FolderKanban}
          description={`${data.completedProjects} завершено`}
          iconClassName="text-primary"
          borderColor="border-l-primary"
          sparkColor="bg-primary"
          onClick={() => navigate('projects')}
        />
        <StatCard
          title="Поставщиков"
          value={data.totalSuppliers}
          icon={Building2}
          description="Всего в базе"
          iconClassName="text-sky-600"
          borderColor="border-l-sky-500"
          sparkColor="bg-sky-500"
          onClick={() => navigate('suppliers')}
        />
        <StatCard
          title="Запросов в процессе"
          value={data.sentRequests}
          icon={Mail}
          description={`${data.pendingRequests} черновиков`}
          iconClassName="text-violet-600"
          borderColor="border-l-violet-500"
          sparkColor="bg-violet-500"
          onClick={() => navigate('requests')}
        />
        <StatCard
          title="Неоплаченных счетов"
          value={data.unpaidInvoices}
          icon={DollarSign}
          description={
            data.totalInvoiceAmount > 0
              ? `на сумму ${formatAmount(data.totalInvoiceAmount)}`
              : 'Нет неоплаченных'
          }
          iconClassName="text-amber-600"
          borderColor="border-l-amber-500"
          sparkColor="bg-amber-500"
          onClick={() => navigate('invoices')}
        />
      </div>

      {/* ── Stats Row 2 (3 cards) ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Активных проектов"
          value={data.activeProjects}
          icon={TrendingUp}
          description="В работе прямо сейчас"
          iconClassName="text-emerald-600"
          borderColor="border-l-emerald-500"
          sparkColor="bg-emerald-500"
          onClick={() => navigate('projects')}
        />
        <StatCard
          title="На складе"
          value={data.totalWarehouseItems}
          icon={Warehouse}
          description="Позиций на учёте"
          iconClassName="text-teal-600"
          borderColor="border-l-teal-500"
          sparkColor="bg-teal-500"
          onClick={() => navigate('warehouse')}
        />
        <StatCard
          title="Низкий запас"
          value={data.lowStockItems}
          icon={AlertTriangle}
          description="Требуется пополнение"
          iconClassName="text-amber-500"
          borderColor="border-l-amber-400"
          sparkColor="bg-amber-400"
          onClick={() => navigate('warehouse')}
          cardClassName={
            data.lowStockItems > 0
              ? 'border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/30'
              : ''
          }
          valueClassName={
            data.lowStockItems > 0 ? 'text-amber-600 dark:text-amber-400' : ''
          }
        />
      </div>

      {/* ── Budget Overview Section (full width) ──────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="relative overflow-hidden">
          {/* Subtle animated border accent */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent animate-pulse-soft" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="size-5 text-muted-foreground" />
              Бюджет и затраты
            </CardTitle>
            <CardDescription>Обзор бюджета по проектам и категориям</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
              {/* Left: Circular progress + budget numbers */}
              <div className="flex flex-col items-center gap-6">
                <CircularProgressRing percent={spentPercent} />
                <div className="flex flex-col items-center gap-3 w-full">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Общий бюджет</p>
                    <p className="text-3xl font-bold tracking-tight">
                      {formatAmount(budgetData.totalBudget)}
                    </p>
                  </div>
                  <div className="flex gap-8">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Потрачено</p>
                      <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatAmount(budgetData.spentBudget)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Ожидание</p>
                      <p className="text-lg font-semibold text-amber-600 dark:text-amber-400">
                        {formatAmount(budgetData.pendingBudget)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Bar chart budget vs spent by category */}
              <div className="min-h-[300px]">
                {budgetData.byCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={budgetData.byCategory}
                      layout="vertical"
                      margin={{ top: 0, right: 20, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis
                        type="number"
                        tickFormatter={(v: number) => `${formatCompact(v)} ₽`}
                        fontSize={11}
                      />
                      <YAxis
                        dataKey="category"
                        type="category"
                        width={100}
                        fontSize={11}
                        tickLine={false}
                      />
                      <Tooltip content={<CategoryTooltip />} />
                      <Bar dataKey="budget" name="Бюджет" radius={[0, 4, 4, 0]} barSize={12}>
                        {budgetData.byCategory.map((_entry, index) => (
                          <Cell key={`budget-${index}`} fill="#94a3b8" />
                        ))}
                      </Bar>
                      <Bar dataKey="spent" name="Потрачено" radius={[0, 4, 4, 0]} barSize={12}>
                        {budgetData.byCategory.map((_entry, index) => (
                          <Cell key={`spent-${index}`} fill="#10b981" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Нет данных о бюджете
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ── Project Status Distribution & Monthly Trend (2-column) ───── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pie Chart: Project Status */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="size-5 text-muted-foreground" />
                Статусы проектов
              </CardTitle>
              <CardDescription>Распределение проектов по статусам</CardDescription>
            </CardHeader>
            <CardContent>
              {(data.projectStatusData?.length ?? 0) > 0 ? (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.projectStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        animationBegin={0}
                        animationDuration={800}
                      >
                        {data.projectStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number, name: string) => [`${value} шт.`, name]}
                        contentStyle={{ borderRadius: '0.5rem', fontSize: '0.75rem' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                    {data.projectStatusData.map((entry, index) => (
                      <div key={index} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          className="inline-block size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span>{entry.name}</span>
                        <span className="font-medium text-foreground">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                  Нет данных о статусах
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Line Chart: Monthly Projects Trend */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-5 text-muted-foreground" />
                Тренд проектов
              </CardTitle>
              <CardDescription>Новые проекты за последние 6 месяцев</CardDescription>
            </CardHeader>
            <CardContent>
              {(data.monthlyProjectsData?.length ?? 0) > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart
                    data={data.monthlyProjectsData}
                    margin={{ top: 10, right: 10, bottom: 0, left: -10 }}
                  >
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="month"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value} шт.`, 'Проектов']}
                      contentStyle={{ borderRadius: '0.5rem', fontSize: '0.75rem' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#colorCount)"
                      animationDuration={800}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                  Нет данных за последние месяцы
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Warehouse Stock Overview (full width) ──────────────────────── */}
      {(data.warehouseStockData?.length ?? 0) > 0 && (
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="size-5 text-muted-foreground" />
                Обзор складских запасов
              </CardTitle>
              <CardDescription>Топ-10 позиций по количеству</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto custom-scrollbar space-y-3">
                {data.warehouseStockData.map((item, idx) => {
                  const maxQty = Math.max(item.quantity, item.minQuantity, 1)
                  const quantityPercent = (item.quantity / maxQty) * 100
                  const minPercent = (item.minQuantity / maxQty) * 100

                  const barColor =
                    item.status === 'ok'
                      ? 'bg-emerald-500'
                      : item.status === 'warning'
                        ? 'bg-amber-500'
                        : 'bg-red-500'

                  const labelColor =
                    item.status === 'ok'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : item.status === 'warning'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400'

                  const statusLabel =
                    item.status === 'ok'
                      ? 'Норма'
                      : item.status === 'warning'
                        ? 'Внимание'
                        : 'Мало'

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04, duration: 0.3 }}
                      className="group"
                    >
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <span className="text-sm font-medium truncate max-w-[200px] sm:max-w-none">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-3 shrink-0 text-xs">
                          <span className={labelColor}>
                            {item.quantity} / {item.minQuantity} мин.
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${
                              item.status === 'ok'
                                ? 'border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400'
                                : item.status === 'warning'
                                  ? 'border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400'
                                  : 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400'
                            }`}
                          >
                            {statusLabel}
                          </Badge>
                        </div>
                      </div>
                      <div className="relative h-2.5 w-full rounded-full bg-muted overflow-hidden">
                        {/* Min quantity marker */}
                        <div
                          className="absolute top-0 h-full w-px bg-foreground/30 z-10"
                          style={{ left: `${Math.min(minPercent, 100)}%` }}
                        />
                        {/* Quantity bar */}
                        <motion.div
                          className={`h-full rounded-full ${barColor}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(quantityPercent, 100)}%` }}
                          transition={{ delay: idx * 0.04 + 0.2, duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Project Costs Table ───────────────────────────────────────── */}
      {projectCostData.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="size-5 text-muted-foreground" />
                Затраты по проектам
              </CardTitle>
              <CardDescription>Бюджет и освоение по каждому проекту</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-64 overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Проект</th>
                      <th className="pb-2 pr-4 font-medium text-right">Бюджет</th>
                      <th className="pb-2 pr-4 font-medium text-right">Потрачено</th>
                      <th className="pb-2 font-medium text-center">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectCostData.map((project, idx) => {
                      const utilization = project.budget > 0
                        ? (project.spent / project.budget) * 100
                        : 0
                      const utilizationColor =
                        utilization < 70
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : utilization <= 90
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-red-600 dark:text-red-400'
                      const barColor =
                        utilization < 70
                          ? 'bg-emerald-500'
                          : utilization <= 90
                            ? 'bg-amber-500'
                            : 'bg-red-500'

                      return (
                        <motion.tr
                          key={idx}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.04 }}
                          className="border-b last:border-0 transition-colors hover:bg-muted/50"
                        >
                          <td className="py-2.5 pr-4 font-medium truncate max-w-[200px]">
                            {project.projectName}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-muted-foreground">
                            {formatCompact(project.budget)} ₽
                          </td>
                          <td className="py-2.5 pr-4">
                            <div className="flex items-center gap-2 justify-end">
                              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${barColor} transition-all duration-500`}
                                  style={{ width: `${Math.min(utilization, 100)}%` }}
                                />
                              </div>
                              <span className={`text-right ${utilizationColor}`}>
                                {formatCompact(project.spent)} ₽
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 text-center">
                            {getStatusBadge(project.status)}
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── Activity Feed & Recent Projects ───────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Activity Feed */}
        <motion.div variants={itemVariants} className="lg:col-span-1">
          <ActivityFeed />
        </motion.div>

        {/* Recent Projects */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-5 text-muted-foreground" />
                Последние проекты
              </CardTitle>
              <CardDescription>5 последних проектов</CardDescription>
            </CardHeader>
            <CardContent>
              {data.recentProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-4 mb-4">
                    <FileText className="size-8 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Пока нет проектов. Создайте первый!
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4 transition-all hover:shadow-md hover:-translate-y-0.5"
                    onClick={() => navigate('projects')}
                  >
                    <Plus className="size-4" />
                    Новый проект
                  </Button>
                </div>
              ) : (
                <div className="max-h-80 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                  {data.recentProjects.map((project, idx) => (
                    <motion.button
                      key={project.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05, duration: 0.3 }}
                      onClick={() => navigateToProject(project.id)}
                      className="group flex w-full items-start gap-4 rounded-xl border bg-card p-4 text-left transition-all duration-200 hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15 group-hover:scale-110 duration-200">
                        <FolderKanban className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="truncate font-medium leading-tight group-hover:text-primary transition-colors">
                            {project.name}
                          </h4>
                          {getStatusBadge(project.status)}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {project.customerName && (
                            <span className="flex items-center gap-1">
                              <Building2 className="size-3" />
                              {project.customerName}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="size-3" />
                            {formatDate(project.createdAt)}
                          </span>
                          {project._count?.items > 0 && (
                            <span className="flex items-center gap-1">
                              <Package className="size-3" />
                              {project._count.items} поз.
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Quick Actions (compact) ───────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardContent className="flex flex-wrap items-center gap-3 py-4">
            <span className="text-sm font-medium text-muted-foreground mr-2">Быстрые действия:</span>
            <Button
              size="sm"
              className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
              onClick={() => navigate('projects')}
            >
              <Plus className="size-4" />
              Новый проект
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30"
              onClick={() => navigate('suppliers')}
            >
              <Users className="size-4" />
              Поставщик
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30"
              onClick={() => navigate('warehouse')}
            >
              <Warehouse className="size-4" />
              Склад
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30"
              onClick={() => navigate('requests')}
            >
              <Mail className="size-4" />
              Запрос
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
