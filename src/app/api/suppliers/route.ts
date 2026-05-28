import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
            { contactPerson: { contains: search } },
          ],
        }
      : {}

    const suppliers = await db.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { projectItems: true },
        },
      },
    })

    return NextResponse.json(suppliers)
  } catch (error) {
    console.error('Suppliers list error:', error)
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, contactPerson, address, notes } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 })
    }

    const supplier = await db.supplier.create({
      data: {
        name: name.trim(),
        email: email?.trim() || '',
        phone: phone?.trim() || '',
        contactPerson: contactPerson?.trim() || '',
        address: address?.trim() || '',
        notes: notes?.trim() || '',
      },
    })

    return NextResponse.json(supplier, { status: 201 })
  } catch (error) {
    console.error('Supplier create error:', error)
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 })
  }
}
