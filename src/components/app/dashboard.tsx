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
} from 'lucide-react'

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
      return <Badge variant="secondary">{STATUS_LABELS[status]}</Badge>
    case 'processing':
      return <Badge variant="default">{STATUS_LABELS[status]}</Badge>
    case 'requested':
      return (
        <Badge variant="outline" className="border-primary/30 text-primary">
          {STATUS_LABELS[status]}
        </Badge>
      )
    case 'invoiced':
      return (
        <Badge
          variant="default"
          className="bg-amber-500 hover:bg-amber-500/90 text-white"
        >
          {STATUS_LABELS[status]}
        </Badge>
      )
    case 'paid':
      return (
        <Badge
          variant="default"
          className="bg-emerald-600 hover:bg-emerald-600/90 text-white"
        >
          <CheckCircle2 className="size-3" />
          {STATUS_LABELS[status]}
        </Badge>
      )
    case 'delivered':
      return (
        <Badge
          variant="default"
          className="bg-emerald-600 hover:bg-emerald-600/90 text-white"
        >
          {STATUS_LABELS[status]}
        </Badge>
      )
    case 'completed':
      return (
        <Badge
          variant="default"
          className="bg-emerald-600 hover:bg-emerald-600/90 text-white"
        >
          <CheckCircle2 className="size-3" />
          {STATUS_LABELS[status]}
        </Badge>
      )
    case 'cancelled':
      return <Badge variant="destructive">{STATUS_LABELS[status]}</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
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

// ── Stat Card Component ─────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  iconClassName,
  cardClassName,
  valueClassName,
}: {
  title: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  description?: string
  iconClassName?: string
  cardClassName?: string
  valueClassName?: string
}) {
  return (
    <Card
      className={`transition-shadow hover:shadow-md ${cardClassName ?? ''}`}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardDescription className="text-sm font-medium">
          {title}
        </CardDescription>
        <Icon className={`size-5 shrink-0 ${iconClassName ?? 'text-muted-foreground'}`} />
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
  )
}

// ── Skeleton Loader ─────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats row 1 */}
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
      {/* Stats row 2 */}
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
      {/* Recent projects */}
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

  return (
    <div className="space-y-6">
      {/* ── Section Title ─────────────────────────────────────────────── */}
      <div>
        <p className="text-muted-foreground">
          Обзор ключевых показателей и последние проекты
        </p>
      </div>

      {/* ── Stats Row 1 (4 cards) ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Всего проектов"
          value={data.totalProjects}
          icon={FolderKanban}
          description={`${data.completedProjects} завершено`}
          iconClassName="text-primary"
        />
        <StatCard
          title="Поставщиков"
          value={data.totalSuppliers}
          icon={Building2}
          description="Всего в базе"
          iconClassName="text-primary"
        />
        <StatCard
          title="Запросов в процессе"
          value={data.sentRequests}
          icon={Mail}
          description={`${data.pendingRequests} черновиков`}
          iconClassName="text-sky-600"
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
        />
        <StatCard
          title="На складе"
          value={data.totalWarehouseItems}
          icon={Warehouse}
          description="Позиций на учёте"
          iconClassName="text-primary"
        />
        <StatCard
          title="Низкий запас"
          value={data.lowStockItems}
          icon={AlertTriangle}
          description="Требуется пополнение"
          iconClassName="text-amber-500"
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

      {/* ── Recent Projects & Quick Actions ───────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Projects */}
        <Card className="lg:col-span-2">
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
                <FileText className="mb-3 size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Пока нет проектов. Создайте первый!
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => navigate('projects')}
                >
                  <Plus className="size-4" />
                  Новый проект
                </Button>
              </div>
            ) : (
              <div className="max-h-96 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                {data.recentProjects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => navigateToProject(project.id)}
                    className="group flex w-full items-start gap-4 rounded-lg border bg-card p-4 text-left transition-all hover:border-primary/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                      <FolderKanban className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="truncate font-medium leading-tight group-hover:text-primary">
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
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5 text-muted-foreground" />
              Быстрые действия
            </CardTitle>
            <CardDescription>Частые операции</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full justify-start"
              onClick={() => navigate('projects')}
            >
              <Plus className="size-4" />
              Новый проект
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('suppliers')}
            >
              <Users className="size-4" />
              Добавить поставщика
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('warehouse')}
            >
              <Warehouse className="size-4" />
              Склад
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
