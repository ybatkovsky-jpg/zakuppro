import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const invoice = await db.invoice.findUnique({
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

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Invoice get error:', error)
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, invoiceNumber, totalAmount, notes, paidAt } = body

    const existing = await db.invoice.findUnique({
      where: { id },
      include: { items: { include: { projectItem: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (invoiceNumber !== undefined) data.invoiceNumber = invoiceNumber.trim()
    if (totalAmount !== undefined) data.totalAmount = totalAmount
    if (notes !== undefined) data.notes = notes.trim()
    if (status !== undefined) data.status = status
    if (paidAt !== undefined) data.paidAt = paidAt ? new Date(paidAt) : null

    // When status changes to "verified", check each item matching
    if (status === 'verified' && existing.status !== 'verified') {
      for (const invoiceItem of existing.items) {
        const projectItem = invoiceItem.projectItem

        if (!projectItem) {
          // No linked project item
          await db.invoiceItem.update({
            where: { id: invoiceItem.id },
            data: {
              isMatch: false,
              mismatchReason: 'Нет связанной позиции проекта',
            },
          })
          continue
        }

        const nameMatches = invoiceItem.name.trim().toLowerCase() === projectItem.name.trim().toLowerCase()
        const quantityMatches = invoiceItem.quantity === projectItem.quantity

        if (nameMatches && quantityMatches) {
          await db.invoiceItem.update({
            where: { id: invoiceItem.id },
            data: {
              isMatch: true,
              mismatchReason: '',
            },
          })
        } else {
          const reasons: string[] = []
          if (!nameMatches) {
            reasons.push(`Наименование не совпадает: счёт="${invoiceItem.name}", проект="${projectItem.name}"`)
          }
          if (!quantityMatches) {
            reasons.push(`Количество не совпадает: счёт=${invoiceItem.quantity}, проект=${projectItem.quantity}`)
          }
          await db.invoiceItem.update({
            where: { id: invoiceItem.id },
            data: {
              isMatch: false,
              mismatchReason: reasons.join('; '),
            },
          })
        }
      }
    }

    const invoice = await db.invoice.update({
      where: { id },
      data,
      include: {
        project: true,
        supplier: true,
        items: { include: { projectItem: true } },
      },
    })

    return NextResponse.json(invoice)
  } catch (error) {
    console.error('Invoice update error:', error)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}
