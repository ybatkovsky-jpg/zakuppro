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
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 })
  }
}
