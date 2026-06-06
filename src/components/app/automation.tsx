'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Zap,
  FilePlus,
  ArrowRightCircle,
  Warehouse,
  AlertTriangle,
  FileCheck,
  Play,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Upload,
  Group,
  Send,
  FileText,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { authFetch } from '@/lib/auth-fetch'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

// ── Types ──────────────────────────────────────────────────────────────────

interface AutomationRuleData {
  id: string
  name: string
  type: string
  enabled: boolean
  config: string
  lastRunAt: string | null
  runCount: number
  createdAt: string
  updatedAt: string
}

interface RuleDefinition {
  type: string
  name: string
  description: string
  icon: string
  color: string
}

interface AutomationResponse {
  rules: AutomationRuleData[]
  definitions: RuleDefinition[]
}

// ── Constants ──────────────────────────────────────────────────────────────

const RULE_ICON_MAP: Record<string, React.ElementType> = {
  auto_create_requests: FilePlus,
  auto_status_transition: ArrowRightCircle,
  auto_warehouse_check: Warehouse,
  low_stock_alert: AlertTriangle,
  invoice_auto_reconcile: FileCheck,
}

const RULE_COLOR_MAP: Record<string, { border: string; bg: string; icon: string; badge: string; glow: string }> = {
  auto_create_requests: {
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-500/10',
    icon: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    glow: 'shadow-emerald-500/10',
  },
  auto_status_transition: {
    border: 'border-l-sky-500',
    bg: 'bg-sky-500/10',
    icon: 'text-sky-600 dark:text-sky-400',
    badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    glow: 'shadow-sky-500/10',
  },
  auto_warehouse_check: {
    border: 'border-l-amber-500',
    bg: 'bg-amber-500/10',
    icon: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    glow: 'shadow-amber-500/10',
  },
  low_stock_alert: {
    border: 'border-l-red-500',
    bg: 'bg-red-500/10',
    icon: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-500/15 text-red-600 dark:text-red-400',
    glow: 'shadow-red-500/10',
  },
  invoice_auto_reconcile: {
    border: 'border-l-violet-500',
    bg: 'bg-violet-500/10',
    icon: 'text-violet-600 dark:text-violet-400',
    badge: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
    glow: 'shadow-violet-500/10',
  },
}

const WORKFLOW_STEPS = [
  { label: 'Загрузка Excel', icon: Upload, color: 'text-emerald-500' },
  { label: 'Группировка по поставщикам', icon: Group, color: 'text-sky-500' },
  { label: 'Создание запросов', icon: FilePlus, color: 'text-violet-500' },
  { label: 'Отправка писем', icon: Send, color: 'text-amber-500' },
  { label: 'Сверка счетов', icon: FileText, color: 'text-red-500' },
  { label: 'Обновление статуса', icon: RefreshCw, color: 'text-teal-500' },
]

// ── Helpers ────────────────────────────────────────────────────────────────

function formatLastRun(dateStr: string | null): string {
  if (!dateStr) return 'Никогда'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return 'Только что'
  if (diffMin < 60) return `${diffMin} мин. назад`
  if (diffHours < 24) return `${diffHours} ч. назад`
  if (diffDays < 7) return `${diffDays} дн. назад`
  return date.toLocaleDateString('ru-RU')
}

function getDefinitionForType(type: string, definitions: RuleDefinition[]): RuleDefinition | undefined {
  return definitions.find(d => d.type === type)
}

// ── Sub-components ─────────────────────────────────────────────────────────

function QuickStats({ rules }: { rules: AutomationRuleData[] }) {
  const activeCount = rules.filter(r => r.enabled).length
  const todayExecutions = rules.reduce((sum, r) => sum + r.runCount, 0)
  const lastRunTimes = rules.filter(r => r.lastRunAt).map(r => new Date(r.lastRunAt!)).filter(d => !isNaN(d.getTime()))
  const lastExecution = lastRunTimes.length > 0
    ? new Date(Math.max(...lastRunTimes.map(d => d.getTime())))
    : null

  const stats = [
    {
      label: 'Активных правил',
      value: activeCount,
      total: rules.length,
      icon: Zap,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'Всего выполнений',
      value: todayExecutions,
      total: null,
      icon: Activity,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10',
    },
    {
      label: 'Последний запуск',
      value: null,
      total: null,
      icon: Clock,
      color: 'text-sky-600 dark:text-sky-400',
      bgColor: 'bg-sky-500/10',
      textValue: lastExecution && !isNaN(lastExecution.getTime()) ? formatLastRun(lastExecution.toISOString()) : 'Никогда',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {stats.map((stat, idx) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
        >
          <Card className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">
                    {stat.textValue ?? (
                      <>
                        {stat.value}
                        {stat.total !== null && (
                          <span className="text-sm font-normal text-muted-foreground"> / {stat.total}</span>
                        )}
                      </>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

function WorkflowDiagram() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Процесс автоматизации закупок
          </CardTitle>
          <CardDescription>Последовательность автоматических действий</CardDescription>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {WORKFLOW_STEPS.map((step, idx) => (
              <div key={step.label} className="flex items-center shrink-0">
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + idx * 0.1 }}
                  className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors min-w-[100px]"
                >
                  <step.icon className={`h-5 w-5 ${step.color}`} />
                  <span className="text-[10px] text-center text-muted-foreground leading-tight">{step.label}</span>
                </motion.div>
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <div className="flex items-center shrink-0 mx-1">
                    <div className="h-[2px] w-6 rounded-full bg-muted relative overflow-hidden">
                      <div className="absolute inset-y-0 left-0 w-full animate-flow-line" />
                    </div>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0 -ml-0.5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

function RuleCard({
  rule,
  definition,
  onToggle,
  onRun,
  isRunning,
}: {
  rule: AutomationRuleData
  definition: RuleDefinition | undefined
  onToggle: (id: string, enabled: boolean) => void
  onRun: (id: string) => void
  isRunning: boolean
}) {
  const colors = RULE_COLOR_MAP[rule.type] || RULE_COLOR_MAP.auto_create_requests
  const IconComponent = RULE_ICON_MAP[rule.type] || Zap

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
      transition={{ duration: 0.2 }}
    >
      <Card className={`overflow-hidden border-l-4 ${colors.border} transition-shadow relative ${rule.enabled ? 'glow-primary' : ''}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${colors.bg}`}>
                <IconComponent className={`h-5 w-5 ${colors.icon}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-sm truncate">{rule.name}</h3>
                  {rule.enabled ? (
                    <Badge className={`${colors.badge} text-[10px] px-1.5 py-0`}>
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                        Активно
                      </span>
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      Отключено
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                  {definition?.description || 'Правило автоматизации'}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatLastRun(rule.lastRunAt)}
                  </span>
                  {rule.runCount > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                      {rule.runCount} запусков
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <Switch
                checked={rule.enabled}
                onCheckedChange={(checked) => onToggle(rule.id, checked)}
                aria-label={`${rule.enabled ? 'Отключить' : 'Включить'} ${rule.name}`}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRun(rule.id)}
                disabled={isRunning}
                className={`h-7 text-xs gap-1 ${rule.enabled && !isRunning ? 'animate-pulse-button' : ''}`}
              >
                {isRunning ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                Запустить сейчас
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────

export function Automation() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery<AutomationResponse>({
    queryKey: ['automation-rules'],
    queryFn: async () => {
      const res = await authFetch('/api/automation')
      if (!res.ok) throw new Error('Failed to fetch automation rules')
      return res.json()
    },
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const res = await authFetch('/api/automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled }),
      })
      if (!res.ok) throw new Error('Failed to toggle rule')
      return res.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] })
      toast.success(
        variables.enabled
          ? 'Правило включено'
          : 'Правило отключено',
        { description: variables.enabled ? 'Автоматическое правило теперь активно' : 'Автоматическое правило приостановлено' }
      )
    },
    onError: () => {
      toast.error('Ошибка', { description: 'Не удалось изменить состояние правила' })
    },
  })

  const executeMutation = useMutation({
    mutationFn: async ({ ruleId }: { ruleId: string }) => {
      const res = await authFetch('/api/automation/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleId }),
      })
      if (!res.ok) throw new Error('Failed to execute rule')
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] })
      toast.success('Правило выполнено', {
        description: data.result?.message || 'Автоматическое правило успешно выполнено',
      })
    },
    onError: () => {
      toast.error('Ошибка выполнения', { description: 'Не удалось выполнить правило' })
    },
  })

  const rules = data?.rules ?? []
  const definitions = data?.definitions ?? []

  // Merge definitions with rules to ensure all defined rules appear
  const mergedRules: AutomationRuleData[] = definitions.map(def => {
    const existing = rules.find(r => r.type === def.type)
    return existing || {
      id: `pending-${def.type}`,
      name: def.name,
      type: def.type,
      enabled: false,
      config: '{}',
      lastRunAt: null,
      runCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  })

  const runningRuleId = executeMutation.isPending ? (executeMutation.variables as { ruleId: string } | undefined)?.ruleId : null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Загрузка правил автоматизации...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
            <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Автоматизация</h1>
            <p className="text-sm text-muted-foreground">
              Настройте автоматические процессы для сокращения ручной работы
            </p>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <QuickStats rules={rules} />

      {/* Workflow Diagram */}
      <WorkflowDiagram />

      {/* Automation Rules Grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Правила автоматизации
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {mergedRules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              definition={getDefinitionForType(rule.type, definitions)}
              onToggle={(id, enabled) => toggleMutation.mutate({ id, enabled })}
              onRun={(id) => executeMutation.mutate({ ruleId: id })}
              isRunning={runningRuleId === rule.id}
            />
          ))}
        </div>
      </div>

      {/* Execution Results */}
      {executeMutation.data && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm mb-1">
                    {executeMutation.data.ruleName}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    {executeMutation.data.result?.message}
                  </p>
                  {executeMutation.data.result?.details?.length > 0 && (
                    <div className="text-xs text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
                      {executeMutation.data.result.details.map((detail: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-1.5">
                          <span className="text-emerald-500 shrink-0">•</span>
                          <span>{detail}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Выполнено: {new Date(executeMutation.data.executedAt).toLocaleString('ru-RU')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Help text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Как работает автоматизация</p>
                <p>
                  Включите нужные правила переключателем. Активные правила выполняются автоматически 
                  при наступлении соответствующих событий. Вы также можете запустить любое правило 
                  вручную с помощью кнопки &quot;Запустить сейчас&quot;.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
