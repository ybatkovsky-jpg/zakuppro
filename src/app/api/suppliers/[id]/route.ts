import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supplier = await db.supplier.findUnique({
      where: { id },
      include: {
        projectItems: {
          include: { project: true },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            purchaseRequests: true,
            invoices: true,
          },
        },
      },
    })

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    return NextResponse.json(supplier)
  } catch (error) {
    console.error('Supplier get error:', error)
    return NextResponse.json({ error: 'Failed to fetch supplier' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, email, phone, contactPerson, address, notes } = body

    const existing = await db.supplier.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name.trim()
    if (email !== undefined) data.email = email.trim()
    if (phone !== undefined) data.phone = phone.trim()
    if (contactPerson !== undefined) data.contactPerson = contactPerson.trim()
    if (address !== undefined) data.address = address.trim()
    if (notes !== undefined) data.notes = notes.trim()

    const supplier = await db.supplier.update({
      where: { id },
      data,
    })

    return NextResponse.json(supplier)
  } catch (error) {
    console.error('Supplier update error:', error)
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.supplier.findUnique({
      where: { id },
      include: { _count: { select: { projectItems: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    if (existing._count.projectItems > 0) {
      return NextResponse.json(
        { error: 'Cannot delete supplier with related items. Remove items first.' },
        { status: 409 }
      )
    }

    await db.supplier.delete({ where: { id } })

    return NextResponse.json({ message: 'Supplier deleted successfully' })
  } catch (error) {
    console.error('Supplier delete error:', error)
    return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 })
  }
}
