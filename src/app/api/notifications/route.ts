/**
 * Notifications API Route
 *
 * TODO: M005/S01 - This route was not part of the API migration slice.
 * This endpoint generates notifications from multiple Prisma models.
 * Future migration: Create equivalent FastAPI endpoints for notifications.
 */
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

// In-memory store for notification read states (demo purposes)
const readState = new Map<string, boolean>()
// In-memory store for cleared notifications
const clearedIds = new Set<string>()

export interface NotificationItem {
  id: string
  type: string
  category: 'Проект' | 'Счёт' | 'Склад' | 'Запрос'
  title: string
  description: string
  timestamp: string
  read: boolean
  priority: 'high' | 'medium' | 'low'
  entityId?: string
  entityType?: string
}

const statusLabels: Record<string, string> = {
  new: 'Новый',
  processing: 'В обработке',
  requested: 'Запрошено',
  invoiced: 'Счёт выставлен',
  paid: 'Оплачено',
  delivered: 'Доставлено',
  completed: 'Завершён',
  cancelled: 'Отменён',
}

const invoiceStatusLabels: Record<string, string> = {
  received: 'Получен',
  verified: 'Проверен',
  discrepancy: 'Расхождение',
  approved: 'Утверждён',
  paid: 'Оплачен',
  cancelled: 'Отменён',
}

export async function GET(request: NextRequest) {
  try {
    const notifications: NotificationItem[] = []
    const url = new URL(request.url)
    const categoryFilter = url.searchParams.get('category')
    const priorityFilter = url.searchParams.get('priority')

    // 1. Low stock warehouse items (out of stock)
    const lowStockItems = await db.warehouseItem.findMany({
      where: {
        quantity: { lte: 0 },
      },
      take: 10,
    })
    for (const item of lowStockItems) {
      const id = `low-stock-${item.id}`
      if (!clearedIds.has(id)) {
        notifications.push({
          id,
          type: 'low_stock',
          category: 'Склад',
          title: `Нет в наличии: ${item.name}`,
          description: `Позиция "${item.name}" (${item.article || 'без артикула'}) — остаток: ${item.quantity} ${item.unit}`,
          timestamp: item.updatedAt.toISOString(),
          read: readState.get(id) ?? false,
          priority: 'high',
          entityId: item.id,
          entityType: 'warehouse',
        })
      }
    }

    // Low but not zero stock
    const belowMinItems = await db.warehouseItem.findMany({
      where: {
        quantity: { gt: 0 },
        minQuantity: { gt: 0 },
      },
      take: 10,
    })
    for (const item of belowMinItems) {
      if (item.quantity <= item.minQuantity && item.quantity > 0) {
        const id = `below-min-${item.id}`
        if (!clearedIds.has(id)) {
          notifications.push({
            id,
            type: 'below_min_stock',
            category: 'Склад',
            title: `Низкий запас: ${item.name}`,
            description: `Остаток ${item.quantity} ${item.unit} при минимуме ${item.minQuantity} ${item.unit}`,
            timestamp: item.updatedAt.toISOString(),
            read: readState.get(id) ?? false,
            priority: 'medium',
            entityId: item.id,
            entityType: 'warehouse',
          })
        }
      }
    }

    // 2. Pending invoices (received but not yet processed)
    const pendingInvoices = await db.invoice.findMany({
      where: {
        status: { in: ['received', 'discrepancy'] },
      },
      include: {
        project: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      take: 10,
    })
    for (const inv of pendingInvoices) {
      const id = `pending-invoice-${inv.id}`
      if (!clearedIds.has(id)) {
        const isDiscrepancy = inv.status === 'discrepancy'
        notifications.push({
          id,
          type: isDiscrepancy ? 'invoice_discrepancy' : 'invoice_pending',
          category: 'Счёт',
          title: isDiscrepancy
            ? `Расхождение в счёте ${inv.invoiceNumber || 'без номера'}`
            : `Новый счёт: ${inv.invoiceNumber || 'без номера'}`,
          description: `${inv.supplier.name} → ${inv.project.name} • ${invoiceStatusLabels[inv.status] || inv.status} • ${(inv.totalAmount || 0).toLocaleString('ru-RU')} ₽`,
          timestamp: inv.receivedAt.toISOString(),
          read: readState.get(id) ?? false,
          priority: isDiscrepancy ? 'high' : 'medium',
          entityId: inv.id,
          entityType: 'invoice',
        })
      }
    }

    // 3. Project status changes (recent)
    const recentStatusChanges = await db.projectStatusHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { project: { select: { name: true } } },
    })
    for (const s of recentStatusChanges) {
      const id = `status-change-${s.id}`
      if (!clearedIds.has(id)) {
        const fromLabel = statusLabels[s.fromStatus] || s.fromStatus
        const toLabel = statusLabels[s.toStatus] || s.toStatus || statusLabels[s.status] || s.status
        notifications.push({
          id,
          type: 'status_changed',
          category: 'Проект',
          title: s.project.name,
          description: `Статус: ${fromLabel} → ${toLabel}${s.comment ? ` • ${s.comment}` : ''}`,
          timestamp: s.createdAt.toISOString(),
          read: readState.get(id) ?? false,
          priority: ['cancelled'].includes(s.toStatus || s.status) ? 'high' : 'low',
          entityId: s.projectId,
          entityType: 'project',
        })
      }
    }

    // 4. Overdue deliveries
    const overdueDeliveries = await db.delivery.findMany({
      where: {
        status: { in: ['pending', 'shipped', 'in_transit'] },
        estimatedDate: { lt: new Date() },
      },
      include: {
        project: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      take: 10,
    })
    for (const d of overdueDeliveries) {
      const id = `overdue-delivery-${d.id}`
      if (!clearedIds.has(id)) {
        const daysOverdue = Math.floor(
          (Date.now() - (d.estimatedDate?.getTime() || Date.now())) / (1000 * 60 * 60 * 24)
        )
        notifications.push({
          id,
          type: 'overdue_delivery',
          category: 'Проект',
          title: `Просрочена доставка: ${d.carrier || 'Без ТК'}`,
          description: `${d.project.name} от ${d.supplier.name} • просрочка ${daysOverdue} дн.`,
          timestamp: (d.estimatedDate || d.createdAt).toISOString(),
          read: readState.get(id) ?? false,
          priority: 'high',
          entityId: d.id,
          entityType: 'delivery',
        })
      }
    }

    // 5. Unanswered requests (sent but no response for 2+ days)
    const unansweredRequests = await db.purchaseRequest.findMany({
      where: {
        status: 'sent',
        sentAt: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      },
      include: {
        project: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      take: 10,
    })
    for (const r of unansweredRequests) {
      const id = `unanswered-request-${r.id}`
      if (!clearedIds.has(id)) {
        const daysWaiting = r.sentAt
          ? Math.floor((Date.now() - r.sentAt.getTime()) / (1000 * 60 * 60 * 24))
          : 0
        notifications.push({
          id,
          type: 'unanswered_request',
          category: 'Запрос',
          title: `Нет ответа: ${r.supplier.name}`,
          description: `${r.project.name} • ожидание ${daysWaiting} дн.`,
          timestamp: (r.sentAt || r.createdAt).toISOString(),
          read: readState.get(id) ?? false,
          priority: daysWaiting >= 5 ? 'high' : 'medium',
          entityId: r.id,
          entityType: 'request',
        })
      }
    }

    // 6. Recently created projects (within 72h)
    const recentProjects = await db.project.findMany({
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { id: true, name: true, createdAt: true, status: true },
    })
    for (const p of recentProjects) {
      const id = `new-project-${p.id}`
      if (!clearedIds.has(id)) {
        const hoursSinceCreation = (Date.now() - p.createdAt.getTime()) / (1000 * 60 * 60)
        if (hoursSinceCreation <= 72) {
          notifications.push({
            id,
            type: 'project_created',
            category: 'Проект',
            title: `Новый проект: ${p.name}`,
            description: `Статус: ${statusLabels[p.status] || p.status}`,
            timestamp: p.createdAt.toISOString(),
            read: readState.get(id) ?? false,
            priority: 'low',
            entityId: p.id,
            entityType: 'project',
          })
        }
      }
    }

    // 7. Draft requests (need to be sent)
    const draftRequests = await db.purchaseRequest.findMany({
      where: { status: 'draft' },
      include: {
        project: { select: { name: true } },
        supplier: { select: { name: true } },
      },
      take: 5,
    })
    for (const r of draftRequests) {
      const id = `draft-request-${r.id}`
      if (!clearedIds.has(id)) {
        notifications.push({
          id,
          type: 'draft_request',
          category: 'Запрос',
          title: `Черновик запроса: ${r.supplier.name}`,
          description: `${r.project.name} • ожидает отправки`,
          timestamp: r.createdAt.toISOString(),
          read: readState.get(id) ?? false,
          priority: 'low',
          entityId: r.id,
          entityType: 'request',
        })
      }
    }

    // Sort by priority first (high → medium → low), then by timestamp desc
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    notifications.sort((a, b) => {
      const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (pDiff !== 0) return pDiff
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })

    // Apply filters
    let filtered = notifications
    if (categoryFilter && categoryFilter !== 'all') {
      filtered = filtered.filter((n) => n.category === categoryFilter)
    }
    if (priorityFilter && priorityFilter !== 'all') {
      filtered = filtered.filter((n) => n.priority === priorityFilter)
    }

    return NextResponse.json({
      notifications: filtered.slice(0, 50),
      unreadCount: filtered.filter((n) => !n.read).length,
      totalCount: filtered.length,
      categories: ['Проект', 'Счёт', 'Склад', 'Запрос'] as const,
    })
  } catch (error) {
    console.error('Notifications error:', error)
    return NextResponse.json({ error: 'Failed to fetch notifications' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { ids, markAllRead, clearAll } = body as {
      ids?: string[]
      markAllRead?: boolean
      clearAll?: boolean
    }

    if (clearAll) {
      const currentIds = await getCurrentNotificationIds()
      for (const id of currentIds) {
        clearedIds.add(id)
        readState.set(id, true)
      }
      return NextResponse.json({ success: true, clearedCount: currentIds.length })
    }

    if (markAllRead && ids) {
      for (const id of ids) {
        readState.set(id, true)
      }
      return NextResponse.json({ success: true, readCount: ids.length })
    }

    if (ids) {
      for (const id of ids) {
        readState.set(id, true)
      }
      return NextResponse.json({ success: true, readCount: ids.length })
    }

    return NextResponse.json({ error: 'No action specified' }, { status: 400 })
  } catch (error) {
    console.error('Notifications PATCH error:', error)
    return NextResponse.json({ error: 'Failed to update notifications' }, { status: 500 })
  }
}

// Helper to get current notification IDs
async function getCurrentNotificationIds(): Promise<string[]> {
  const ids: string[] = []

  const lowStockItems = await db.warehouseItem.findMany({
    where: { quantity: { lte: 0 } },
    take: 10,
    select: { id: true },
  })
  for (const item of lowStockItems) ids.push(`low-stock-${item.id}`)

  const belowMinItems = await db.warehouseItem.findMany({
    where: { quantity: { gt: 0 }, minQuantity: { gt: 0 } },
    take: 10,
    select: { id: true, quantity: true, minQuantity: true },
  })
  for (const item of belowMinItems) {
    if (item.quantity <= item.minQuantity && item.quantity > 0) {
      ids.push(`below-min-${item.id}`)
    }
  }

  const pendingInvoices = await db.invoice.findMany({
    where: { status: { in: ['received', 'discrepancy'] } },
    take: 10,
    select: { id: true },
  })
  for (const inv of pendingInvoices) ids.push(`pending-invoice-${inv.id}`)

  const recentStatusChanges = await db.projectStatusHistory.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
    select: { id: true },
  })
  for (const s of recentStatusChanges) ids.push(`status-change-${s.id}`)

  const overdueDeliveries = await db.delivery.findMany({
    where: { status: { in: ['pending', 'shipped', 'in_transit'] }, estimatedDate: { lt: new Date() } },
    take: 10,
    select: { id: true },
  })
  for (const d of overdueDeliveries) ids.push(`overdue-delivery-${d.id}`)

  const unansweredRequests = await db.purchaseRequest.findMany({
    where: { status: 'sent', sentAt: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } },
    take: 10,
    select: { id: true },
  })
  for (const r of unansweredRequests) ids.push(`unanswered-request-${r.id}`)

  const recentProjects = await db.project.findMany({
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { id: true, createdAt: true },
  })
  for (const p of recentProjects) {
    const hoursSinceCreation = (Date.now() - p.createdAt.getTime()) / (1000 * 60 * 60)
    if (hoursSinceCreation <= 72) ids.push(`new-project-${p.id}`)
  }

  const draftRequests = await db.purchaseRequest.findMany({
    where: { status: 'draft' },
    take: 5,
    select: { id: true },
  })
  for (const r of draftRequests) ids.push(`draft-request-${r.id}`)

  return ids
}
