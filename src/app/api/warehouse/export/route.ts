import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET() {
  try {
    const items = await db.warehouseItem.findMany({
      orderBy: { name: 'asc' },
    })

    const statusMap = (qty: number, minQty: number): string => {
      if (qty < minQty) return 'Ниже минимума'
      if (qty === minQty) return 'Минимум'
      return 'В норме'
    }

    const sheetData = items.map((item) => ({
      'Наименование': item.name,
      'Артикул': item.article || '',
      'Категория': item.category || '',
      'Количество': item.quantity,
      'Мин. количество': item.minQuantity,
      'Ед.': item.unit,
      'Место хранения': item.location || '',
      'Статус': statusMap(item.quantity, item.minQuantity),
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(sheetData)

    ws['!cols'] = [
      { wch: 40 },  // Наименование
      { wch: 15 },  // Артикул
      { wch: 15 },  // Категория
      { wch: 12 },  // Количество
      { wch: 12 },  // Мин. количество
      { wch: 6 },   // Ед.
      { wch: 20 },  // Место хранения
      { wch: 15 },  // Статус
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Склад')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="warehouse-inventory.xlsx"',
      },
    })
  } catch (error) {
    console.error('Warehouse export error:', error)
    return NextResponse.json({ error: 'Failed to export warehouse inventory' }, { status: 500 })
  }
}
