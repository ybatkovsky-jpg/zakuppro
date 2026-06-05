/**
 * Supplier Analytics API Route
 * TODO: This route aggregates supplier metrics from Prisma.
 * FastAPI backend does not have an equivalent endpoint yet.
 * Future migration: Create /api/analytics/suppliers in FastAPI.
 */
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get all suppliers with their related data
    const suppliers = await db.supplier.findMany({
      select: {
        id: true,
        name: true,
        projectItems: {
          select: {
            id: true,
            status: true,
            price: true,
            quantity: true,
          },
        },
        purchaseRequests: {
          select: {
            id: true,
            status: true,
            items: {
              select: {
                deliveryDays: true,
                quantity: true,
                price: true,
              },
            },
          },
        },
        invoices: {
          select: {
            id: true,
            totalAmount: true,
            status: true,
          },
        },
      },
    })

    const result = suppliers.map((supplier) => {
      // Total items: count project items assigned to this supplier
      const totalItems = supplier.projectItems.length

      // Total spent: sum of invoice amounts (paid or approved)
      const totalSpent = supplier.invoices
        .filter((inv) => ['paid', 'approved'].includes(inv.status))
        .reduce((sum, inv) => sum + inv.totalAmount, 0)

      // Average delivery days: from purchase request items
      const allDeliveryDays = supplier.purchaseRequests.flatMap((req) =>
        req.items.filter((item) => item.deliveryDays > 0).map((item) => item.deliveryDays),
      )
      const avgDeliveryDays =
        allDeliveryDays.length > 0
          ? Math.round(
              allDeliveryDays.reduce((sum, d) => sum + d, 0) /
                allDeliveryDays.length,
            )
          : 0

      // Completion rate: items with status 'delivered' or 'completed' vs total items
      const completedItems = supplier.projectItems.filter((item) =>
        ['delivered', 'completed'].includes(item.status),
      ).length
      const completionRate =
        totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

      return {
        id: supplier.id,
        name: supplier.name,
        totalItems,
        totalSpent,
        avgDeliveryDays,
        completionRate,
      }
    })

    // Sort by total spent descending
    result.sort((a, b) => b.totalSpent - a.totalSpent)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Analytics suppliers error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch supplier analytics' },
      { status: 500 },
    )
  }
}
