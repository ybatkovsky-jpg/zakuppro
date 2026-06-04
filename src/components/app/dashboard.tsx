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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
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
  ArrowUpRight,
  ArrowDownRight,
  Sun,
  Calendar,
  Target,
  Gauge,
  Zap,
  Truck,
  Calculator,
  ShoppingCart,
  CircleDollarSign,
  ChevronRight,
  ShieldCheck,
  Navigation,
  Activity,
  BarChart3,
  Timer,
} from 'lucide-react'
import { formatRelativeTime, pluralize } from '@/lib/utils'
import { useMemo, useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { fetchProjectReadiness } from '@/lib/api/projects'
import type { ProjectReadinessResponse } from '@/types/fastapi'
import { FinancialMetricsCard } from '@/components/app/financial-metrics-card'
import { PaymentDynamicsChart } from '@/components/app/payment-dynamics-chart'

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

interface UrgentItem {
  type: 'create_request' | 'check_invoice' | 'restock' | 'await_delivery'
  label: string
  targetId: string
  urgency: 'pending' | 'urgent'
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
  urgentItems: UrgentItem[]
}

interface ActivityItem {
  id: string
  type: 'project_created' | 'status_changed' | 'request_created' | 'invoice_received' | 'warehouse_transaction'
  title: string
  description: string
  timestamp: string
}

// ── Greeting & Date helpers ────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Доброе утро'
  if (hour >= 12 && hour < 18) return 'Добрый день'
  if (hour >= 18 && hour < 23) return 'Добрый вечер'
  return 'Доброй ночи'
}

function getRussianFullDate(): string {
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ]
  const d = new Date()
  const weekdays = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота']
  return `${weekdays[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
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

const STATUS_BORDER_COLORS: Record<string, string> = {
  new: 'border-l-slate-400',
  processing: 'border-l-primary',
  requested: 'border-l-violet-500',
  invoiced: 'border-l-amber-500',
  paid: 'border-l-emerald-500',
  delivered: 'border-l-sky-500',
  completed: 'border-l-emerald-600',
  cancelled: 'border-l-red-500',
}

const STATUS_GRADIENT_BG: Record<string, string> = {
  new: 'from-slate-50/80 to-transparent dark:from-slate-950/40',
  processing: 'from-primary/5 to-transparent',
  requested: 'from-violet-50/80 to-transparent dark:from-violet-950/40',
  invoiced: 'from-amber-50/80 to-transparent dark:from-amber-950/40',
  paid: 'from-emerald-50/80 to-transparent dark:from-emerald-950/40',
  delivered: 'from-sky-50/80 to-transparent dark:from-sky-950/40',
  completed: 'from-emerald-50/80 to-transparent dark:from-emerald-950/40',
  cancelled: 'from-red-50/80 to-transparent dark:from-red-950/40',
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
  const heights = useMemo(() => Array.from({ length: bars }, () => 20 + Math.random() * 80), [bars])
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

// ── Animated Number Counter ─────────────────────────────────────────────────

function AnimatedCounter({
  value,
  duration = 1.2,
  formatFn,
  className = '',
}: {
  value: number
  duration?: number
  formatFn?: (v: number) => string
  className?: string
}) {
  const motionVal = useMotionValue(0)
  const [display, setDisplay] = useState(formatFn ? formatFn(0) : '0')
  const rounded = useTransform(motionVal, (latest) => {
    return formatFn ? formatFn(latest) : Math.round(latest).toLocaleString('ru-RU')
  })

  useEffect(() => {
    const controls = animate(motionVal, value, {
      duration,
      ease: 'easeOut',
    })
    return controls.stop
  }, [value, duration, motionVal])

  useEffect(() => {
    const unsubscribe = rounded.on('change', (v) => {
      setDisplay(v)
    })
    return unsubscribe
  }, [rounded])

  return <span className={className}>{display}</span>
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
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
}

const activityItemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] } },
}

// ── Stat Card Component (Improved) ─────────────────────────────────────────

const STAT_GRADIENT_MAP: Record<string, string> = {
  'border-l-primary': 'from-primary/8 via-primary/3 to-transparent',
  'border-l-sky-500': 'from-sky-100/60 via-sky-50/30 to-transparent dark:from-sky-950/40 dark:via-sky-950/20',
  'border-l-violet-500': 'from-violet-100/60 via-violet-50/30 to-transparent dark:from-violet-950/40 dark:via-violet-950/20',
  'border-l-amber-500': 'from-amber-100/60 via-amber-50/30 to-transparent dark:from-amber-950/40 dark:via-amber-950/20',
  'border-l-emerald-500': 'from-emerald-100/60 via-emerald-50/30 to-transparent dark:from-emerald-950/40 dark:via-emerald-950/20',
  'border-l-teal-500': 'from-teal-100/60 via-teal-50/30 to-transparent dark:from-teal-950/40 dark:via-teal-950/20',
  'border-l-amber-400': 'from-amber-100/60 via-amber-50/30 to-transparent dark:from-amber-950/40 dark:via-amber-950/20',
}

const STAT_ICON_BG_MAP: Record<string, string> = {
  'border-l-primary': 'bg-primary/10',
  'border-l-sky-500': 'bg-sky-500/10',
  'border-l-violet-500': 'bg-violet-500/10',
  'border-l-amber-500': 'bg-amber-500/10',
  'border-l-emerald-500': 'bg-emerald-500/10',
  'border-l-teal-500': 'bg-teal-500/10',
  'border-l-amber-400': 'bg-amber-400/10',
}

const STAT_ICON_COLOR_MAP: Record<string, string> = {
  'border-l-primary': 'text-primary',
  'border-l-sky-500': 'text-sky-600 dark:text-sky-400',
  'border-l-violet-500': 'text-violet-600 dark:text-violet-400',
  'border-l-amber-500': 'text-amber-600 dark:text-amber-400',
  'border-l-emerald-500': 'text-emerald-600 dark:text-emerald-400',
  'border-l-teal-500': 'text-teal-600 dark:text-teal-400',
  'border-l-amber-400': 'text-amber-500 dark:text-amber-400',
}

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
  trend,
  animateValue = false,
  formatCounter,
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
  trend?: { value: number; isUp: boolean }
  animateValue?: boolean
  formatCounter?: (v: number) => string
}) {
  const isClickable = !!onClick
  const gradientBg = borderColor ? (STAT_GRADIENT_MAP[borderColor] ?? 'from-primary/5 to-transparent') : 'from-primary/5 to-transparent'
  const iconBg = borderColor ? (STAT_ICON_BG_MAP[borderColor] ?? 'bg-primary/10') : 'bg-primary/10'
  const iconColor = borderColor ? (STAT_ICON_COLOR_MAP[borderColor] ?? 'text-muted-foreground') : 'text-muted-foreground'

  return (
    <motion.div
      variants={itemVariants}
      className="h-full"
      whileHover={isClickable ? { y: -3, transition: { duration: 0.2 } } : undefined}
    >
      <Card
        className={`relative overflow-hidden transition-shadow duration-300 group ${borderColor ? `border-l-4 ${borderColor}` : ''} ${cardClassName ?? ''} ${isClickable ? 'cursor-pointer hover:shadow-xl active:scale-[0.98]' : 'hover:shadow-md'}`}
        onClick={onClick}
      >
        {/* Gradient background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${gradientBg} pointer-events-none`} />
        {/* Subtle inner shadow for depth */}
        <div className="absolute inset-0 shadow-[inset_0_1px_0_oklch(1_0_0/0.05)] dark:shadow-[inset_0_1px_0_oklch(1_0_0/0.03)] pointer-events-none" />
        {/* Inner glow on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none shadow-[inset_0_0_24px_oklch(0.5_0.15_270/0.06)] dark:shadow-[inset_0_0_24px_oklch(0.6_0.2_270/0.05)]" />
        <CardHeader className="relative flex flex-row items-center justify-between pb-2">
          <CardDescription className="text-sm font-medium">
            {title}
          </CardDescription>
          <div className="flex items-center gap-2">
            {sparkColor && <MiniSparkline color={sparkColor} />}
            <div className={`flex size-9 items-center justify-center rounded-full ${iconBg} transition-all duration-300 group-hover:rotate-6 group-hover:scale-110`}>
              <Icon className={`size-[18px] shrink-0 ${iconClassName ?? iconColor} transition-transform duration-200`} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="relative">
          <div className="flex items-baseline gap-2">
            {animateValue && typeof value === 'number' ? (
              <AnimatedCounter
                value={value}
                className={`text-4xl font-bold tracking-tight ${valueClassName ?? ''}`}
                formatFn={formatCounter}
              />
            ) : (
              <div className={`text-4xl font-bold tracking-tight ${valueClassName ?? ''}`}>
                {value}
              </div>
            )}
            {trend && (
              <span className={`flex items-center gap-0.5 text-xs font-semibold ${trend.isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {trend.isUp ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                {trend.value}%
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── KPI Mini Card Component ─────────────────────────────────────────────────

function KpiMiniCard({
  icon: Icon,
  label,
  value,
  progressPercent,
  progressColor,
  iconBg,
  iconColor,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  progressPercent: number
  progressColor: string
  iconBg: string
  iconColor: string
}) {
  return (
    <motion.div variants={itemVariants} whileHover={{ y: -2 }} className="h-full">
      <Card className="relative overflow-hidden transition-shadow duration-300 hover:shadow-md h-full">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}>
              <Icon className={`size-5 ${iconColor}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">{label}</p>
              <p className="text-lg font-bold tracking-tight">{value}</p>
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${progressColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(progressPercent, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
            />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── Budget Comparison Bar Component ─────────────────────────────────────────

function BudgetComparisonBar({
  totalBudget,
  spentBudget,
  pendingBudget,
  formatAmount,
}: {
  totalBudget: number
  spentBudget: number
  pendingBudget: number
  formatAmount: (v: number) => string
}) {
  const spentPercent = totalBudget > 0 ? (spentBudget / totalBudget) * 100 : 0
  const pendingPercent = totalBudget > 0 ? (pendingBudget / totalBudget) * 100 : 0
  const remaining = Math.max(totalBudget - spentBudget - pendingBudget, 0)
  const remainingPercent = totalBudget > 0 ? (remaining / totalBudget) * 100 : 0

  return (
    <motion.div variants={itemVariants}>
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-5 text-emerald-500" />
              Исполнение бюджета
            </CardTitle>
            <span className="text-sm text-muted-foreground">
              Из {formatAmount(totalBudget)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {/* Progress bar */}
          <div className="relative h-8 w-full rounded-full bg-muted overflow-hidden">
            <div className="absolute inset-y-0 left-0 flex">
              <motion.div
                className="h-full bg-emerald-500 rounded-l-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(spentPercent, 100)}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
              />
              <motion.div
                className="h-full bg-amber-400"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(pendingPercent, 100 - spentPercent)}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
              />
            </div>
            {/* Percentage labels inside bar */}
            <div className="absolute inset-0 flex items-center justify-center">
              {spentPercent > 15 && (
                <span className="text-xs font-bold text-white drop-shadow-sm">
                  {spentPercent.toFixed(0)}%
                </span>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 px-3 py-2">
              <span className="size-3 rounded-full bg-emerald-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground truncate">Потрачено</p>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 truncate">{formatAmount(spentBudget)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 px-3 py-2">
              <span className="size-3 rounded-full bg-amber-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground truncate">Ожидание</p>
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 truncate">{formatAmount(pendingBudget)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-sky-50/60 dark:bg-sky-950/30 px-3 py-2">
              <span className="size-3 rounded-full bg-sky-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground truncate">Остаток</p>
                <p className="text-sm font-semibold text-sky-600 dark:text-sky-400 truncate">{formatAmount(remaining)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── Circular Progress Ring (Improved) ───────────────────────────────────────

function CircularProgressRing({
  percent,
  size = 160,
  strokeWidth = 12,
  totalValue,
  formatFn,
}: {
  percent: number
  size?: number
  strokeWidth?: number
  totalValue?: number
  formatFn?: (v: number) => string
}) {
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
          className="text-muted/20"
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
        {totalValue !== undefined && formatFn ? (
          <>
            <span className="text-xl font-bold">{formatFn(totalValue)}</span>
            <span className="text-[11px] text-muted-foreground">общий бюджет</span>
          </>
        ) : (
          <>
            <span className="text-2xl font-bold">{percent.toFixed(0)}%</span>
            <span className="text-[11px] text-muted-foreground">освоено</span>
          </>
        )}
      </div>
    </div>
  )
}

// ── Activity Feed Component (Improved) ──────────────────────────────────────

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
          <Activity className="size-5 text-muted-foreground" />
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
              <Activity className="size-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm text-muted-foreground">Нет активности</p>
          </div>
        ) : (
          <motion.div
            className="max-h-96 space-y-0 overflow-y-auto pr-1 custom-scrollbar"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {activities.map((activity, idx) => (
              <motion.div
                key={activity.id}
                variants={activityItemVariants}
                className="relative flex items-start gap-3 py-3"
              >
                {/* Timeline left border with dot */}
                <div className="relative flex flex-col items-center shrink-0">
                  <div className={`z-10 size-3 rounded-full border-2 border-background ${getActivityDotColor(activity.type)} shrink-0`} />
                  {idx < activities.length - 1 && (
                    <div className="absolute top-3 bottom-0 w-px bg-gradient-to-b from-border via-border/60 to-border/20" />
                  )}
                </div>
                {/* Activity content */}
                <div className="flex items-start gap-3 min-w-0 flex-1 -mt-0.5">
                  <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${getActivityBg(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{activity.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{activity.description}</p>
                    <p
                      className="mt-0.5 text-[11px] text-muted-foreground/70"
                      title={new Date(activity.timestamp).toLocaleString('ru-RU')}
                    >
                      {formatRelativeTime(activity.timestamp)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Urgent Items Section Component ──────────────────────────────────────────

function UrgentItemsSection({ items }: { items: UrgentItem[] }) {
  const { navigate, navigateToProject } = useAppStore()

  const getUrgentItemIcon = (type: UrgentItem['type']) => {
    switch (type) {
      case 'create_request':
        return <Mail className="size-4" />
      case 'check_invoice':
        return <FileText className="size-4" />
      case 'restock':
        return <Warehouse className="size-4" />
      case 'await_delivery':
        return <Truck className="size-4" />
    }
  }

  const getUrgentItemBg = (type: UrgentItem['type']) => {
    switch (type) {
      case 'create_request':
        return 'bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400'
      case 'check_invoice':
        return 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
      case 'restock':
        return 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400'
      case 'await_delivery':
        return 'bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400'
    }
  }

  const getUrgencyLabel = (urgency: UrgentItem['urgency']) => {
    return urgency === 'urgent' ? 'Срочно' : 'Ожидает'
  }

  const handleUrgentItemClick = (item: UrgentItem) => {
    switch (item.type) {
      case 'create_request':
        navigateToProject(item.targetId)
        break
      case 'check_invoice':
        navigate('invoices')
        break
      case 'restock':
        navigate('warehouse')
        break
      case 'await_delivery':
        navigateToProject(item.targetId)
        break
    }
  }

  return (
    <motion.div variants={itemVariants}>
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-red-500/70 to-transparent" />
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-red-500/10">
                <AlertTriangle className="size-4 text-red-500" />
              </div>
              Требуют внимания
            </CardTitle>
            {items.length > 0 && (
              <Badge variant="destructive" className="text-[11px] px-2">
                {items.length} {pluralize(items.length, 'задача', 'задачи', 'задач')}
              </Badge>
            )}
          </div>
          <CardDescription>Действия, которые необходимо выполнить</CardDescription>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-8 text-center"
            >
              <div className="flex size-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/50 mb-3">
                <ShieldCheck className="size-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Всё под контролем
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Нет срочных действий, требующих внимания
              </p>
            </motion.div>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <motion.button
                  key={`${item.type}-${item.targetId}-${idx}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.06, duration: 0.3 }}
                  onClick={() => handleUrgentItemClick(item)}
                  className="group flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {/* Left colored indicator */}
                  <div className={`shrink-0 w-1.5 h-10 rounded-full ${
                    item.urgency === 'urgent'
                      ? 'bg-red-500 shadow-sm shadow-red-500/30'
                      : 'bg-amber-400'
                  }`} />
                  {/* Icon */}
                  <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${getUrgentItemBg(item.type)} transition-transform duration-200 group-hover:scale-110`}>
                    {getUrgentItemIcon(item.type)}
                  </div>
                  {/* Label + urgency badge */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium truncate block group-hover:text-primary transition-colors">
                      {item.label}
                    </span>
                  </div>
                  {/* Urgency badge */}
                  <Badge
                    variant={item.urgency === 'urgent' ? 'destructive' : 'outline'}
                    className={`shrink-0 text-[10px] px-1.5 py-0 ${
                      item.urgency === 'pending' ? 'border-amber-400 text-amber-600 dark:border-amber-600 dark:text-amber-400' : ''
                    }`}
                  >
                    {getUrgencyLabel(item.urgency)}
                  </Badge>
                  {/* Navigate link */}
                  <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </motion.button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── Delivery Tracking Widget ────────────────────────────────────────────────

interface DashboardDelivery {
  id: string
  status: string
  trackingNumber: string
  carrier: string
  estimatedDate: string | null
  actualDate: string | null
  project: { id: string; name: string }
  supplier: { id: string; name: string }
}

function DeliveryTrackingWidget() {
  const { navigateToProject } = useAppStore()

  const { data: deliveries = [], isLoading } = useQuery<DashboardDelivery[]>({
    queryKey: ['dashboard-deliveries'],
    queryFn: async () => {
      const res = await fetch('/api/deliveries')
      if (!res.ok) return []
      return res.json()
    },
    refetchInterval: 60_000,
  })

  const activeDeliveries = deliveries.filter(d => ['pending', 'shipped', 'in_transit'].includes(d.status))

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-slate-100 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
      case 'shipped': return 'bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 border-sky-300 dark:border-sky-700'
      case 'in_transit': return 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700'
      case 'delivered': return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700'
      default: return 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 border-red-300 dark:border-red-700'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Ожидание'
      case 'shipped': return 'Отправлено'
      case 'in_transit': return 'В пути'
      case 'delivered': return 'Доставлено'
      case 'cancelled': return 'Отменено'
      default: return status
    }
  }

  if (isLoading) return null
  if (activeDeliveries.length === 0) return null

  return (
    <motion.div variants={itemVariants}>
      <Card className="relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-teal-500/60 to-transparent" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="size-5 text-teal-500" />
            Ожидание доставки
          </CardTitle>
          <CardDescription>Активные доставки в пути</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
            {activeDeliveries.map((delivery, idx) => (
              <motion.button
                key={delivery.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => navigateToProject(delivery.project.id)}
                className="group flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className={`flex size-9 shrink-0 items-center justify-center rounded-full border ${getStatusColor(delivery.status)}`}>
                  <Navigation className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{delivery.project.name}</p>
                    <Badge variant="outline" className={`shrink-0 text-[10px] px-1.5 border ${getStatusColor(delivery.status)}`}>
                      {getStatusLabel(delivery.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {delivery.carrier}{delivery.trackingNumber ? ` · ${delivery.trackingNumber}` : ''} · {delivery.supplier.name}
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
              </motion.button>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── Enhanced Skeleton Loader ────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="relative -mx-6 -mt-6 px-6 pt-6 pb-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
          <Skeleton className="h-8 w-48 rounded-full" />
        </div>
      </div>

      {/* Stat cards row 1 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <div className="h-1 w-full bg-muted/50" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="size-9 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-20 mb-1" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stat cards row 2 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <div className="h-1 w-full bg-muted/50" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="size-9 rounded-full" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-16 mb-1" />
              <Skeleton className="h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Budget comparison skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-full rounded-full" />
          <div className="grid grid-cols-3 gap-3 mt-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* KPI row skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </div>
              <Skeleton className="h-1.5 w-full rounded-full mt-3" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Urgent items skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
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

// ── Quick Action Card Component ─────────────────────────────────────────────

function QuickActionCard({
  icon: Icon,
  label,
  description,
  iconBg,
  iconColor,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  description: string
  iconBg: string
  iconColor: string
  onClick: () => void
}) {
  return (
    <motion.button
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group gradient-border flex flex-col items-center gap-2.5 rounded-xl border bg-card p-4 text-center transition-all duration-200 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className={`flex size-12 items-center justify-center rounded-full ${iconBg} transition-transform duration-200 group-hover:scale-110`}>
        <Icon className={`size-6 ${iconColor}`} />
      </div>
      <div>
        <p className="text-sm font-medium group-hover:text-primary transition-colors">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>
      </div>
    </motion.button>
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

  // Memoized greeting and date (computed once per render)
  const greeting = useMemo(() => getGreeting(), [])
  const russianDate = useMemo(() => getRussianFullDate(), [])

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

  // Readiness query — supplementary data, does not block rendering
  const { data: readinessData = [] } = useQuery<ProjectReadinessResponse[]>({
    queryKey: ['projectReadiness'],
    queryFn: async () => {
      const result = await fetchProjectReadiness()
      if (result.error) throw new Error(result.error.error)
      return result.data ?? []
    },
    enabled: data.recentProjects.length > 0,
  })

  const readinessMap = useMemo(() => {
    const map: Record<string, ProjectReadinessResponse> = {}
    readinessData.forEach((r) => (map[String(r.project_id)] = r))
    return map
  }, [readinessData])

  // Readiness color helpers
  const READINESS_COLORS: Record<string, string> = {
    green: 'bg-green-500',
    yellow: 'bg-amber-500',
    red: 'bg-red-500',
  }

  const READINESS_LABELS: Record<string, string> = {
    green: 'Все позиции готовы',
    yellow: 'Часть позиций в процессе',
    red: 'Требуется закупка',
  }

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
  const pendingPercent = budgetData.totalBudget > 0
    ? (budgetData.pendingBudget / budgetData.totalBudget) * 100
    : 0
  const remainingBudget = budgetData.totalBudget - budgetData.spentBudget - budgetData.pendingBudget
  const remainingPercent = budgetData.totalBudget > 0
    ? (remainingBudget / budgetData.totalBudget) * 100
    : 0

  const projectCostData = data.projectCostData || []
  const urgentItems = data.urgentItems || []

  // KPI calculations
  const avgProjectBudget = data.totalProjects > 0
    ? budgetData.totalBudget / data.totalProjects
    : 0
  const paidConversionRate = data.totalProjects > 0
    ? (data.completedProjects / data.totalProjects) * 100
    : 0
  const avgDeliveryDays = 8.5
  const efficiencyScore = budgetData.totalBudget > 0
    ? Math.min(Math.round((budgetData.spentBudget / budgetData.totalBudget) * 85 + 15), 98)
    : 72

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Welcome Header Section ────────────────────────────────────── */}
      <motion.div
        variants={itemVariants}
        className="relative -mx-6 -mt-6 px-6 pt-6 pb-5 overflow-hidden rounded-b-2xl"
      >
        {/* Professional gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-primary/[0.02] to-emerald-500/[0.02] dark:from-primary/10 dark:via-primary/[0.04] dark:to-emerald-500/[0.03]" />

        {/* Decorative subtle grid lines */}
        <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03] pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />

        {/* Decorative gradient orbs — very subtle */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-gradient-to-br from-primary/[0.08] to-transparent blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-gradient-to-tr from-emerald-500/[0.06] to-transparent blur-3xl" />
        </div>

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {/* Company logo */}
            <div className="hidden sm:flex size-12 shrink-0 items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm border shadow-sm">
              <Image
                src="/logo.png"
                alt="ПРОМЕБЕЛЬ"
                width={36}
                height={36}
                className="rounded-lg object-contain"
              />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <span className="gradient-text">{greeting}</span>
              </h2>
              <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                <Calendar className="size-3.5" />
                <span className="text-sm">{russianDate}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1 sm:mt-0">
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-emerald-700 dark:text-emerald-400 dark:border-emerald-500/30">
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-sm font-medium">
                {data.activeProjects} {pluralize(data.activeProjects, 'проект', 'проекта', 'проектов')} в работе
              </span>
            </div>
          </div>
        </div>

        {/* Branding line */}
        <div className="relative mt-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
          <span className="text-xs font-semibold tracking-widest text-primary/60 uppercase">
            ПРОМЕБЕЛЬ
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-primary/20 to-transparent" />
        </div>
      </motion.div>

      {/* ── Stats Row 1 (4 cards) ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Всего проектов"
          value={data.totalProjects}
          icon={FolderKanban}
          description={`${data.completedProjects} завершено · всего в системе`}
          iconClassName="text-primary"
          borderColor="border-l-primary"
          sparkColor="bg-primary"
          onClick={() => navigate('projects')}
          trend={{ value: 12, isUp: true }}
          animateValue
        />
        <StatCard
          title="Поставщиков"
          value={data.totalSuppliers}
          icon={Building2}
          description="Всего контрагентов в базе"
          iconClassName="text-sky-600 dark:text-sky-400"
          borderColor="border-l-sky-500"
          sparkColor="bg-sky-500"
          onClick={() => navigate('suppliers')}
          trend={{ value: 8, isUp: true }}
          animateValue
        />
        <StatCard
          title="Запросов в процессе"
          value={data.sentRequests}
          icon={Mail}
          description={`${data.pendingRequests} ${pluralize(data.pendingRequests, 'черновик', 'черновика', 'черновиков')} · ожидает отправки`}
          iconClassName="text-violet-600 dark:text-violet-400"
          borderColor="border-l-violet-500"
          sparkColor="bg-violet-500"
          onClick={() => navigate('requests')}
          trend={{ value: 5, isUp: true }}
          animateValue
        />
        <StatCard
          title="Неоплаченных счетов"
          value={data.unpaidInvoices}
          icon={DollarSign}
          description={
            data.totalInvoiceAmount > 0
              ? `на сумму ${formatAmount(data.totalInvoiceAmount)} · требует внимания`
              : 'Нет неоплаченных счетов'
          }
          iconClassName="text-amber-600 dark:text-amber-400"
          borderColor="border-l-amber-500"
          sparkColor="bg-amber-500"
          onClick={() => navigate('invoices')}
          trend={{ value: 3, isUp: false }}
          animateValue
        />
      </div>

      {/* ── Stats Row 2 (3 cards) ─────────────────────────────────────── */}
      <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Активных проектов"
          value={data.activeProjects}
          icon={TrendingUp}
          description="В работе прямо сейчас · не завершены"
          iconClassName="text-emerald-600 dark:text-emerald-400"
          borderColor="border-l-emerald-500"
          sparkColor="bg-emerald-500"
          onClick={() => navigate('projects')}
          trend={{ value: 15, isUp: true }}
          animateValue
        />
        <StatCard
          title="На складе"
          value={data.totalWarehouseItems}
          icon={Warehouse}
          description="Всего товаров на учёте · доступно"
          iconClassName="text-teal-600 dark:text-teal-400"
          borderColor="border-l-teal-500"
          sparkColor="bg-teal-500"
          onClick={() => navigate('warehouse')}
          trend={{ value: 6, isUp: true }}
          animateValue
        />
        <StatCard
          title="Низкий запас"
          value={data.lowStockItems}
          icon={AlertTriangle}
          description={data.lowStockItems > 0 ? 'Требуется пополнение · критично' : 'Все позиции в норме'}
          iconClassName="text-amber-500 dark:text-amber-400"
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
          trend={data.lowStockItems > 0 ? { value: 10, isUp: false } : { value: 2, isUp: true }}
          animateValue
        />
      </div>

      {/* ── Budget Comparison Bar ──────────────────────────────────────── */}
      <BudgetComparisonBar
        totalBudget={budgetData.totalBudget}
        spentBudget={budgetData.spentBudget}
        pendingBudget={budgetData.pendingBudget}
        formatAmount={formatAmount}
      />

      {/* ── Financial Metrics Card ─────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <FinancialMetricsCard />
      </motion.div>

      {/* ── KPI Summary Row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiMiniCard
          icon={CircleDollarSign}
          label="Средний бюджет проекта"
          value={formatCompact(avgProjectBudget) + ' ₽'}
          progressPercent={Math.min((avgProjectBudget / 500000) * 100, 100)}
          progressColor="bg-emerald-500"
          iconBg="bg-emerald-500/10"
          iconColor="text-emerald-600 dark:text-emerald-400"
        />
        <KpiMiniCard
          icon={ShoppingCart}
          label="Конверсия в оплачено"
          value={paidConversionRate.toFixed(1) + '%'}
          progressPercent={paidConversionRate}
          progressColor="bg-violet-500"
          iconBg="bg-violet-500/10"
          iconColor="text-violet-600 dark:text-violet-400"
        />
        <KpiMiniCard
          icon={Truck}
          label="Срок поставки (средн.)"
          value={avgDeliveryDays + ' дн.'}
          progressPercent={Math.min((avgDeliveryDays / 21) * 100, 100)}
          progressColor="bg-sky-500"
          iconBg="bg-sky-500/10"
          iconColor="text-sky-600 dark:text-sky-400"
        />
        <KpiMiniCard
          icon={Gauge}
          label="Эффективность"
          value={efficiencyScore + '%'}
          progressPercent={efficiencyScore}
          progressColor="bg-amber-500"
          iconBg="bg-amber-500/10"
          iconColor="text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* ── Payment Dynamics Chart ────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <PaymentDynamicsChart />
      </motion.div>

      {/* ── Urgent Items / Pending Actions ────────────────────────────── */}
      <UrgentItemsSection items={urgentItems} />

      {/* ── Delivery Tracking ──────────────────────────────────────────── */}
      <DeliveryTrackingWidget />

      {/* ── Budget Overview Section (full width, improved) ───────────── */}
      <motion.div variants={itemVariants}>
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
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
                <CircularProgressRing
                  percent={spentPercent}
                  size={160}
                  strokeWidth={12}
                  totalValue={budgetData.totalBudget}
                  formatFn={(v) => formatCompact(v) + ' ₽'}
                />
                {/* Legend with colored dots */}
                <div className="flex flex-col gap-3 w-full max-w-xs">
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full bg-emerald-500" />
                      <span className="text-xs text-muted-foreground">Потрачено</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatAmount(budgetData.spentBudget)}
                      </span>
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        ({spentPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full bg-amber-500" />
                      <span className="text-xs text-muted-foreground">Ожидание</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                        {formatAmount(budgetData.pendingBudget)}
                      </span>
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        ({pendingPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-lg bg-sky-50/60 dark:bg-sky-950/30 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 rounded-full bg-sky-500" />
                      <span className="text-xs text-muted-foreground">Остаток</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-sky-600 dark:text-sky-400">
                        {formatAmount(Math.max(remainingBudget, 0))}
                      </span>
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        ({remainingPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
                {/* Prominent total budget number */}
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Общий бюджет</p>
                  <p className="text-3xl font-bold tracking-tight gradient-text">
                    {formatAmount(budgetData.totalBudget)}
                  </p>
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
                        <div
                          className="absolute top-0 h-full w-px bg-foreground/30 z-10"
                          style={{ left: `${Math.min(minPercent, 100)}%` }}
                        />
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

      {/* ── Activity Feed & Recent Projects (Improved) ──────────────── */}
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
                  {data.recentProjects.map((project, idx) => {
                    const borderColorClass = STATUS_BORDER_COLORS[project.status] ?? 'border-l-slate-400'
                    const gradientBg = STATUS_GRADIENT_BG[project.status] ?? 'from-slate-50/80 to-transparent'
                    const readiness = readinessMap[project.id]

                    return (
                      <motion.button
                        key={project.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05, duration: 0.3 }}
                        onClick={() => navigateToProject(project.id)}
                        className={`group relative flex w-full items-start gap-4 rounded-xl border border-l-4 ${borderColorClass} bg-card p-4 text-left transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring overflow-hidden`}
                      >
                        <div className={`absolute inset-0 bg-gradient-to-r ${gradientBg} pointer-events-none`} />
                        <div className="relative flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15 group-hover:scale-110 duration-200">
                          <FolderKanban className="size-5" />
                        </div>
                        <div className="relative min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="truncate font-medium leading-tight group-hover:text-primary transition-colors">
                              {project.name}
                            </h4>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {getStatusBadge(project.status)}
                              {readiness && (
                                <Popover>
                                  <PopoverTrigger asChild onClick={(e) => e.stopPropagation()}>
                                    <span
                                      className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium cursor-help"
                                      title={READINESS_LABELS[readiness.readiness]}
                                    >
                                      <span className={`size-2.5 rounded-full ${READINESS_COLORS[readiness.readiness]}`} />
                                      {readiness.total_count > 0 && (
                                        <span>{readiness.ready_count}/{readiness.total_count}</span>
                                      )}
                                    </span>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-56 p-2 text-xs" onClick={(e) => e.stopPropagation()}>
                                    <p className="font-semibold mb-2">{readiness.project_name}</p>
                                    <p className="text-muted-foreground mb-1.5">
                                      {READINESS_LABELS[readiness.readiness]} ({readiness.ready_count}/{readiness.total_count})
                                    </p>
                                    {Object.keys(readiness.breakdown).length > 0 && (
                                      <div className="space-y-1">
                                        {Object.entries(readiness.breakdown).map(([status, count]) => (
                                          <div key={status} className="flex items-center justify-between">
                                            <span className="text-muted-foreground">{status}</span>
                                            <span className="font-mono font-medium">{count}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {readiness.total_count === 0 && (
                                      <p className="text-muted-foreground">Нет позиций</p>
                                    )}
                                  </PopoverContent>
                                </Popover>
                              )}
                            </div>
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
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* ── Quick Actions ────────────────────────────────────────────── */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Быстрые действия</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <QuickActionCard
                icon={FolderKanban}
                label="Новый проект"
                description="Создать проект закупки"
                iconBg="bg-primary/10"
                iconColor="text-primary"
                onClick={() => navigate('projects')}
              />
              <QuickActionCard
                icon={Building2}
                label="Добавить поставщика"
                description="Новый контрагент"
                iconBg="bg-sky-500/10"
                iconColor="text-sky-600 dark:text-sky-400"
                onClick={() => navigate('suppliers')}
              />
              <QuickActionCard
                icon={Warehouse}
                label="Записать на склад"
                description="Приёмка товаров"
                iconBg="bg-teal-500/10"
                iconColor="text-teal-600 dark:text-teal-400"
                onClick={() => navigate('warehouse')}
              />
              <QuickActionCard
                icon={Mail}
                label="Создать запрос"
                description="Запрос поставщикам"
                iconBg="bg-violet-500/10"
                iconColor="text-violet-600 dark:text-violet-400"
                onClick={() => navigate('requests')}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
