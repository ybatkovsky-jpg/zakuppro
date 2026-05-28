import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    const where = projectId ? { projectId } : {}

    const invoices = await db.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        _count: {
          select: { items: true },
        },
      },
    })

    return NextResponse.json(invoices)
  } catch (error) {
    console.error('Invoices list error:', error)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, supplierId, invoiceNumber, totalAmount, items } = body

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }
    if (!supplierId) {
      return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 })
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }

    const invoice = await db.invoice.create({
      data: {
        projectId,
        supplierId,
        invoiceNumber: invoiceNumber?.trim() || '',
        totalAmount: totalAmount || 0,
        items: {
          create: items.map(
            (item: { projectItemId?: string; name: string; quantity: number; price: number }) => ({
              projectItemId: item.projectItemId || null,
              name: item.name,
              quantity: item.quantity,
              price: item.price || 0,
            })
          ),
        },
      },
      include: {
        project: true,
        supplier: true,
        items: { include: { projectItem: true } },
      },
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error('Invoice create error:', error)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}
