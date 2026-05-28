'use client'

import { motion } from 'framer-motion'
import {
  FileText,
  Settings2,
  Send,
  Receipt,
  CreditCard,
  Truck,
  CheckCircle2,
  XCircle,
  Check,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// --- Types ---

interface StatusHistoryEntry {
  id: string
  status: string
  notes: string
  createdAt: string
}

interface TimelineProps {
  currentStatus: string
  statusHistory: StatusHistoryEntry[]
}

// --- Status step config ---

interface StatusStepConfig {
  key: string
  label: string
  icon: LucideIcon
  circleBg: string
  circleText: string
  circleBorder: string
  activeBg: string
  activeText: string
  activeBorder: string
  lineColor: string
}

const STATUS_STEPS: StatusStepConfig[] = [
  {
    key: 'new',
    label: 'Новый',
    icon: FileText,
    circleBg: 'bg-sky-100 dark:bg-sky-950/40',
    circleText: 'text-sky-600 dark:text-sky-400',
    circleBorder: 'border-sky-300 dark:border-sky-700',
    activeBg: 'bg-sky-500 dark:bg-sky-600',
    activeText: 'text-white',
    activeBorder: 'border-sky-500 dark:border-sky-600',
    lineColor: 'bg-sky-400',
  },
  {
    key: 'processing',
    label: 'В обработке',
    icon: Settings2,
    circleBg: 'bg-violet-100 dark:bg-violet-950/40',
    circleText: 'text-violet-600 dark:text-violet-400',
    circleBorder: 'border-violet-300 dark:border-violet-700',
    activeBg: 'bg-violet-500 dark:bg-violet-600',
    activeText: 'text-white',
    activeBorder: 'border-violet-500 dark:border-violet-600',
    lineColor: 'bg-violet-400',
  },
  {
    key: 'requested',
    label: 'Запрошено',
    icon: Send,
    circleBg: 'bg-blue-100 dark:bg-blue-950/40',
    circleText: 'text-blue-600 dark:text-blue-400',
    circleBorder: 'border-blue-300 dark:border-blue-700',
    activeBg: 'bg-blue-500 dark:bg-blue-600',
    activeText: 'text-white',
    activeBorder: 'border-blue-500 dark:border-blue-600',
    lineColor: 'bg-blue-400',
  },
  {
    key: 'invoiced',
    label: 'Счета',
    icon: Receipt,
    circleBg: 'bg-amber-100 dark:bg-amber-950/40',
    circleText: 'text-amber-600 dark:text-amber-400',
    circleBorder: 'border-amber-300 dark:border-amber-700',
    activeBg: 'bg-amber-500 dark:bg-amber-600',
    activeText: 'text-white',
    activeBorder: 'border-amber-500 dark:border-amber-600',
    lineColor: 'bg-amber-400',
  },
  {
    key: 'paid',
    label: 'Оплачено',
    icon: CreditCard,
    circleBg: 'bg-green-100 dark:bg-green-950/40',
    circleText: 'text-green-600 dark:text-green-400',
    circleBorder: 'border-green-300 dark:border-green-700',
    activeBg: 'bg-green-500 dark:bg-green-600',
    activeText: 'text-white',
    activeBorder: 'border-green-500 dark:border-green-600',
    lineColor: 'bg-green-400',
  },
  {
    key: 'delivered',
    label: 'Доставлено',
    icon: Truck,
    circleBg: 'bg-teal-100 dark:bg-teal-950/40',
    circleText: 'text-teal-600 dark:text-teal-400',
    circleBorder: 'border-teal-300 dark:border-teal-700',
    activeBg: 'bg-teal-500 dark:bg-teal-600',
    activeText: 'text-white',
    activeBorder: 'border-teal-500 dark:border-teal-600',
    lineColor: 'bg-teal-400',
  },
  {
    key: 'completed',
    label: 'Завершено',
    icon: CheckCircle2,
    circleBg: 'bg-emerald-100 dark:bg-emerald-950/40',
    circleText: 'text-emerald-600 dark:text-emerald-400',
    circleBorder: 'border-emerald-300 dark:border-emerald-700',
    activeBg: 'bg-emerald-500 dark:bg-emerald-600',
    activeText: 'text-white',
    activeBorder: 'border-emerald-500 dark:border-emerald-600',
    lineColor: 'bg-emerald-400',
  },
]

const CANCELLED_STEP: StatusStepConfig = {
  key: 'cancelled',
  label: 'Отменено',
  icon: XCircle,
  circleBg: 'bg-red-100 dark:bg-red-950/40',
  circleText: 'text-red-600 dark:text-red-400',
  circleBorder: 'border-red-300 dark:border-red-700',
  activeBg: 'bg-red-500 dark:bg-red-600',
  activeText: 'text-white',
  activeBorder: 'border-red-500 dark:border-red-600',
  lineColor: 'bg-red-400',
}

// --- Helpers ---

function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function getStatusDateMap(
  statusHistory: StatusHistoryEntry[]
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const entry of statusHistory) {
    // Keep the first occurrence (earliest) for each status
    if (!map[entry.status]) {
      map[entry.status] = entry.createdAt
    }
  }
  return map
}

function getStepState(
  stepKey: string,
  currentStatus: string,
  stepsOrder: string[]
): 'completed' | 'current' | 'future' {
  const currentIndex = stepsOrder.indexOf(currentStatus)
  const stepIndex = stepsOrder.indexOf(stepKey)

  if (currentStatus === 'cancelled') {
    // For cancelled projects, all main steps are "future" (none completed in the normal flow)
    return 'future'
  }

  if (stepIndex < 0 || currentIndex < 0) return 'future'

  if (stepIndex < currentIndex) return 'completed'
  if (stepIndex === currentIndex) return 'current'
  return 'future'
}

// --- Animation variants ---

const stepVariants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: {
      delay: i * 0.08,
      duration: 0.4,
      ease: 'easeOut',
    },
  }),
}

const lineVariants = {
  hidden: { scaleX: 0 },
  visible: (i: number) => ({
    scaleX: 1,
    transition: {
      delay: i * 0.08 + 0.1,
      duration: 0.3,
      ease: 'easeOut',
    },
  }),
}

const checkVariants = {
  hidden: { scale: 0, opacity: 0 },
  visible: (i: number) => ({
    scale: 1,
    opacity: 1,
    transition: {
      delay: i * 0.08 + 0.2,
      duration: 0.3,
      type: 'spring',
      stiffness: 300,
      damping: 15,
    },
  }),
}

const pulseVariants = {
  pulse: {
    scale: [1, 1.08, 1],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      repeatType: 'loop' as const,
      ease: 'easeInOut',
    },
  },
}

// --- Component ---

export function ProjectTimeline({ currentStatus, statusHistory }: TimelineProps) {
  const isCancelled = currentStatus === 'cancelled'
  const stepsOrder = STATUS_STEPS.map((s) => s.key)
  const statusDateMap = getStatusDateMap(statusHistory)

  // Find the last non-cancelled status from history for cancelled projects
  let lastActiveIndex = -1
  if (isCancelled) {
    for (let i = stepsOrder.length - 1; i >= 0; i--) {
      if (statusDateMap[stepsOrder[i]]) {
        lastActiveIndex = i
        break
      }
    }
  }

  return (
    <div className="w-full">
      {/* Desktop: horizontal stepper */}
      <div className="hidden sm:block">
        <HorizontalTimeline
          currentStatus={currentStatus}
          statusDateMap={statusDateMap}
          stepsOrder={stepsOrder}
          isCancelled={isCancelled}
          lastActiveIndex={lastActiveIndex}
        />
      </div>

      {/* Mobile: vertical timeline */}
      <div className="sm:hidden">
        <VerticalTimeline
          currentStatus={currentStatus}
          statusDateMap={statusDateMap}
          stepsOrder={stepsOrder}
          isCancelled={isCancelled}
          lastActiveIndex={lastActiveIndex}
        />
      </div>
    </div>
  )
}

// --- Horizontal Timeline (Desktop) ---

function HorizontalTimeline({
  currentStatus,
  statusDateMap,
  stepsOrder,
  isCancelled,
  lastActiveIndex,
}: {
  currentStatus: string
  statusDateMap: Record<string, string>
  stepsOrder: string[]
  isCancelled: boolean
  lastActiveIndex: number
}) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="text-sm font-semibold text-muted-foreground mb-6">
        Жизненный цикл проекта
      </h3>

      <div className="relative">
        {/* Steps row */}
        <div className="flex items-start justify-between">
          {STATUS_STEPS.map((step, idx) => {
            const state = isCancelled
              ? idx <= lastActiveIndex
                ? 'completed'
                : 'future'
              : getStepState(step.key, currentStatus, stepsOrder)

            const isCurrentStep = !isCancelled && step.key === currentStatus
            const date = statusDateMap[step.key]

            return (
              <div
                key={step.key}
                className="flex flex-col items-center relative"
                style={{ flex: 1, maxWidth: `${100 / STATUS_STEPS.length}%` }}
              >
                {/* Circle */}
                <motion.div
                  custom={idx}
                  variants={stepVariants}
                  initial="hidden"
                  animate="visible"
                  className="relative"
                >
                  <motion.div
                    className={`
                      size-10 rounded-full border-2 flex items-center justify-center transition-colors
                      ${state === 'completed'
                        ? 'bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600'
                        : state === 'current'
                          ? `${step.activeBg} ${step.activeBorder} border-2`
                          : `${step.circleBg} ${step.circleBorder} border-2`
                      }
                    `}
                    animate={
                      isCurrentStep
                        ? {
                            scale: [1, 1.06, 1],
                            transition: {
                              duration: 2,
                              repeat: Infinity,
                              ease: 'easeInOut',
                            },
                          }
                        : {}
                    }
                  >
                    {state === 'completed' ? (
                      <motion.div
                        custom={idx}
                        variants={checkVariants}
                        initial="hidden"
                        animate="visible"
                      >
                        <Check className="size-5 text-white" strokeWidth={3} />
                      </motion.div>
                    ) : state === 'current' ? (
                      <step.icon className={`size-5 ${step.activeText}`} />
                    ) : (
                      <step.icon className={`size-4.5 ${step.circleText} opacity-50`} />
                    )}
                  </motion.div>

                  {/* Current step glow */}
                  {isCurrentStep && (
                    <motion.div
                      className="absolute inset-0 rounded-full border-2 border-primary/30"
                      variants={pulseVariants}
                      animate="pulse"
                    />
                  )}
                </motion.div>

                {/* Label */}
                <motion.p
                  custom={idx}
                  variants={stepVariants}
                  initial="hidden"
                  animate="visible"
                  className={`
                    mt-2 text-xs font-medium text-center leading-tight
                    ${state === 'completed'
                      ? 'text-green-700 dark:text-green-400'
                      : state === 'current'
                        ? 'text-foreground'
                        : 'text-muted-foreground opacity-60'
                    }
                  `}
                >
                  {step.label}
                </motion.p>

                {/* Date */}
                {date && (
                  <motion.p
                    custom={idx}
                    variants={stepVariants}
                    initial="hidden"
                    animate="visible"
                    className={`
                      text-[10px] mt-0.5
                      ${state === 'completed'
                        ? 'text-green-600/70 dark:text-green-400/70'
                        : state === 'current'
                          ? 'text-muted-foreground'
                          : 'text-muted-foreground/50'
                      }
                    `}
                  >
                    {formatDateShort(date)}
                  </motion.p>
                )}
              </div>
            )
          })}
        </div>

        {/* Connecting lines between steps */}
        <div className="absolute top-5 left-0 right-0 flex px-5 pointer-events-none" style={{ width: '100%' }}>
          {STATUS_STEPS.map((step, idx) => {
            if (idx === 0) return null

            const prevState = isCancelled
              ? idx - 1 <= lastActiveIndex
                ? 'completed'
                : 'future'
              : getStepState(STATUS_STEPS[idx - 1].key, currentStatus, stepsOrder)

            const currState = isCancelled
              ? idx <= lastActiveIndex
                ? 'completed'
                : 'future'
              : getStepState(step.key, currentStatus, stepsOrder)

            const lineCompleted = prevState === 'completed' && (currState === 'completed' || currState === 'current')

            return (
              <div
                key={`line-${step.key}`}
                className="relative h-0.5"
                style={{ flex: 1, marginLeft: idx === 1 ? 0 : 0 }}
              >
                <div className="absolute inset-0 bg-border" />
                <motion.div
                  custom={idx}
                  variants={lineVariants}
                  initial="hidden"
                  animate="visible"
                  className={`
                    absolute inset-y-0 left-0 origin-left
                    ${lineCompleted ? 'bg-green-500 dark:bg-green-600' : 'bg-border'}
                  `}
                  style={{ scaleX: lineCompleted ? 1 : 0 }}
                />
              </div>
            )
          })}
        </div>

        {/* Cancelled branch */}
        {isCancelled && (
          <CancelledBranchHorizontal
            lastActiveIndex={lastActiveIndex}
            cancelledDate={statusDateMap['cancelled']}
          />
        )}
      </div>
    </div>
  )
}

// --- Cancelled branch for horizontal view ---

function CancelledBranchHorizontal({
  lastActiveIndex,
  cancelledDate,
}: {
  lastActiveIndex: number
  cancelledDate?: string
}) {
  // Position the cancelled branch below the last active step
  const offsetPercent = lastActiveIndex >= 0
    ? (lastActiveIndex / STATUS_STEPS.length) * 100 + (100 / STATUS_STEPS.length) / 2
    : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.4 }}
      className="absolute"
      style={{
        left: `${offsetPercent}%`,
        top: '52px',
        transform: 'translateX(-50%)',
      }}
    >
      {/* Vertical dashed line */}
      <div className="flex flex-col items-center">
        <svg width="2" height="20" className="text-red-400">
          <line
            x1="1"
            y1="0"
            x2="1"
            y2="20"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="4 3"
          />
        </svg>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.7, type: 'spring', stiffness: 300, damping: 15 }}
          className="size-9 rounded-full bg-red-500 dark:bg-red-600 border-2 border-red-500 dark:border-red-600 flex items-center justify-center"
        >
          <XCircle className="size-4.5 text-white" />
        </motion.div>
        <p className="mt-1 text-xs font-semibold text-red-600 dark:text-red-400">
          Отменено
        </p>
        {cancelledDate && (
          <p className="text-[10px] text-red-500/70 dark:text-red-400/70">
            {formatDateShort(cancelledDate)}
          </p>
        )}
      </div>
    </motion.div>
  )
}

// --- Vertical Timeline (Mobile) ---

function VerticalTimeline({
  currentStatus,
  statusDateMap,
  stepsOrder,
  isCancelled,
  lastActiveIndex,
}: {
  currentStatus: string
  statusDateMap: Record<string, string>
  stepsOrder: string[]
  isCancelled: boolean
  lastActiveIndex: number
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">
        Жизненный цикл проекта
      </h3>

      <div className="relative">
        {STATUS_STEPS.map((step, idx) => {
          const state = isCancelled
            ? idx <= lastActiveIndex
              ? 'completed'
              : 'future'
            : getStepState(step.key, currentStatus, stepsOrder)

          const isCurrentStep = !isCancelled && step.key === currentStatus
          const date = statusDateMap[step.key]
          const isLast = idx === STATUS_STEPS.length - 1

          // Cancelled branch after the last active step
          const showCancelledBranch = isCancelled && idx === lastActiveIndex

          return (
            <div key={step.key}>
              <div className="flex items-start gap-3">
                {/* Left: dot/line column */}
                <div className="flex flex-col items-center shrink-0">
                  <motion.div
                    custom={idx}
                    variants={stepVariants}
                    initial="hidden"
                    animate="visible"
                    className="relative"
                  >
                    <motion.div
                      className={`
                        size-8 rounded-full border-2 flex items-center justify-center
                        ${state === 'completed'
                          ? 'bg-green-500 border-green-500 dark:bg-green-600 dark:border-green-600'
                          : state === 'current'
                            ? `${step.activeBg} ${step.activeBorder}`
                            : `${step.circleBg} ${step.circleBorder}`
                        }
                      `}
                      animate={
                        isCurrentStep
                          ? {
                              scale: [1, 1.1, 1],
                              transition: {
                                duration: 2,
                                repeat: Infinity,
                                ease: 'easeInOut',
                              },
                            }
                          : {}
                      }
                    >
                      {state === 'completed' ? (
                        <motion.div
                          custom={idx}
                          variants={checkVariants}
                          initial="hidden"
                          animate="visible"
                        >
                          <Check className="size-4 text-white" strokeWidth={3} />
                        </motion.div>
                      ) : state === 'current' ? (
                        <step.icon className={`size-4 ${step.activeText}`} />
                      ) : (
                        <step.icon className={`size-3.5 ${step.circleText} opacity-50`} />
                      )}
                    </motion.div>

                    {isCurrentStep && (
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-primary/30"
                        variants={pulseVariants}
                        animate="pulse"
                      />
                    )}
                  </motion.div>

                  {/* Vertical line */}
                  {!isLast && (
                    <motion.div
                      custom={idx}
                      variants={lineVariants}
                      initial="hidden"
                      animate="visible"
                      className={`
                        w-0.5 h-8 origin-top
                        ${state === 'completed' || state === 'current'
                          ? 'bg-green-400 dark:bg-green-600'
                          : 'bg-border'
                        }
                      `}
                    />
                  )}
                </div>

                {/* Right: content */}
                <motion.div
                  custom={idx}
                  variants={stepVariants}
                  initial="hidden"
                  animate="visible"
                  className="pb-4 pt-0.5"
                >
                  <p
                    className={`
                      text-sm font-medium
                      ${state === 'completed'
                        ? 'text-green-700 dark:text-green-400'
                        : state === 'current'
                          ? 'text-foreground'
                          : 'text-muted-foreground opacity-60'
                      }
                    `}
                  >
                    {step.label}
                  </p>
                  {date && (
                    <p
                      className={`
                        text-xs mt-0.5
                        ${state === 'completed'
                          ? 'text-green-600/70 dark:text-green-400/70'
                          : state === 'current'
                            ? 'text-muted-foreground'
                            : 'text-muted-foreground/50'
                        }
                      `}
                    >
                      {formatDateShort(date)}
                    </p>
                  )}
                </motion.div>
              </div>

              {/* Cancelled branch */}
              {showCancelledBranch && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                  className="flex items-start gap-3 ml-0"
                >
                  {/* Line from last active to cancelled */}
                  <div className="flex flex-col items-center shrink-0">
                    <svg width="12" height="20" className="text-red-400 -ml-1.5">
                      <line
                        x1="6"
                        y1="0"
                        x2="6"
                        y2="10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray="3 2"
                      />
                      <line
                        x1="6"
                        y1="10"
                        x2="16"
                        y2="10"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray="3 2"
                      />
                    </svg>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 15 }}
                      className="size-7 rounded-full bg-red-500 dark:bg-red-600 border-2 border-red-500 dark:border-red-600 flex items-center justify-center -ml-1"
                    >
                      <XCircle className="size-3.5 text-white" />
                    </motion.div>
                  </div>
                  <div className="pb-4 pt-1">
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                      Отменено
                    </p>
                    {statusDateMap['cancelled'] && (
                      <p className="text-xs text-red-500/70 dark:text-red-400/70">
                        {formatDateShort(statusDateMap['cancelled'])}
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
