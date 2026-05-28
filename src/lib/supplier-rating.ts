export interface SupplierRating {
  score: number // 1-5
  reliability: 'excellent' | 'good' | 'attention'
  deliverySpeed: 'fast' | 'medium' | 'slow'
  stars: number // 1-3
}

export interface SupplierAnalyticsData {
  totalItems: number
  totalSpent: number
  avgDeliveryDays: number
  completionRate: number
  requestCount: number
}

export function calculateSupplierRating(data: SupplierAnalyticsData): SupplierRating {
  // Reliability based on completion rate
  let reliability: SupplierRating['reliability']
  if (data.completionRate > 90) {
    reliability = 'excellent'
  } else if (data.completionRate >= 70) {
    reliability = 'good'
  } else {
    reliability = 'attention'
  }

  // Delivery speed based on avg delivery days
  let deliverySpeed: SupplierRating['deliverySpeed']
  if (data.avgDeliveryDays > 0 && data.avgDeliveryDays < 7) {
    deliverySpeed = 'fast'
  } else if (data.avgDeliveryDays >= 7 && data.avgDeliveryDays <= 14) {
    deliverySpeed = 'medium'
  } else {
    deliverySpeed = 'slow'
  }

  // Stars based on items and requests
  let stars: number
  if (data.totalItems > 10 && data.requestCount > 2) {
    stars = 3
  } else if (data.totalItems > 5 || data.requestCount > 1) {
    stars = 2
  } else {
    stars = 1
  }

  // Overall score (1-5) - weighted combination
  const reliabilityScore =
    reliability === 'excellent' ? 5 : reliability === 'good' ? 3 : 1
  const deliveryScore =
    deliverySpeed === 'fast' ? 5 : deliverySpeed === 'medium' ? 3 : 1
  const volumeScore = data.totalItems > 10 ? 5 : data.totalItems > 5 ? 4 : data.totalItems > 2 ? 3 : data.totalItems > 0 ? 2 : 1

  const score = Math.round((reliabilityScore * 0.4 + deliveryScore * 0.3 + volumeScore * 0.3) * 10) / 10

  return {
    score: Math.max(1, Math.min(5, Math.round(score))),
    reliability,
    deliverySpeed,
    stars,
  }
}

// Reliability labels and colors
export const RELIABILITY_CONFIG = {
  excellent: {
    label: 'Отлично',
    className: 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/30',
    dotColor: 'bg-emerald-500',
    ringColor: 'text-emerald-500',
  },
  good: {
    label: 'Хорошо',
    className: 'border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:bg-amber-950/30',
    dotColor: 'bg-amber-500',
    ringColor: 'text-amber-500',
  },
  attention: {
    label: 'Требует внимания',
    className: 'border-red-300 text-red-700 bg-red-50 dark:border-red-700 dark:text-red-400 dark:bg-red-950/30',
    dotColor: 'bg-red-500',
    ringColor: 'text-red-500',
  },
} as const

export const DELIVERY_SPEED_CONFIG = {
  fast: {
    label: 'Быстро',
    className: 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/30',
  },
  medium: {
    label: 'Средне',
    className: 'border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:bg-amber-950/30',
  },
  slow: {
    label: 'Долго',
    className: 'border-red-300 text-red-700 bg-red-50 dark:border-red-700 dark:text-red-400 dark:bg-red-950/30',
  },
} as const
