'use client'

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Building2,
  Mail,
  Phone,
  User,
  MapPin,
  StickyNote,
  Package,
  PlusCircle,
  Star,
  ShoppingCart,
  TrendingUp,
  Trophy,
  ExternalLink,
  PhoneCall,
  Clock,
  DollarSign,
  ArrowRight,
  Filter,
  Globe,
  Calendar,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { EmptyState } from '@/components/app/empty-state'
import { useAppStore } from '@/store/app-store'

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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'
import { calculateSupplierRating, RELIABILITY_CONFIG, DELIVERY_SPEED_CONFIG } from '@/lib/supplier-rating'

// === Types ===
interface Supplier {
  id: string
  name: string
  email: string
  phone: string
  contactPerson: string
  address: string
  notes: string
  createdAt: string
  updatedAt: string
  _count?: {
    projectItems: number
  }
}

interface SupplierAnalytics {
  id: string
  name: string
  totalItems: number
  totalSpent: number
  avgDeliveryDays: number
  completionRate: number
}

interface SupplierFormData {
  name: string
  email: string
  phone: string
  contactPerson: string
  address: string
  notes: string
}

const emptyForm: SupplierFormData = {
  name: '',
  email: '',
  phone: '',
  contactPerson: '',
  address: '',
  notes: '',
}

// Category mapping based on supplier name patterns (simulated)
const SUPPLIER_CATEGORIES: Record<string, string[]> = {
  'МебельМастер': ['ДСП/МДФ', 'Фурнитура', 'Кромка'],
  'МетизГрупп': ['Фурнитура', 'Метизы', 'Комплектующие'],
  'ТканиСервис': ['Ткани', 'Поролон', 'Наполнитель'],
  'ЛескоПром': ['ДСП/МДФ', 'Фанера', 'Пиломатериалы'],
  'ФурнитураПлюс': ['Фурнитура', 'Механизмы', 'Комплектующие'],
}

// City extraction from address
function extractCity(address: string): string {
  if (!address) return 'Не указан'
  const cityMatch = address.match(/(?:г\.|город|с\.|село)\s*([А-ЯЁа-яё\-]+)/i)
  if (cityMatch) return cityMatch[1]
  const words = address.split(/[,\s]+/)
  if (words.length > 0) return words[0]
  return 'Не указан'
}

// Mock location coordinates based on city name
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'Москва': { lat: 55.75, lng: 37.62 },
  'Санкт-Петербург': { lat: 59.93, lng: 30.32 },
  'Тула': { lat: 54.19, lng: 37.62 },
  'Владимир': { lat: 56.14, lng: 40.40 },
  'Казань': { lat: 55.79, lng: 49.12 },
  'Нижний': { lat: 56.33, lng: 44.00 },
  'Екатеринбург': { lat: 56.84, lng: 60.61 },
  'Новосибирск': { lat: 55.03, lng: 82.92 },
}

// === API Functions ===
async function fetchSuppliers(search: string): Promise<Supplier[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  const res = await fetch(`/api/suppliers?${params.toString()}`)
  if (!res.ok) throw new Error('Ошибка загрузки поставщиков')
  return res.json()
}

async function createSupplier(data: SupplierFormData): Promise<Supplier> {
  const res = await fetch('/api/suppliers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Ошибка создания поставщика')
  }
  return res.json()
}

async function updateSupplier({ id, data }: { id: string; data: Partial<SupplierFormData> }): Promise<Supplier> {
  const res = await fetch(`/api/suppliers/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Ошибка обновления поставщика')
  }
  return res.json()
}

async function deleteSupplier(id: string): Promise<void> {
  const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Ошибка удаления поставщика')
  }
}

// === Sub-components ===

function SupplierFormFields({
  form,
  onChange,
}: {
  form: SupplierFormData
  onChange: (field: keyof SupplierFormData, value: string) => void
}) {
  return (
    <div className="grid gap-4 py-2">
      <div className="grid gap-2">
        <Label htmlFor="name">
          Название <span className="text-destructive">*</span>
        </Label>
        <Input
          id="name"
          placeholder="Название компании"
          value={form.name}
          onChange={(e) => onChange('name', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="email@example.com"
            value={form.email}
            onChange={(e) => onChange('email', e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">Телефон</Label>
          <Input
            id="phone"
            placeholder="+7 (___) ___-__-__"
            value={form.phone}
            onChange={(e) => onChange('phone', e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="contactPerson">Контактное лицо</Label>
        <Input
          id="contactPerson"
          placeholder="ФИО контактного лица"
          value={form.contactPerson}
          onChange={(e) => onChange('contactPerson', e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="address">Адрес</Label>
        <Input
          id="address"
          placeholder="Юридический/фактический адрес"
          value={form.address}
          onChange={(e) => onChange('address', e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="notes">Примечания</Label>
        <Textarea
          id="notes"
          placeholder="Дополнительная информация"
          value={form.notes}
          onChange={(e) => onChange('notes', e.target.value)}
          rows={3}
        />
      </div>
    </div>
  )
}

function SupplierCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 w-full">
        <Skeleton className="h-full w-full" />
      </div>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <Skeleton className="h-11 w-11 rounded-full shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <div className="flex justify-between pt-2 border-t border-dashed">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StarRating({ score, size = 'sm' }: { score: number; size?: 'sm' | 'md' }) {
  const starSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${starSize} transition-all duration-200 ${
            star <= Math.round(score)
              ? 'fill-amber-400 text-amber-400'
              : star <= score
                ? 'fill-amber-200 text-amber-300'
                : 'text-muted-foreground/20'
          }`}
        />
      ))}
      <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 ml-1">{score.toFixed(1)}</span>
    </div>
  )
}

function LocationIndicator({ address }: { address: string }) {
  const city = extractCity(address)
  const coords = CITY_COORDS[city]
  const hasLocation = !!coords

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-help">
          <div className="relative">
            <Globe className="h-3.5 w-3.5" />
            {hasLocation && (
              <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-emerald-500" />
            )}
          </div>
          <span className="truncate max-w-[120px]">{city}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="font-medium text-xs">{city}</p>
        {hasLocation && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {coords.lat.toFixed(2)}°N, {coords.lng.toFixed(2)}°E
          </p>
        )}
        {address && (
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[200px]">{address}</p>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

function TopSuppliersLeaderboard({
  suppliers,
  analyticsMap,
  onClickSupplier,
}: {
  suppliers: Supplier[]
  analyticsMap: Map<string, SupplierAnalytics>
  onClickSupplier: (id: string) => void
}) {
  const ranked = useMemo(() => {
    return suppliers
      .map((s) => {
        const analytics = analyticsMap.get(s.id)
        if (!analytics) return null
        const rating = calculateSupplierRating({
          totalItems: analytics.totalItems,
          totalSpent: analytics.totalSpent,
          avgDeliveryDays: analytics.avgDeliveryDays,
          completionRate: analytics.completionRate,
          requestCount: 0,
        })
        return { supplier: s, analytics, rating }
      })
      .filter(Boolean)
      .sort((a, b) => (b?.rating.score ?? 0) - (a?.rating.score ?? 0))
      .slice(0, 3) as { supplier: Supplier; analytics: SupplierAnalytics; rating: ReturnType<typeof calculateSupplierRating> }[]
  }, [suppliers, analyticsMap])

  if (ranked.length === 0) return null

  const medals = [
    { emoji: '🥇', bg: 'from-amber-400/10 to-amber-500/5 border-amber-400/30', text: 'text-amber-600 dark:text-amber-400' },
    { emoji: '🥈', bg: 'from-slate-300/10 to-slate-400/5 border-slate-400/30', text: 'text-slate-600 dark:text-slate-400' },
    { emoji: '🥉', bg: 'from-orange-400/10 to-orange-500/5 border-orange-400/30', text: 'text-orange-600 dark:text-orange-400' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="border-dashed bg-gradient-to-r from-amber-50/50 via-transparent to-amber-50/30 dark:from-amber-950/10 dark:to-amber-950/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base">Лучшие поставщики</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Топ-3 по рейтингу надёжности и скорости доставки
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {ranked.map((item, idx) => {
              const medal = medals[idx] ?? medals[2]
              const reliabilityConfig = RELIABILITY_CONFIG[item.rating.reliability]
              const deliveryConfig = DELIVERY_SPEED_CONFIG[item.rating.deliverySpeed]
              return (
                <motion.div
                  key={item.supplier.id}
                  initial={{ opacity: 0, x: idx * 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + idx * 0.1 }}
                  onClick={() => onClickSupplier(item.supplier.id)}
                  className={`relative cursor-pointer rounded-xl border bg-gradient-to-br ${medal.bg} p-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{medal.emoji}</span>
                    <span className={`font-semibold text-sm truncate ${medal.text}`}>
                      {item.supplier.name}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <StarRating score={item.rating.score} size="sm" />
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${reliabilityConfig.className}`}>
                        {reliabilityConfig.label}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${deliveryConfig.className}`}>
                        {deliveryConfig.label}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{item.analytics.totalItems} поз.</span>
                      <span>{item.analytics.totalSpent > 0 ? `${(item.analytics.totalSpent / 1000).toFixed(0)}к ₽` : '—'}</span>
                    </div>
                  </div>
                  <ArrowRight className="absolute top-3 right-3 h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function CategoryFilter({
  categories,
  selected,
  onSelect,
}: {
  categories: string[]
  selected: string | null
  onSelect: (cat: string | null) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onSelect(null)}
        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 border ${
          selected === null
            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
            : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:border-border'
        }`}
      >
        Все
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(selected === cat ? null : cat)}
          className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-200 border ${
            selected === cat
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:border-border'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}

function SupplierCard({
  supplier,
  analytics,
  onEdit,
  onDelete,
  onClick,
}: {
  supplier: Supplier
  analytics: SupplierAnalytics | null
  onEdit: (supplier: Supplier) => void
  onDelete: (supplier: Supplier) => void
  onClick: () => void
}) {
  const projectCount = supplier._count?.projectItems ?? 0

  // Calculate rating from analytics
  const rating = analytics
    ? calculateSupplierRating({
        totalItems: analytics.totalItems,
        totalSpent: analytics.totalSpent,
        avgDeliveryDays: analytics.avgDeliveryDays,
        completionRate: analytics.completionRate,
        requestCount: 0,
      })
    : null

  // Get categories for this supplier
  const categories = SUPPLIER_CATEGORIES[supplier.name] ?? ['Общее']

  // Activity dot color based on reliability
  const dotColor = rating
    ? RELIABILITY_CONFIG[rating.reliability].dotColor
    : projectCount > 0
      ? 'bg-amber-400'
      : 'bg-muted-foreground/30'

  // Status bar gradient color at top
  const statusBarGradient = rating
    ? rating.reliability === 'excellent'
      ? 'from-emerald-400 to-emerald-600'
      : rating.reliability === 'good'
        ? 'from-amber-400 to-amber-600'
        : 'from-red-400 to-red-600'
    : projectCount > 0
      ? 'from-sky-400 to-sky-600'
      : 'from-muted-foreground/30 to-muted-foreground/50'

  // Last activity
  const lastActivity = new Date(supplier.updatedAt)
  const daysSinceActivity = Math.floor((Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24))
  const activityText = daysSinceActivity === 0
    ? 'Сегодня'
    : daysSinceActivity === 1
      ? 'Вчера'
      : `${daysSinceActivity} дн. назад`

  // Completion rate bar
  const completionRate = analytics?.completionRate ?? 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer" onClick={onClick}>
        {/* Gradient border bar at top */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r ${statusBarGradient}`} />

        {/* Gradient border glow on hover */}
        <div className={`absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none`} style={{
          boxShadow: rating?.reliability === 'excellent'
            ? '0 0 15px rgba(16,185,129,0.1)'
            : rating?.reliability === 'good'
              ? '0 0 15px rgba(245,158,11,0.1)'
              : '0 0 15px rgba(14,165,233,0.1)',
        }} />

        {/* Subtle gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-sky-50/30 via-transparent to-sky-100/10 dark:from-sky-950/20 dark:via-transparent dark:to-sky-950/10 pointer-events-none" />

        <CardHeader className="pb-3 relative">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500/15 to-primary/10 text-sky-600 dark:text-sky-400">
                <Building2 className="h-6 w-6" />
                <span className={`absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background ${dotColor}`} />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base truncate" title={supplier.name}>
                  {supplier.name}
                </CardTitle>
                {supplier.contactPerson && (
                  <CardDescription className="truncate">
                    {supplier.contactPerson}
                  </CardDescription>
                )}
              </div>
            </div>
            <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-0 translate-x-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(supplier)
                    }}
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
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(supplier)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Удалить</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 relative">
          {/* Contact info with quick-actions */}
          {supplier.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground group/line">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate flex-1" title={supplier.email}>{supplier.email}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover/line:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(`mailto:${supplier.email}`, '_blank')
                    }}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Написать email</TooltipContent>
              </Tooltip>
            </div>
          )}
          {supplier.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground group/line">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate flex-1">{supplier.phone}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover/line:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(`tel:${supplier.phone}`, '_blank')
                    }}
                  >
                    <PhoneCall className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Позвонить</TooltipContent>
              </Tooltip>
            </div>
          )}
          {supplier.address && (
            <LocationIndicator address={supplier.address} />
          )}
          {supplier.notes && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <StickyNote className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span className="line-clamp-2">{supplier.notes}</span>
            </div>
          )}

          {/* Categories */}
          <div className="flex flex-wrap gap-1">
            {categories.slice(0, 3).map((cat) => (
              <span
                key={cat}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400 border border-sky-200/50 dark:border-sky-800/50"
              >
                {cat}
              </span>
            ))}
            {categories.length > 3 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] text-muted-foreground">
                +{categories.length - 3}
              </span>
            )}
          </div>

          {/* Completion rate bar */}
          {analytics && completionRate > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Исполнение заказов</span>
                <span className="font-medium">{completionRate.toFixed(0)}%</span>
              </div>
              <Progress
                value={completionRate}
                className="h-1.5"
              />
            </div>
          )}

          {/* Bottom row: stats + rating + spent + last activity */}
          <div className="flex items-center justify-between pt-2 border-t border-dashed">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400 border-sky-200 dark:border-sky-800 text-[11px]">
                <Package className="h-3 w-3" />
                {projectCount} {pluralize(projectCount, 'поз.', 'поз.', 'поз.')}
              </Badge>
              {analytics && analytics.totalSpent > 0 && (
                <Badge variant="secondary" className="gap-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-[11px]">
                  <DollarSign className="h-3 w-3" />
                  {analytics.totalSpent >= 1000
                    ? `${(analytics.totalSpent / 1000).toFixed(0)}к`
                    : analytics.totalSpent.toFixed(0)} ₽
                </Badge>
              )}
            </div>
            {rating ? (
              <StarRating score={rating.score} size="sm" />
            ) : null}
          </div>

          {/* Last activity */}
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
            <Calendar className="h-3 w-3" />
            <span>Обновлено: {activityText}</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// === Utility ===
function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return many
  if (last > 1 && last < 5) return few
  if (last === 1) return one
  return many
}

function formatMoney(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}М ₽`
  if (n >= 1000) return `${(n / 1000).toFixed(0)}к ₽`
  return `${n.toFixed(0)} ₽`
}

// === Main Component ===
export function Suppliers() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { navigateToSupplier } = useAppStore()

  // State
  const [search, setSearch] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null)
  const [form, setForm] = useState<SupplierFormData>(emptyForm)
  const [formError, setFormError] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  // Queries
  const {
    data: suppliers = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['suppliers', search],
    queryFn: () => fetchSuppliers(search),
  })

  // Analytics query for performance indicators
  const { data: analyticsData = [], isLoading: analyticsLoading } = useQuery<SupplierAnalytics[]>({
    queryKey: ['analytics-suppliers'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/suppliers')
      if (!res.ok) throw new Error('Ошибка загрузки аналитики')
      return res.json()
    },
  })

  // Map analytics by supplier id for quick lookup
  const analyticsMap = useMemo(() => {
    const map = new Map<string, SupplierAnalytics>()
    for (const a of analyticsData) {
      map.set(a.id, a)
    }
    return map
  }, [analyticsData])

  // All unique categories across suppliers
  const allCategories = useMemo(() => {
    const cats = new Set<string>()
    for (const s of suppliers) {
      const sCats = SUPPLIER_CATEGORIES[s.name] ?? ['Общее']
      for (const c of sCats) cats.add(c)
    }
    return Array.from(cats).sort()
  }, [suppliers])

  // Filter suppliers by category
  const filteredSuppliers = useMemo(() => {
    if (!categoryFilter) return suppliers
    return suppliers.filter((s) => {
      const sCats = SUPPLIER_CATEGORIES[s.name] ?? ['Общее']
      return sCats.includes(categoryFilter)
    })
  }, [suppliers, categoryFilter])

  // Mutations
  const createMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast({ title: 'Поставщик создан', description: 'Новый поставщик успешно добавлен' })
      closeAddDialog()
    },
    onError: (error: Error) => {
      setFormError(error.message)
    },
  })

  const updateMutation = useMutation({
    mutationFn: updateSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast({ title: 'Поставщик обновлён', description: 'Данные поставщика сохранены' })
      closeEditDialog()
    },
    onError: (error: Error) => {
      setFormError(error.message)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      toast({ title: 'Поставщик удалён', description: 'Поставщик успешно удалён' })
      setDeleteOpen(false)
      setSelectedSupplier(null)
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' })
    },
  })

  // Handlers
  const handleFormChange = useCallback((field: keyof SupplierFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setFormError('')
  }, [])

  const openAddDialog = useCallback(() => {
    setForm(emptyForm)
    setFormError('')
    setAddOpen(true)
  }, [])

  const closeAddDialog = useCallback(() => {
    setAddOpen(false)
    setForm(emptyForm)
    setFormError('')
  }, [])

  const openEditDialog = useCallback((supplier: Supplier) => {
    setForm({
      name: supplier.name,
      email: supplier.email,
      phone: supplier.phone,
      contactPerson: supplier.contactPerson,
      address: supplier.address,
      notes: supplier.notes,
    })
    setFormError('')
    setSelectedSupplier(supplier)
    setEditOpen(true)
  }, [])

  const closeEditDialog = useCallback(() => {
    setEditOpen(false)
    setSelectedSupplier(null)
    setForm(emptyForm)
    setFormError('')
  }, [])

  const openDeleteDialog = useCallback((supplier: Supplier) => {
    setSelectedSupplier(supplier)
    setDeleteOpen(true)
  }, [])

  const handleAddSubmit = useCallback(() => {
    if (!form.name.trim()) {
      setFormError('Название поставщика обязательно')
      return
    }
    createMutation.mutate(form)
  }, [form, createMutation])

  const handleEditSubmit = useCallback(() => {
    if (!selectedSupplier) return
    if (!form.name.trim()) {
      setFormError('Название поставщика обязательно')
      return
    }
    updateMutation.mutate({ id: selectedSupplier.id, data: form })
  }, [form, selectedSupplier, updateMutation])

  const handleDeleteConfirm = useCallback(() => {
    if (!selectedSupplier) return
    deleteMutation.mutate(selectedSupplier.id)
  }, [selectedSupplier, deleteMutation])

  // ── Supplier Stats ──────────────────────────────────────────

  const supplierStats = useMemo(() => {
    const total = suppliers.length
    const activeOrders = suppliers.filter((s) => (s._count?.projectItems ?? 0) > 0).length
    const avgRating = analyticsData.length > 0
      ? analyticsData.reduce((sum, a) => {
          const r = calculateSupplierRating({
            totalItems: a.totalItems,
            totalSpent: a.totalSpent,
            avgDeliveryDays: a.avgDeliveryDays,
            completionRate: a.completionRate,
            requestCount: 0,
          })
          return sum + r.score
        }, 0) / analyticsData.length
      : 0
    const totalSpent = analyticsData.reduce((sum, a) => sum + a.totalSpent, 0)
    const now = new Date()
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
    const newThisMonth = suppliers.filter((s) => new Date(s.createdAt) >= oneMonthAgo).length
    return { total, activeOrders, avgRating: Math.round(avgRating * 10) / 10, totalSpent, newThisMonth }
  }, [suppliers, analyticsData])

  // Render
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative -mx-6 -mt-6 px-6 pt-6 pb-5 bg-gradient-to-b from-sky-500/5 via-sky-500/[0.02] to-transparent">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm">
              База поставщиков и контактов
            </p>
          </div>
          <Button onClick={openAddDialog} className="gap-2 shrink-0 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.02]">
            <Plus className="h-4 w-4" />
            Добавить поставщика
          </Button>
        </div>
      </div>

      {/* Supplier Stats Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="relative overflow-hidden border-l-[3px] border-l-sky-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/10">
                  <Building2 className="h-4.5 w-4.5 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{supplierStats.total}</p>
                  <p className="text-xs text-muted-foreground">Всего поставщиков</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="relative overflow-hidden border-l-[3px] border-l-emerald-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
                  <ShoppingCart className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{supplierStats.activeOrders}</p>
                  <p className="text-xs text-muted-foreground">С заказами</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="relative overflow-hidden border-l-[3px] border-l-amber-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-500/10">
                  <Star className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{supplierStats.avgRating || '—'}</p>
                  <p className="text-xs text-muted-foreground">Средний рейтинг</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}>
          <Card className="relative overflow-hidden border-l-[3px] border-l-rose-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/10">
                  <DollarSign className="h-4.5 w-4.5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatMoney(supplierStats.totalSpent)}</p>
                  <p className="text-xs text-muted-foreground">Всего потрачено</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="relative overflow-hidden border-l-[3px] border-l-violet-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/10">
                  <TrendingUp className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{supplierStats.newThisMonth}</p>
                  <p className="text-xs text-muted-foreground">Новых за месяц</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Top Suppliers Leaderboard */}
      {!analyticsLoading && analyticsData.length > 0 && (
        <TopSuppliersLeaderboard
          suppliers={suppliers}
          analyticsMap={analyticsMap}
          onClickSupplier={navigateToSupplier}
        />
      )}

      {/* Search + Category Filter */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по названию, email, телефону..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 transition-shadow duration-200 focus:shadow-md focus:shadow-primary/5"
            />
          </div>
          {allCategories.length > 1 && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <CategoryFilter
                categories={allCategories}
                selected={categoryFilter}
                onSelect={setCategoryFilter}
              />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SupplierCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Ошибка загрузки</h3>
            <p className="text-muted-foreground mt-1">
              Не удалось загрузить список поставщиков. Попробуйте обновить страницу.
            </p>
          </CardContent>
        </Card>
      ) : filteredSuppliers.length === 0 ? (
        <EmptyState
          type={search || categoryFilter ? 'search' : 'suppliers'}
          action={
            !search && !categoryFilter
              ? {
                  label: 'Добавить поставщика',
                  onClick: openAddDialog,
                  icon: PlusCircle,
                }
              : undefined
          }
        />
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuppliers.map((supplier) => (
              <SupplierCard
                key={supplier.id}
                supplier={supplier}
                analytics={analyticsMap.get(supplier.id) ?? null}
                onEdit={openEditDialog}
                onDelete={openDeleteDialog}
                onClick={() => navigateToSupplier(supplier.id)}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Add Dialog */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) closeAddDialog() }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Добавить поставщика</DialogTitle>
            <DialogDescription>
              Заполните данные нового поставщика
            </DialogDescription>
          </DialogHeader>
          {formError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {formError}
            </div>
          )}
          <SupplierFormFields form={form} onChange={handleFormChange} />
          <DialogFooter>
            <Button variant="outline" onClick={closeAddDialog} disabled={createMutation.isPending}>
              Отмена
            </Button>
            <Button type="button" onClick={handleAddSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Создание...' : 'Создать'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(open) => { if (!open) closeEditDialog() }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Редактировать поставщика</DialogTitle>
            <DialogDescription>
              Измените данные поставщика
            </DialogDescription>
          </DialogHeader>
          {formError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
              {formError}
            </div>
          )}
          <SupplierFormFields form={form} onChange={handleFormChange} />
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog} disabled={updateMutation.isPending}>
              Отмена
            </Button>
            <Button type="button" onClick={handleEditSubmit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить поставщика?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить поставщика{' '}
              <strong>{selectedSupplier?.name}</strong>?
              {(selectedSupplier?._count?.projectItems ?? 0) > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  У этого поставщика есть привязанные позиции проектов. Сначала удалите их.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending || (selectedSupplier?._count?.projectItems ?? 0) > 0}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
