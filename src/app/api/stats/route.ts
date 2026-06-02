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
    const monthlyProjectsData: Array<{ month: string; count: number }> = []
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

    // ── Budget Data ─────────────────────────────────────────────────────────
    // Get all project items with their invoice info for budget calculations
    const allProjectItems = await db.projectItem.findMany({
      select: {
        id: true,
        category: true,
        price: true,
        quantity: true,
        invoiceItems: {
          where: {
            invoice: { status: { notIn: ['cancelled'] } },
          },
          select: { quantity: true, price: true },
        },
      },
    })

    // Calculate total budget from all project items
    const totalBudget = allProjectItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    )

    // Calculate spent budget from invoiced items (where invoice is not cancelled)
    const spentBudget = allProjectItems.reduce((sum, item) => {
      const itemSpent = item.invoiceItems.reduce(
        (s, ii) => s + ii.price * ii.quantity,
        0,
      )
      return sum + itemSpent
    }, 0)

    const pendingBudget = totalBudget - spentBudget

    // Budget by category (top 8)
    const categoryMap = new Map<string, { budget: number; spent: number }>()
    for (const item of allProjectItems) {
      const cat = item.category || 'Без категории'
      const existing = categoryMap.get(cat) || { budget: 0, spent: 0 }
      existing.budget += item.price * item.quantity
      const itemSpent = item.invoiceItems.reduce(
        (s, ii) => s + ii.price * ii.quantity,
        0,
      )
      existing.spent += itemSpent
      categoryMap.set(cat, existing)
    }

    const byCategory = Array.from(categoryMap.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.budget - a.budget)
      .slice(0, 8)

    const budgetData = {
      totalBudget,
      spentBudget,
      pendingBudget,
      byCategory,
    }

    // ── Project Cost Data ───────────────────────────────────────────────────
    const projectsWithItems = await db.project.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        items: {
          select: {
            price: true,
            quantity: true,
            invoiceItems: {
              where: {
                invoice: { status: { notIn: ['cancelled'] } },
              },
              select: { quantity: true, price: true },
            },
          },
        },
      },
    })

    const projectCostData = projectsWithItems.map((project) => {
      const budget = project.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      )
      const spent = project.items.reduce((sum, item) => {
        const itemSpent = item.invoiceItems.reduce(
          (s, ii) => s + ii.price * ii.quantity,
          0,
        )
        return sum + itemSpent
      }, 0)
      return {
        projectName: project.name,
        budget,
        spent,
        status: project.status,
      }
    })

    // ── Urgent Items Data ───────────────────────────────────────────────────
    const urgentItems: Array<{
      type: 'create_request' | 'check_invoice' | 'restock' | 'await_delivery'
      label: string
      targetId: string
      urgency: 'pending' | 'urgent'
    }> = []

    // Projects with status "new" that have no requests yet
    const newProjectsWithoutRequests = await db.project.findMany({
      where: { status: 'new' },
      select: {
        id: true,
        name: true,
        items: {
          select: { id: true },
        },
      },
      take: 5,
    })

    for (const project of newProjectsWithoutRequests) {
      if (project.items.length > 0) {
        const hasRequests = await db.purchaseRequestItem.findFirst({
          where: { projectItemId: { in: project.items.map((i) => i.id) } },
        })
        if (!hasRequests) {
          urgentItems.push({
            type: 'create_request',
            label: `Создать запросы: ${project.name}`,
            targetId: project.id,
            urgency: 'pending',
          })
        }
      }
    }

    // Invoices with status "received"
    const receivedInvoices = await db.invoice.findMany({
      where: { status: 'received' },
      select: { id: true, invoiceNumber: true },
      take: 5,
    })

    for (const invoice of receivedInvoices) {
      urgentItems.push({
        type: 'check_invoice',
        label: `Проверить счёт: ${invoice.invoiceNumber}`,
        targetId: invoice.id,
        urgency: 'urgent',
      })
    }

    // Warehouse items with low stock
    const allWarehouseItemsForUrgent = await db.warehouseItem.findMany({
      select: { id: true, name: true, quantity: true, minQuantity: true },
    })
    const lowStockWarehouseItems = allWarehouseItemsForUrgent
      .filter((i) => i.quantity < i.minQuantity)
      .slice(0, 5)

    for (const item of lowStockWarehouseItems) {
      urgentItems.push({
        type: 'restock',
        label: `Пополнить: ${item.name}`,
        targetId: item.id,
        urgency: 'urgent',
      })
    }

    // Projects with status "paid" (awaiting delivery)
    const paidProjects = await db.project.findMany({
      where: { status: 'paid' },
      select: { id: true, name: true },
      take: 5,
    })

    for (const project of paidProjects) {
      urgentItems.push({
        type: 'await_delivery',
        label: `Ожидание доставки: ${project.name}`,
        targetId: project.id,
        urgency: 'pending',
      })
    }

    // Limit to 5 most urgent items
    const limitedUrgentItems = urgentItems.slice(0, 5)

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
      budgetData,
      projectCostData,
      urgentItems: limitedUrgentItems,
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 })
  }
}
