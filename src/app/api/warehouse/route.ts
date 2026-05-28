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
            { article: { contains: search } },
            { category: { contains: search } },
            { location: { contains: search } },
          ],
        }
      : {}

    const items = await db.warehouseItem.findMany({
      where,
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error('Warehouse list error:', error)
    return NextResponse.json({ error: 'Failed to fetch warehouse items' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, article, category, quantity, minQuantity, unit, location } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Item name is required' }, { status: 400 })
    }

    const item = await db.warehouseItem.create({
      data: {
        name: name.trim(),
        article: article?.trim() || '',
        category: category?.trim() || '',
        quantity: quantity ?? 0,
        minQuantity: minQuantity ?? 0,
        unit: unit?.trim() || 'шт',
        location: location?.trim() || '',
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('Warehouse item create error:', error)
    return NextResponse.json({ error: 'Failed to create warehouse item' }, { status: 500 })
  }
}
