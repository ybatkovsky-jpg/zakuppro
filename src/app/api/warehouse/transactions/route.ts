import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const warehouseItemId = searchParams.get('warehouseItemId')

    const where = warehouseItemId ? { warehouseItemId } : {}

    const transactions = await db.warehouseTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        warehouseItem: { select: { id: true, name: true, article: true } },
        projectItem: { select: { id: true, name: true, project: { select: { id: true, name: true } } } },
      },
    })

    return NextResponse.json(transactions)
  } catch (error) {
    console.error('Warehouse transactions list error:', error)
    return NextResponse.json({ error: 'Failed to fetch warehouse transactions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { warehouseItemId, projectItemId, type, quantity, notes } = body

    if (!warehouseItemId) {
      return NextResponse.json({ error: 'Warehouse item ID is required' }, { status: 400 })
    }
    if (!type || !['in', 'out'].includes(type)) {
      return NextResponse.json({ error: 'Type must be "in" or "out"' }, { status: 400 })
    }
    if (!quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be a positive number' }, { status: 400 })
    }

    const warehouseItem = await db.warehouseItem.findUnique({ where: { id: warehouseItemId } })
    if (!warehouseItem) {
      return NextResponse.json({ error: 'Warehouse item not found' }, { status: 404 })
    }

    // Check for out transactions that would go below 0
    if (type === 'out' && warehouseItem.quantity < quantity) {
      return NextResponse.json(
        { error: `Insufficient quantity. Available: ${warehouseItem.quantity}, requested: ${quantity}` },
        { status: 400 }
      )
    }

    // Create transaction and update warehouse item quantity in a transaction
    const transaction = await db.$transaction(async (tx) => {
      const newQuantity = type === 'in'
        ? warehouseItem.quantity + quantity
        : warehouseItem.quantity - quantity

      await tx.warehouseItem.update({
        where: { id: warehouseItemId },
        data: { quantity: newQuantity },
      })

      return tx.warehouseTransaction.create({
        data: {
          warehouseItemId,
          projectItemId: projectItemId || null,
          type,
          quantity,
          notes: notes?.trim() || '',
        },
        include: {
          warehouseItem: { select: { id: true, name: true, article: true } },
          projectItem: { select: { id: true, name: true } },
        },
      })
    })

    return NextResponse.json(transaction, { status: 201 })
  } catch (error) {
    console.error('Warehouse transaction create error:', error)
    return NextResponse.json({ error: 'Failed to create warehouse transaction' }, { status: 500 })
  }
}
