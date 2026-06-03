/**
 * Search API Route
 *
 * TODO: M005/S01 - This route was not part of the API migration slice.
 * This endpoint performs fuzzy search across multiple Prisma models.
 * Future migration: Create equivalent FastAPI search endpoints.
 */
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export interface SearchResultItem {
  id: string
  name: string
  type: 'project' | 'supplier' | 'invoice' | 'warehouse' | 'request'
  extra: string
  context: string
  status?: string
}

function fuzzyMatch(text: string, query: string): boolean {
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()

  // Direct substring match
  if (lowerText.includes(lowerQuery)) return true

  // Fuzzy: all query chars appear in order within text
  let qi = 0
  for (let ti = 0; ti < lowerText.length && qi < lowerQuery.length; ti++) {
    if (lowerText[ti] === lowerQuery[qi]) qi++
  }

  return qi === lowerQuery.length
}

const STATUS_LABELS: Record<string, string> = {
  // Projects
  new: 'Новый',
  processing: 'В обработке',
  requested: 'Запрошено',
  invoiced: 'Счёт выставлен',
  paid: 'Оплачено',
  delivered: 'Доставлено',
  completed: 'Завершён',
  cancelled: 'Отменён',
  // Invoices
  received: 'Получен',
  verified: 'Проверен',
  discrepancy: 'Расхождение',
  approved: 'Согласован',
  // Requests
  draft: 'Черновик',
  sent: 'Отправлен',
  responded: 'Ответ получен',
  partial: 'Частично',
  // Warehouse
  pending: 'Ожидание',
  ordered: 'Заказано',
  available: 'Доступно',
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')?.trim() || ''
    const category = searchParams.get('category')?.trim() || ''

    if (!query || query.length < 1) {
      return NextResponse.json({ results: [], categories: [] })
    }

    const results: SearchResultItem[] = []

    // Search Projects
    if (!category || category === 'project') {
      const projects = await db.project.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { customerName: { contains: query } },
            { description: { contains: query } },
          ],
        },
        include: {
          _count: { select: { items: true } },
        },
        take: 8,
      })
      for (const p of projects) {
        results.push({
          id: p.id,
          name: p.name,
          type: 'project',
          extra: p.customerName || '',
          context: `${STATUS_LABELS[p.status] || p.status} · ${p._count.items} поз.`,
          status: p.status,
        })
      }
    }

    // Search Suppliers
    if (!category || category === 'supplier') {
      const suppliers = await db.supplier.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { email: { contains: query } },
            { phone: { contains: query } },
            { contactPerson: { contains: query } },
          ],
        },
        include: {
          _count: { select: { projectItems: true } },
        },
        take: 8,
      })
      for (const s of suppliers) {
        results.push({
          id: s.id,
          name: s.name,
          type: 'supplier',
          extra: s.contactPerson || s.email || '',
          context: `${s._count.projectItems} поз. · ${s.phone || 'нет тел.'}`,
        })
      }
    }

    // Search Invoices
    if (!category || category === 'invoice') {
      const invoices = await db.invoice.findMany({
        where: {
          OR: [
            { invoiceNumber: { contains: query } },
            { notes: { contains: query } },
          ],
        },
        include: {
          project: { select: { name: true } },
          supplier: { select: { name: true } },
          _count: { select: { items: true } },
        },
        take: 8,
      })
      for (const inv of invoices) {
        results.push({
          id: inv.id,
          name: inv.invoiceNumber ? `Счёт ${inv.invoiceNumber}` : `Счёт от ${inv.supplier.name}`,
          type: 'invoice',
          extra: inv.supplier.name,
          context: `${STATUS_LABELS[inv.status] || inv.status} · ${inv._count.items} поз. · ${new Intl.NumberFormat('ru-RU').format(inv.totalAmount)} ₽`,
          status: inv.status,
        })
      }
      // Also try fuzzy match by supplier/project name
      if (query.length >= 2) {
        const allInvoices = await db.invoice.findMany({
          include: {
            project: { select: { name: true } },
            supplier: { select: { name: true } },
            _count: { select: { items: true } },
          },
          take: 50,
          orderBy: { createdAt: 'desc' },
        })
        for (const inv of allInvoices) {
          const label = inv.invoiceNumber ? `Счёт ${inv.invoiceNumber}` : `Счёт от ${inv.supplier.name}`
          if (!results.some(r => r.id === inv.id)) {
            if (
              fuzzyMatch(inv.supplier.name, query) ||
              fuzzyMatch(inv.project.name, query) ||
              fuzzyMatch(inv.invoiceNumber, query)
            ) {
              results.push({
                id: inv.id,
                name: label,
                type: 'invoice',
                extra: inv.supplier.name,
                context: `${STATUS_LABELS[inv.status] || inv.status} · ${inv._count.items} поз. · ${new Intl.NumberFormat('ru-RU').format(inv.totalAmount)} ₽`,
                status: inv.status,
              })
            }
          }
        }
      }
    }

    // Search Warehouse
    if (!category || category === 'warehouse') {
      const warehouseItems = await db.warehouseItem.findMany({
        where: {
          OR: [
            { name: { contains: query } },
            { article: { contains: query } },
            { category: { contains: query } },
            { location: { contains: query } },
          ],
        },
        take: 8,
      })
      for (const w of warehouseItems) {
        const stockStatus = w.quantity <= 0 ? 'Нет в наличии' : w.quantity <= w.minQuantity ? 'Низкий остаток' : 'В наличии'
        results.push({
          id: w.id,
          name: w.name,
          type: 'warehouse',
          extra: w.article ? `арт. ${w.article}` : w.category,
          context: `${stockStatus} · ${w.quantity} ${w.unit} на складе`,
        })
      }
      // Fuzzy search by article
      if (query.length >= 2) {
        const allItems = await db.warehouseItem.findMany({ take: 100 })
        for (const w of allItems) {
          if (!results.some(r => r.id === w.id)) {
            if (fuzzyMatch(w.name, query) || fuzzyMatch(w.article, query)) {
              const stockStatus = w.quantity <= 0 ? 'Нет в наличии' : w.quantity <= w.minQuantity ? 'Низкий остаток' : 'В наличии'
              results.push({
                id: w.id,
                name: w.name,
                type: 'warehouse',
                extra: w.article ? `арт. ${w.article}` : w.category,
                context: `${stockStatus} · ${w.quantity} ${w.unit} на складе`,
              })
            }
          }
        }
      }
    }

    // Search Requests
    if (!category || category === 'request') {
      const purchaseRequests = await db.purchaseRequest.findMany({
        where: {
          OR: [
            { notes: { contains: query } },
            { emailTo: { contains: query } },
            { emailSubject: { contains: query } },
          ],
        },
        include: {
          project: { select: { name: true } },
          supplier: { select: { name: true } },
          _count: { select: { items: true } },
        },
        take: 8,
      })
      for (const r of purchaseRequests) {
        results.push({
          id: r.id,
          name: `Запрос: ${r.project.name} → ${r.supplier.name}`,
          type: 'request',
          extra: r.supplier.name,
          context: `${STATUS_LABELS[r.status] || r.status} · ${r._count.items} поз.`,
          status: r.status,
        })
      }
      // Fuzzy by project/supplier name
      if (query.length >= 2) {
        const allRequests = await db.purchaseRequest.findMany({
          include: {
            project: { select: { name: true } },
            supplier: { select: { name: true } },
            _count: { select: { items: true } },
          },
          take: 50,
          orderBy: { createdAt: 'desc' },
        })
        for (const r of allRequests) {
          if (!results.some(res => res.id === r.id)) {
            if (
              fuzzyMatch(r.project.name, query) ||
              fuzzyMatch(r.supplier.name, query) ||
              fuzzyMatch(r.emailTo, query)
            ) {
              results.push({
                id: r.id,
                name: `Запрос: ${r.project.name} → ${r.supplier.name}`,
                type: 'request',
                extra: r.supplier.name,
                context: `${STATUS_LABELS[r.status] || r.status} · ${r._count.items} поз.`,
                status: r.status,
              })
            }
          }
        }
      }
    }

    // Group results by category
    const categories = Array.from(new Set(results.map(r => r.type)))

    return NextResponse.json({ results, categories })
  } catch (error) {
    console.error('Search error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
