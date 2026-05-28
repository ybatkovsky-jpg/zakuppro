import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const [
      totalProjects,
      activeProjects,
      completedProjects,
      totalSuppliers,
      warehouseItems,
      pendingRequests,
      sentRequests,
      unpaidInvoices,
      recentProjects,
    ] = await Promise.all([
      db.project.count(),
      db.project.count({ where: { status: { notIn: ['completed', 'cancelled'] } } }),
      db.project.count({ where: { status: 'completed' } }),
      db.supplier.count(),
      db.warehouseItem.findMany({ select: { id: true, quantity: true, minQuantity: true } }),
      db.purchaseRequest.count({ where: { status: 'draft' } }),
      db.purchaseRequest.count({ where: { status: 'sent' } }),
      db.invoice.findMany({
        where: { status: { notIn: ['paid', 'cancelled'] } },
        select: { totalAmount: true },
      }),
      db.project.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { _count: { select: { items: true } } },
      }),
    ])

    const totalWarehouseItems = warehouseItems.length
    const lowStockItems = warehouseItems.filter((i) => i.quantity < i.minQuantity).length
    const unpaidInvoicesCount = unpaidInvoices.length
    const totalInvoiceAmount = unpaidInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0)

    // ── Chart Data: Project Status Distribution ─────────────────────────────
    const statusColors: Record<string, string> = {
      new: '#94a3b8',
      processing: '#3b82f6',
      requested: '#8b5cf6',
      invoiced: '#f59e0b',
      paid: '#10b981',
      delivered: '#059669',
      completed: '#047857',
      cancelled: '#ef4444',
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

    const projectStatusCounts = await db.project.groupBy({
      by: ['status'],
      _count: { status: true },
    })

    const projectStatusData = projectStatusCounts.map((item) => ({
      name: statusLabels[item.status] || item.status,
      value: item._count.status,
      color: statusColors[item.status] || '#94a3b8',
    }))

    // ── Chart Data: Monthly Projects Trend (last 6 months) ──────────────────
    const now = new Date()
    const monthlyProjectsData = []
    const monthNames = [
      'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
      'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
    ]

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const startDate = new Date(date.getFullYear(), date.getMonth(), 1)
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 1)

      const count = await db.project.count({
        where: {
          createdAt: {
            gte: startDate,
            lt: endDate,
          },
        },
      })

      monthlyProjectsData.push({
        month: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
        count,
      })
    }

    // ── Chart Data: Warehouse Stock Summary (top 10 by quantity) ────────────
    const warehouseAllItems = await db.warehouseItem.findMany({
      orderBy: { quantity: 'desc' },
      take: 10,
    })

    const warehouseStockData = warehouseAllItems.map((item) => ({
      name: item.name.length > 25 ? item.name.substring(0, 25) + '…' : item.name,
      quantity: item.quantity,
      minQuantity: item.minQuantity,
      status: item.quantity > item.minQuantity
        ? ('ok' as const)
        : item.quantity === item.minQuantity
          ? ('warning' as const)
          : ('low' as const),
    }))

    return NextResponse.json({
      totalProjects,
      activeProjects,
      completedProjects,
      totalSuppliers,
      totalWarehouseItems,
      lowStockItems,
      pendingRequests,
      sentRequests,
      unpaidInvoices: unpaidInvoicesCount,
      totalInvoiceAmount,
      recentProjects,
      projectStatusData,
      monthlyProjectsData,
      warehouseStockData,
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 })
  }
}
