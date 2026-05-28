import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const purchaseRequest = await db.purchaseRequest.findUnique({
      where: { id },
      include: {
        project: true,
        supplier: true,
        items: {
          include: {
            projectItem: true,
          },
        },
      },
    })

    if (!purchaseRequest) {
      return NextResponse.json({ error: 'Purchase request not found' }, { status: 404 })
    }

    return NextResponse.json(purchaseRequest)
  } catch (error) {
    console.error('Request get error:', error)
    return NextResponse.json({ error: 'Failed to fetch purchase request' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, emailTo, emailSubject, emailBody, notes, responseItems } = body

    const existing = await db.purchaseRequest.findUnique({
      where: { id },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Purchase request not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (status !== undefined) data.status = status
    if (emailTo !== undefined) data.emailTo = emailTo.trim()
    if (emailSubject !== undefined) data.emailSubject = emailSubject.trim()
    if (emailBody !== undefined) data.emailBody = emailBody.trim()
    if (notes !== undefined) data.notes = notes.trim()

    // Set timestamps based on status changes
    if (status === 'sent' && existing.status !== 'sent') {
      data.sentAt = new Date()
    }
    if (status === 'responded' && existing.status !== 'responded') {
      data.responseAt = new Date()
    }

    const purchaseRequest = await db.purchaseRequest.update({
      where: { id },
      data,
      include: {
        project: true,
        supplier: true,
        items: { include: { projectItem: true } },
      },
    })

    // Update individual response items if provided
    if (responseItems && Array.isArray(responseItems)) {
      for (const respItem of responseItems) {
        await db.purchaseRequestItem.update({
          where: { id: respItem.id },
          data: {
            available: respItem.available ?? undefined,
            availableQty: respItem.availableQty ?? undefined,
            deliveryDays: respItem.deliveryDays ?? undefined,
            price: respItem.price ?? undefined,
            notes: respItem.notes ?? undefined,
          },
        })
      }
    }

    return NextResponse.json(purchaseRequest)
  } catch (error) {
    console.error('Request update error:', error)
    return NextResponse.json({ error: 'Failed to update purchase request' }, { status: 500 })
  }
}
