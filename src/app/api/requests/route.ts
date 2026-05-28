import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const supplierId = searchParams.get('supplierId')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (projectId) where.projectId = projectId
    if (supplierId) where.supplierId = supplierId
    if (status) where.status = status

    const requests = await db.purchaseRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            projectItem: true,
          },
        },
      },
    })

    return NextResponse.json(requests)
  } catch (error) {
    console.error('Requests list error:', error)
    return NextResponse.json({ error: 'Failed to fetch purchase requests' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, supplierId, emailTo, emailSubject, emailBody, items } = body

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }
    if (!supplierId) {
      return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 })
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }

    const purchaseRequest = await db.purchaseRequest.create({
      data: {
        projectId,
        supplierId,
        emailTo: emailTo?.trim() || '',
        emailSubject: emailSubject?.trim() || '',
        emailBody: emailBody?.trim() || '',
        items: {
          create: items.map((item: { projectItemId: string; quantity: number; price: number }) => ({
            projectItemId: item.projectItemId,
            quantity: item.quantity,
            price: item.price || 0,
          })),
        },
      },
      include: {
        project: true,
        supplier: true,
        items: { include: { projectItem: true } },
      },
    })

    return NextResponse.json(purchaseRequest, { status: 201 })
  } catch (error) {
    console.error('Request create error:', error)
    return NextResponse.json({ error: 'Failed to create purchase request' }, { status: 500 })
  }
}
