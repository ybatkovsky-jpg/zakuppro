/**
 * Pipeline Analytics API Route
 * TODO: This route aggregates ProjectItem status counts from Prisma.
 * FastAPI backend does not have an equivalent endpoint yet.
 * Future migration: Fetch ProjectItem data via FastAPI and aggregate here.
 */
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Count project items by status for the procurement pipeline
    const statusCounts = await db.projectItem.groupBy({
      by: ['status'],
      _count: { status: true },
    })

    const counts: Record<string, number> = {}
    for (const item of statusCounts) {
      counts[item.status] = item._count.status
    }

    const total = Object.values(counts).reduce((sum, c) => sum + c, 0)
    const requested = (counts['requested'] ?? 0) + (counts['ordered'] ?? 0)
    const invoiced = (counts['invoiced'] ?? 0) + (counts['partial'] ?? 0)
    const paid = counts['paid'] ?? 0
    const delivered = (counts['delivered'] ?? 0) + (counts['completed'] ?? 0)

    return NextResponse.json({
      total,
      requested,
      invoiced,
      paid,
      delivered,
    })
  } catch (error) {
    console.error('Analytics pipeline error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pipeline data' },
      { status: 500 },
    )
  }
}
