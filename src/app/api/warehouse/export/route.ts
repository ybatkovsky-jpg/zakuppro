import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-client'
import { getAuthHeaders } from '@/lib/auth-proxy'
import type { StockItemResponse } from '@/types/fastapi'
import * as XLSX from 'xlsx'

// =============================================================================
// Type Mappings - WarehouseItem (Prisma) <-> StockItem (FastAPI)
// =============================================================================

/**
 * Transform FastAPI StockItem to Prisma WarehouseItem format for frontend compatibility
 */
function stockItemToWarehouseItem(stockItem: StockItemResponse): Record<string, unknown> {
  return {
    id: String(stockItem.id),
    name: stockItem.name,
    article: stockItem.sku,
    category: '', // Not available in FastAPI
    quantity: stockItem.qty_total,
    minQuantity: 0, // Not available in FastAPI - using default
    unit: 'шт', // Default value
    location: '', // Not available in FastAPI
    createdAt: stockItem.created_at,
    updatedAt: stockItem.updated_at || null,
  }
}

// =============================================================================
// GET /api/warehouse/export - Export warehouse items to Excel
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    // Fetch stock items from FastAPI
    const result = await apiFetch<StockItemResponse[]>('/api/stock-items', { headers: getAuthHeaders(request) })

    if (result.error) {
      console.error('Warehouse export - FastAPI error:', result.error)
      return NextResponse.json({ error: 'Failed to fetch warehouse items for export' }, { status: 500 })
    }

    // Transform to WarehouseItem format
    const items = (result.data || []).map(stockItemToWarehouseItem)

    const statusMap = (qty: number, minQty: number): string => {
      if (qty < minQty) return 'Ниже минимума'
      if (qty === minQty) return 'Минимум'
      return 'В норме'
    }

    const sheetData = items.map((item: any) => ({
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
