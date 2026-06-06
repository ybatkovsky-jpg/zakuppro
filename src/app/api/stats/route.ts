/**
 * Stats API Route — Proxies to FastAPI backend
 *
 * Aggregates statistics for the dashboard. Since the DB uses SQLAlchemy models
 * (not Prisma), we query the FastAPI backend which has direct DB access.
 */
import { apiFetch } from '@/lib/api-client'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Fetch data from FastAPI endpoints
    const [projectsResult, suppliersResult, stockItemsResult, analyticsResult] = await Promise.all([
      apiFetch<any[]>('/api/projects'),
      apiFetch<any[]>('/api/suppliers'),
      apiFetch<any[]>('/api/stock-items'),
      apiFetch<any>('/api/analytics/dashboard'),
    ])

    const projects = projectsResult.data || []
    const suppliers = suppliersResult.data || []
    const stockItems = stockItemsResult.data || []
    const analytics = analyticsResult.data || {}

    // Status mapping: FastAPI Russian -> English (for frontend compatibility)
    const statusMap: Record<string, string> = {
      'Проектирование': 'new',
      'Закупки': 'processing',
      'В производстве': 'requested',
      'Монтаж': 'invoiced',
      'Оплачено': 'paid',
      'Доставлено': 'delivered',
      'Завершён': 'completed',
      'Отменён': 'cancelled',
    }

    const statusLabels: Record<string, string> = {
      'new': 'Новый',
      'processing': 'В обработке',
      'requested': 'Запрошено',
      'invoiced': 'Счёт выставлен',
      'paid': 'Оплачено',
      'delivered': 'Доставлено',
      'completed': 'Завершён',
      'cancelled': 'Отменён',
    }

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

    // Map projects to English statuses for frontend
    const mappedProjects = projects.map((p: any) => ({
      ...p,
      status: statusMap[p.status] || p.status,
    }))

    // Basic counts
    const totalProjects = projects.length
    const activeProjects = mappedProjects.filter(
      (p: any) => !['completed', 'cancelled'].includes(p.status)
    ).length
    const completedProjects = mappedProjects.filter(
      (p: any) => p.status === 'completed'
    ).length
    const totalSuppliers = suppliers.length
    const totalWarehouseItems = stockItems.length
    const lowStockItems = stockItems.filter(
      (i: any) => (i.qty_available || 0) < (i.qty_total || 0) * 0.2
    ).length

    // Invoices from analytics
    const unpaidInvoices = analytics.unpaid_invoices_count || 0
    const totalInvoiceAmount = analytics.total_unpaid_amount || 0
    const pendingRequests = 0
    const sentRequests = 0

    // Recent projects (last 5)
    const recentProjects = mappedProjects.slice(0, 5).map((p: any) => ({
      ...p,
      _count: { items: p.items?.length || 0 },
    }))

    // Project status distribution for pie chart
    const statusCounts: Record<string, number> = {}
    for (const p of mappedProjects) {
      const s = p.status || 'new'
      statusCounts[s] = (statusCounts[s] || 0) + 1
    }
    const projectStatusData = Object.entries(statusCounts).map(([status, count]) => ({
      name: statusLabels[status] || status,
      value: count,
      color: statusColors[status] || '#94a3b8',
    }))

    // Monthly projects trend (placeholder — need created_at from projects)
    const now = new Date()
    const monthNames = [
      'Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
      'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек',
    ]
    const monthlyProjectsData: Array<{ month: string; count: number }> = []
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const startDate = new Date(date.getFullYear(), date.getMonth(), 1)
      const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 1)
      const count = mappedProjects.filter((p: any) => {
        const created = new Date(p.created_at || p.createdAt || 0)
        return created >= startDate && created < endDate
      }).length
      monthlyProjectsData.push({
        month: `${monthNames[date.getMonth()]} ${date.getFullYear()}`,
        count,
      })
    }

    // Warehouse stock summary
    const warehouseStockData = stockItems.slice(0, 10).map((item: any) => ({
      name: (item.name || '').length > 25 ? (item.name || '').substring(0, 25) + '…' : item.name,
      quantity: item.qty_total || 0,
      minQuantity: Math.round((item.qty_total || 0) * 0.2),
      status: (item.qty_available || 0) > (item.qty_total || 0) * 0.2
        ? 'ok' as const
        : (item.qty_available || 0) === 0
          ? 'low' as const
          : 'warning' as const,
    }))

    // Budget data from analytics
    const budgetData = {
      totalBudget: analytics.total_unpaid_amount || 0,
      spentBudget: analytics.total_paid_amount || 0,
      pendingBudget: (analytics.total_unpaid_amount || 0) - (analytics.total_paid_amount || 0),
      byCategory: [],
    }

    // Project cost data
    const projectCostData = mappedProjects.map((p: any) => ({
      projectName: p.name,
      budget: p.total_cost || p.totalCost || 0,
      spent: 0,
      status: p.status,
    }))

    // Urgent items (placeholder)
    const urgentItems: Array<{
      type: 'create_request' | 'check_invoice' | 'restock' | 'await_delivery'
      label: string
      targetId: string
      urgency: 'pending' | 'urgent'
    }> = []

    // Low stock items
    for (const item of stockItems.filter((i: any) => (i.qty_available || 0) < (i.qty_total || 0) * 0.2).slice(0, 3)) {
      urgentItems.push({
        type: 'restock',
        label: `Пополнить: ${item.name}`,
        targetId: String(item.id),
        urgency: 'urgent',
      })
    }

    return NextResponse.json({
      totalProjects,
      activeProjects,
      completedProjects,
      totalSuppliers,
      totalWarehouseItems,
      lowStockItems,
      pendingRequests,
      sentRequests,
      unpaidInvoices,
      totalInvoiceAmount,
      recentProjects,
      projectStatusData,
      monthlyProjectsData,
      warehouseStockData,
      budgetData,
      projectCostData,
      urgentItems: urgentItems.slice(0, 5),
    })
  } catch (error) {
    console.error('Stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 })
  }
}
