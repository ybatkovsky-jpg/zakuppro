/**
 * Delivery Detail API Route
 *
 * TODO: M005/S01 - This route was not part of the API migration slice.
 * This endpoint manages individual delivery records stored in Prisma.
 * Future migration: Create equivalent FastAPI delivery endpoints.
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, trackingNumber, carrier, estimatedDate, actualDate, notes } = body

    const updateData: Record<string, unknown> = {}
    if (status !== undefined) updateData.status = status
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber
    if (carrier !== undefined) updateData.carrier = carrier
    if (estimatedDate !== undefined) updateData.estimatedDate = estimatedDate ? new Date(estimatedDate) : null
    if (actualDate !== undefined) updateData.actualDate = actualDate ? new Date(actualDate) : null
    if (notes !== undefined) updateData.notes = notes

    // If status is delivered, set actualDate to now if not provided
    if (status === 'delivered' && !actualDate) {
      updateData.actualDate = new Date()
    }

    const delivery = await db.delivery.update({
      where: { id },
      data: updateData,
      include: {
        project: { select: { id: true, name: true, status: true } },
        supplier: { select: { id: true, name: true, email: true, phone: true } },
        invoice: { select: { id: true, invoiceNumber: true, totalAmount: true } },
      },
    })

    return NextResponse.json(delivery)
  } catch (error) {
    console.error('Error updating delivery:', error)
    return NextResponse.json({ error: 'Ошибка обновления доставки' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.delivery.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting delivery:', error)
    return NextResponse.json({ error: 'Ошибка удаления доставки' }, { status: 500 })
  }
}
