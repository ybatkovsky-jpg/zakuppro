'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  FolderKanban,
  Building2,
  Mail,
  FileText,
  Warehouse,
  Package,
  ShoppingCart,
  Receipt,
  Search,
  ClipboardList,
  type LucideIcon,
} from 'lucide-react'

// ── SVG Illustration Components ──────────────────────────────

function EmptyBoxIllustration({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="50" y="40" width="100" height="80" rx="8" className="fill-muted stroke-muted-foreground/20" strokeWidth="2" />
      <path d="M50 60 L100 40 L150 60" className="stroke-muted-foreground/30" strokeWidth="2" fill="none" />
      <path d="M100 40 L100 120" className="stroke-muted-foreground/20" strokeWidth="1.5" strokeDasharray="4 4" />
      <rect x="70" y="70" width="60" height="8" rx="4" className="fill-muted-foreground/15" />
      <rect x="70" y="86" width="40" height="8" rx="4" className="fill-muted-foreground/10" />
      <rect x="70" y="102" width="50" height="8" rx="4" className="fill-muted-foreground/10" />
      <circle cx="160" cy="30" r="15" className="fill-primary/10" />
      <path d="M155 30 L160 25 L165 30 L160 35 Z" className="fill-primary/20" />
    </svg>
  )
}

function EmptyWarehouseIllustration({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M40 80 L100 40 L160 80" className="stroke-muted-foreground/25" strokeWidth="2" fill="none" />
      <rect x="50" y="80" width="100" height="50" className="fill-muted stroke-muted-foreground/20" strokeWidth="2" rx="2" />
      <rect x="60" y="90" width="25" height="25" rx="3" className="fill-muted-foreground/10 stroke-muted-foreground/20" strokeWidth="1" />
      <rect x="95" y="90" width="25" height="25" rx="3" className="fill-muted-foreground/10 stroke-muted-foreground/20" strokeWidth="1" />
      <rect x="60" y="95" width="25" height="5" rx="2" className="fill-muted-foreground/8" />
      <rect x="95" y="95" width="25" height="5" rx="2" className="fill-muted-foreground/8" />
      <circle cx="35" cy="50" r="8" className="fill-amber-200/50" />
      <circle cx="165" cy="50" r="6" className="fill-emerald-200/50" />
    </svg>
  )
}

function EmptyMailIllustration({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="40" y="45" width="120" height="80" rx="8" className="fill-muted stroke-muted-foreground/20" strokeWidth="2" />
      <path d="M40 55 L100 90 L160 55" className="stroke-muted-foreground/30" strokeWidth="2" fill="none" />
      <circle cx="90" cy="30" r="12" className="fill-violet-100 dark:fill-violet-900/30" />
      <path d="M86 30 L90 26 L94 30 L90 34 Z" className="fill-violet-300 dark:fill-violet-600" />
      <circle cx="150" cy="35" r="8" className="fill-sky-100 dark:fill-sky-900/30" />
      <circle cx="150" cy="35" r="3" className="fill-sky-300 dark:fill-sky-600" />
    </svg>
  )
}

function EmptyInvoiceIllustration({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="55" y="25" width="90" height="120" rx="6" className="fill-muted stroke-muted-foreground/20" strokeWidth="2" />
      <rect x="70" y="40" width="50" height="6" rx="3" className="fill-muted-foreground/15" />
      <rect x="70" y="55" width="60" height="4" rx="2" className="fill-muted-foreground/10" />
      <rect x="70" y="65" width="55" height="4" rx="2" className="fill-muted-foreground/10" />
      <line x1="65" y1="80" x2="135" y2="80" className="stroke-muted-foreground/15" strokeWidth="1" strokeDasharray="3 3" />
      <rect x="70" y="90" width="40" height="4" rx="2" className="fill-muted-foreground/10" />
      <rect x="70" y="100" width="50" height="4" rx="2" className="fill-muted-foreground/10" />
      <circle cx="140" cy="120" r="10" className="fill-emerald-100 dark:fill-emerald-900/30" />
      <path d="M136 120 L139 123 L144 117" className="stroke-emerald-500" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function EmptySupplierIllustration({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="55" y="50" width="90" height="70" rx="8" className="fill-muted stroke-muted-foreground/20" strokeWidth="2" />
      <rect x="65" y="60" width="30" height="4" rx="2" className="fill-muted-foreground/15" />
      <rect x="65" y="70" width="50" height="3" rx="1.5" className="fill-muted-foreground/10" />
      <rect x="65" y="78" width="45" height="3" rx="1.5" className="fill-muted-foreground/10" />
      <rect x="65" y="90" width="20" height="20" rx="4" className="fill-sky-100 dark:fill-sky-900/30 stroke-sky-300 dark:stroke-sky-700" strokeWidth="1" />
      <circle cx="75" cy="97" r="4" className="fill-sky-300 dark:fill-sky-600" />
      <circle cx="130" cy="35" r="12" className="fill-amber-100 dark:fill-amber-900/30" />
      <path d="M126 33 L130 29 L134 33 L130 37 Z" className="fill-amber-300 dark:fill-amber-600" />
    </svg>
  )
}

function EmptySearchIllustration({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="85" cy="75" r="35" className="fill-muted stroke-muted-foreground/20" strokeWidth="2" />
      <line x1="110" y1="100" x2="145" y2="135" className="stroke-muted-foreground/30" strokeWidth="6" strokeLinecap="round" />
      <rect x="65" y="65" width="30" height="4" rx="2" className="fill-muted-foreground/15" />
      <rect x="65" y="75" width="20" height="4" rx="2" className="fill-muted-foreground/10" />
    </svg>
  )
}

function EmptyClipboardIllustration({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="55" y="30" width="90" height="115" rx="8" className="fill-muted stroke-muted-foreground/20" strokeWidth="2" />
      <rect x="75" y="22" width="50" height="16" rx="4" className="fill-muted-foreground/15 stroke-muted-foreground/20" strokeWidth="1.5" />
      <circle cx="100" cy="30" r="3" className="fill-muted-foreground/30" />
      <rect x="70" y="55" width="50" height="4" rx="2" className="fill-muted-foreground/12" />
      <rect x="70" y="67" width="60" height="4" rx="2" className="fill-muted-foreground/10" />
      <rect x="70" y="79" width="40" height="4" rx="2" className="fill-muted-foreground/10" />
      <rect x="70" y="91" width="55" height="4" rx="2" className="fill-muted-foreground/10" />
      <rect x="70" y="103" width="45" height="4" rx="2" className="fill-muted-foreground/10" />
      <circle cx="70" cy="57" r="2" className="fill-emerald-400/50" />
      <circle cx="70" cy="69" r="2" className="fill-emerald-400/50" />
      <circle cx="70" cy="81" r="2" className="fill-muted-foreground/20" />
      <circle cx="70" cy="93" r="2" className="fill-muted-foreground/20" />
    </svg>
  )
}

// ── Empty State Types ────────────────────────────────────────

export type EmptyStateType =
  | 'projects'
  | 'suppliers'
  | 'requests'
  | 'invoices'
  | 'warehouse'
  | 'items'
  | 'search'
  | 'history'

interface EmptyStateConfig {
  illustration: LucideIcon | null
  svgIllustration: React.ComponentType<{ className?: string }>
  title: string
  description: string
  accentColor: string
}

const EMPTY_STATE_CONFIGS: Record<EmptyStateType, EmptyStateConfig> = {
  projects: {
    illustration: FolderKanban,
    svgIllustration: EmptyBoxIllustration,
    title: 'Нет проектов',
    description: 'Создайте новый проект или загрузите позиции из Excel файла',
    accentColor: 'text-primary',
  },
  suppliers: {
    illustration: Building2,
    svgIllustration: EmptySupplierIllustration,
    title: 'Нет поставщиков',
    description: 'Добавьте первого поставщика для начала работы с запросами',
    accentColor: 'text-sky-600',
  },
  requests: {
    illustration: Mail,
    svgIllustration: EmptyMailIllustration,
    title: 'Запросы не найдены',
    description: 'Создайте первый запрос поставщику для получения цен и условий',
    accentColor: 'text-violet-600',
  },
  invoices: {
    illustration: Receipt,
    svgIllustration: EmptyInvoiceIllustration,
    title: 'Счета не найдены',
    description: 'Счета от поставщиков появятся здесь после их создания',
    accentColor: 'text-amber-600',
  },
  warehouse: {
    illustration: Warehouse,
    svgIllustration: EmptyWarehouseIllustration,
    title: 'Склад пуст',
    description: 'Добавьте первую позицию на склад для учёта запасов',
    accentColor: 'text-teal-600',
  },
  items: {
    illustration: Package,
    svgIllustration: EmptyClipboardIllustration,
    title: 'Нет позиций',
    description: 'Позиции появятся здесь после загрузки Excel или ручного добавления',
    accentColor: 'text-primary',
  },
  search: {
    illustration: Search,
    svgIllustration: EmptySearchIllustration,
    title: 'Ничего не найдено',
    description: 'Попробуйте изменить параметры поиска или сбросить фильтры',
    accentColor: 'text-muted-foreground',
  },
  history: {
    illustration: ClipboardList,
    svgIllustration: EmptyClipboardIllustration,
    title: 'История пуста',
    description: 'Изменения статуса проекта будут отображаться здесь',
    accentColor: 'text-muted-foreground',
  },
}

// ── Empty State Component ────────────────────────────────────

interface EmptyStateProps {
  type: EmptyStateType
  title?: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    icon?: LucideIcon
  }
  className?: string
}

export function EmptyState({
  type,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const config = EMPTY_STATE_CONFIGS[type]
  const SvgIllustration = config.svgIllustration
  const IconComponent = config.illustration

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className ?? ''}`}
    >
      {/* SVG Illustration */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
        className="mb-6"
      >
        <SvgIllustration className="w-48 h-36" />
      </motion.div>

      {/* Icon fallback (smaller, overlaid) */}
      <div className="relative -mt-4 mb-4">
        <div className={`flex size-12 items-center justify-center rounded-2xl bg-muted/80 ${config.accentColor}`}>
          <IconComponent className="size-6" />
        </div>
      </div>

      {/* Text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="text-lg font-semibold mb-1.5">
          {title ?? config.title}
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
          {description ?? config.description}
        </p>
      </motion.div>

      {/* Action Button */}
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6"
        >
          <Button
            onClick={action.onClick}
            className="gap-2 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.02]"
          >
            {action.icon && <action.icon className="size-4" />}
            {action.label}
          </Button>
        </motion.div>
      )}
    </motion.div>
  )
}

// ── Compact Empty State (for inline use) ─────────────────────

interface CompactEmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  className?: string
}

export function CompactEmptyState({
  icon: Icon,
  title,
  description,
  className,
}: CompactEmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-8 text-center ${className ?? ''}`}>
      <div className="flex size-10 items-center justify-center rounded-xl bg-muted mb-3">
        <Icon className="size-5 text-muted-foreground/60" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground/70 mt-1 max-w-xs">{description}</p>
      )}
    </div>
  )
}
