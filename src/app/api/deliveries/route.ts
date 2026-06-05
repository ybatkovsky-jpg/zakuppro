/**
 * Deliveries API Route
 *
 * TODO: M005/S01 - This route was not part of the API migration slice.
 * This endpoint manages delivery tracking stored in Prisma.
 * Future migration: Create equivalent FastAPI delivery endpoints.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (projectId) where.projectId = projectId
    if (status) where.status = status

    const deliveries = await db.delivery.findMany({
      where,
      include: {
        project: { select: { id: true, name: true, status: true } },
        supplier: { select: { id: true, name: true, email: true, phone: true } },
        invoice: { select: { id: true, invoiceNumber: true, totalAmount: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(deliveries)
  } catch (error) {
    console.error('Error fetching deliveries:', error)
    return NextResponse.json({ error: 'Ошибка загрузки доставок' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { projectId, supplierId, invoiceId, status, trackingNumber, carrier, estimatedDate, actualDate, notes } = body

    if (!projectId || !supplierId) {
      return NextResponse.json({ error: 'projectId и supplierId обязательны' }, { status: 400 })
    }

    const delivery = await db.delivery.create({
      data: {
        projectId,
        supplierId,
        invoiceId: invoiceId || null,
        status: status || 'pending',
        trackingNumber: trackingNumber || '',
        carrier: carrier || '',
        estimatedDate: estimatedDate ? new Date(estimatedDate) : null,
        actualDate: actualDate ? new Date(actualDate) : null,
        notes: notes || '',
      },
      include: {
        project: { select: { id: true, name: true, status: true } },
        supplier: { select: { id: true, name: true, email: true, phone: true } },
        invoice: { select: { id: true, invoiceNumber: true, totalAmount: true } },
      },
    })

    return NextResponse.json(delivery, { status: 201 })
  } catch (error) {
    console.error('Error creating delivery:', error)
    return NextResponse.json({ error: 'Ошибка создания доставки' }, { status: 500 })
  }
}
