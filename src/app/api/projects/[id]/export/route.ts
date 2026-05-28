import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидание',
  requested: 'Запрошено',
  invoiced: 'Счёт выставлен',
  partial: 'Частично',
  available: 'Доступно',
  ordered: 'Заказано',
  delivered: 'Доставлено',
  completed: 'Завершено',
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const project = await db.project.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            supplier: true,
          },
          orderBy: { rowNumber: 'asc' },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // ── Sheet 1: "Позиции" ───────────────────────────────────────────────
    const positionsData = project.items.map((item, index) => ({
      '№': index + 1,
      'Наименование': item.name,
      'Артикул': item.article || '',
      'Категория': item.category || '',
      'Кол-во': item.quantity,
      'Ед.': item.unit,
      'Поставщик': item.supplier?.name || '',
      'Цена': item.price,
      'Статус': STATUS_LABELS[item.status] || item.status,
      'Примечание': item.notes || '',
    }))

    const wb = XLSX.utils.book_new()
    const ws1 = XLSX.utils.json_to_sheet(positionsData)

    // Set column widths
    ws1['!cols'] = [
      { wch: 5 },   // №
      { wch: 40 },  // Наименование
      { wch: 15 },  // Артикул
      { wch: 15 },  // Категория
      { wch: 8 },   // Кол-во
      { wch: 6 },   // Ед.
      { wch: 25 },  // Поставщик
      { wch: 12 },  // Цена
      { wch: 15 },  // Статус
      { wch: 25 },  // Примечание
    ]

    XLSX.utils.book_append_sheet(wb, ws1, 'Позиции')

    // ── Sheet 2: "По поставщикам" ────────────────────────────────────────
    const supplierGroups = new Map<string, typeof project.items>()

    for (const item of project.items) {
      const key = item.supplier?.name || 'Без поставщика'
      if (!supplierGroups.has(key)) {
        supplierGroups.set(key, [])
      }
      supplierGroups.get(key)!.push(item)
    }

    const bySupplierData: Record<string, string | number>[] = []
    let globalIndex = 0

    for (const [supplierName, items] of supplierGroups) {
      // Supplier header row
      bySupplierData.push({
        'Поставщик': supplierName,
        'Наименование': '',
        'Кол-во': '',
        'Ед.': '',
        'Цена': '',
        'Сумма': '',
      })

      let subtotal = 0
      for (const item of items) {
        globalIndex++
        const lineTotal = item.quantity * item.price
        subtotal += lineTotal
        bySupplierData.push({
          'Поставщик': '',
          'Наименование': item.name,
          'Кол-во': item.quantity,
          'Ед.': item.unit,
          'Цена': item.price,
          'Сумма': lineTotal,
        })
      }

      // Subtotal row
      bySupplierData.push({
        'Поставщик': `Итого: ${supplierName}`,
        'Наименование': '',
        'Кол-во': items.reduce((s, i) => s + i.quantity, 0),
        'Ед.': '',
        'Цена': '',
        'Сумма': subtotal,
      })

      // Empty separator row
      bySupplierData.push({
        'Поставщик': '',
        'Наименование': '',
        'Кол-во': '',
        'Ед.': '',
        'Цена': '',
        'Сумма': '',
      })
    }

    const ws2 = XLSX.utils.json_to_sheet(bySupplierData)
    ws2['!cols'] = [
      { wch: 30 },  // Поставщик
      { wch: 40 },  // Наименование
      { wch: 8 },   // Кол-во
      { wch: 6 },   // Ед.
      { wch: 12 },  // Цена
      { wch: 14 },  // Сумма
    ]

    XLSX.utils.book_append_sheet(wb, ws2, 'По поставщикам')

    // ── Generate buffer ──────────────────────────────────────────────────
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const sanitized = project.name.replace(/[^a-zA-Zа-яА-Я0-9_\-\s]/g, '').replace(/\s+/g, '-')

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="project-${sanitized}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Project export error:', error)
    return NextResponse.json({ error: 'Failed to export project' }, { status: 500 })
  }
}
