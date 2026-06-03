/**
 * Activity Feed API Route
 *
 * TODO: M005/S01 - This route was not part of the API migration slice.
 * This endpoint aggregates activity from Prisma models.
 * Future migration: Create equivalent FastAPI activity endpoints.
 */
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

interface ActivityItem {
  id: string
  type: 'project_created' | 'status_changed' | 'request_created' | 'invoice_received' | 'warehouse_transaction'
  title: string
  description: string
  timestamp: string
}

export async function GET() {
  try {
    const activities: ActivityItem[] = []

    // New projects created
    const recentProjects = await db.project.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, createdAt: true },
    })
    for (const p of recentProjects) {
      activities.push({
        id: `project-${p.id}`,
        type: 'project_created',
        title: p.name,
        description: 'Новый проект создан',
        timestamp: p.createdAt.toISOString(),
      })
    }

    // Status changes
    const recentStatusChanges = await db.projectStatusHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { project: { select: { name: true } } },
    })
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
    for (const s of recentStatusChanges) {
      activities.push({
        id: `status-${s.id}`,
        type: 'status_changed',
        title: s.project.name,
        description: `Статус → ${statusLabels[s.status] || s.status}`,
        timestamp: s.createdAt.toISOString(),
      })
    }

    // New purchase requests
    const recentRequests = await db.purchaseRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        project: { select: { name: true } },
        supplier: { select: { name: true } },
      },
    })
    for (const r of recentRequests) {
      activities.push({
        id: `request-${r.id}`,
        type: 'request_created',
        title: r.project.name,
        description: `Запрос поставщику: ${r.supplier.name}`,
        timestamp: r.createdAt.toISOString(),
      })
    }

    // New invoices
    const recentInvoices = await db.invoice.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        project: { select: { name: true } },
        supplier: { select: { name: true } },
      },
    })
    for (const inv of recentInvoices) {
      activities.push({
        id: `invoice-${inv.id}`,
        type: 'invoice_received',
        title: inv.project.name,
        description: `Счёт от ${inv.supplier.name}`,
        timestamp: inv.createdAt.toISOString(),
      })
    }

    // Warehouse transactions
    const recentWarehouseTx = await db.warehouseTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        warehouseItem: { select: { name: true } },
      },
    })
    for (const tx of recentWarehouseTx) {
      activities.push({
        id: `warehouse-${tx.id}`,
        type: 'warehouse_transaction',
        title: tx.warehouseItem.name,
        description: tx.type === 'in'
          ? `Приход: +${tx.quantity} шт`
          : `Расход: -${tx.quantity} шт`,
        timestamp: tx.createdAt.toISOString(),
      })
    }

    // Sort by timestamp desc and limit to 20
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json(activities.slice(0, 20))
  } catch (error) {
    console.error('Activity error:', error)
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 })
  }
}
