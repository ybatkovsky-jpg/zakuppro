import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, article, category, quantity, minQuantity, unit, location } = body

    const existing = await db.warehouseItem.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Warehouse item not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name.trim()
    if (article !== undefined) data.article = article.trim()
    if (category !== undefined) data.category = category.trim()
    if (quantity !== undefined) data.quantity = quantity
    if (minQuantity !== undefined) data.minQuantity = minQuantity
    if (unit !== undefined) data.unit = unit.trim()
    if (location !== undefined) data.location = location.trim()

    const item = await db.warehouseItem.update({
      where: { id },
      data,
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error('Warehouse item update error:', error)
    return NextResponse.json({ error: 'Failed to update warehouse item' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.warehouseItem.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Warehouse item not found' }, { status: 404 })
    }

    await db.warehouseItem.delete({ where: { id } })

    return NextResponse.json({ message: 'Warehouse item deleted successfully' })
  } catch (error) {
    console.error('Warehouse item delete error:', error)
    return NextResponse.json({ error: 'Failed to delete warehouse item' }, { status: 500 })
  }
}
