import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Russian pluralization helper.
 * Returns the correct word form based on the count.
 *
 * Rules:
 *   1, 21, 31, ... → singular  (e.g. 1 черновик, 21 проект)
 *   2-4, 22-24, ... → plural2  (e.g. 2 черновика, 22 проекта)
 *   0, 5-20, 25-30, ... → plural5 (e.g. 5 черновиков, 11 проектов)
 */
export function pluralize(count: number, singular: string, plural2: string, plural5: string): string {
  const absCount = Math.abs(count)
  const mod10 = absCount % 10
  const mod100 = absCount % 100

  if (mod10 === 1 && mod100 !== 11) return singular
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return plural2
  return plural5
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  const diffWeek = Math.floor(diffDay / 7)
  const diffMonth = Math.floor(diffDay / 30)

  if (diffMin < 1) return 'только что'
  if (diffMin < 60) return `${diffMin} мин назад`
  if (diffHour < 24) return `${diffHour} ч назад`
  if (diffDay < 7) return `${diffDay} дн. назад`
  if (diffDay < 30) return `${diffWeek} нед. назад`

  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}
