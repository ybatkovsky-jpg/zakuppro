import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-client'
import { getAuthHeaders } from '@/lib/auth-proxy'
import type { StockItemResponse, StockItemCreate, StockItemUpdate } from '@/types/fastapi'

// =============================================================================
// Type Mappings - WarehouseItem (Prisma) <-> StockItem (FastAPI)
// =============================================================================

/**
 * Transform FastAPI StockItem to Prisma WarehouseItem format for frontend compatibility
 * StockItem fields: id, name, sku, qty_total, qty_reserved, qty_available, created_at, updated_at
 * WarehouseItem fields: id, name, article, category, quantity, minQuantity, unit, location, createdAt, updatedAt
 */
function stockItemToWarehouseItem(stockItem: StockItemResponse): Record<string, unknown> {
  return {
    id: String(stockItem.id), // FastAPI uses int, Prisma uses string/cuid
    name: stockItem.name,
    article: stockItem.sku,
    category: '', // Not available in FastAPI
    quantity: stockItem.qty_total,
    minQuantity: 0, // Not available in FastAPI
    unit: 'шт', // Default value
    location: '', // Not available in FastAPI
    createdAt: stockItem.created_at,
    updatedAt: stockItem.updated_at || null,
    // Include FastAPI-specific fields for reference
    _fastapi: {
      qty_reserved: stockItem.qty_reserved,
      qty_available: stockItem.qty_available,
    },
  }
}

/**
 * Transform Prisma WarehouseItem format to FastAPI StockItemCreate format
 */
function warehouseItemToStockItemCreate(body: Record<string, unknown>): StockItemCreate {
  return {
    name: String(body.name || ''),
    sku: String(body.article || ''),
    qty_total: Number(body.quantity || 0),
    qty_reserved: 0, // Default
    qty_available: Number(body.quantity || 0), // Initially same as total
  }
}

/**
 * Transform Prisma WarehouseItem format to FastAPI StockItemUpdate format
 */
function warehouseItemToStockItemUpdate(body: Record<string, unknown>): StockItemUpdate {
  const update: StockItemUpdate = {}

  if (body.name !== undefined) update.name = String(body.name)
  if (body.article !== undefined) update.sku = String(body.article)
  if (body.quantity !== undefined) {
    update.qty_total = Number(body.quantity)
    update.qty_available = Number(body.quantity) // Sync available with total
  }

  return update
}

// =============================================================================
// GET /api/warehouse - List warehouse items (proxies to FastAPI /api/stock_items)
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')

    // FastAPI doesn't have search on stock_items yet, fetch all and filter locally
    const result = await apiFetch<StockItemResponse[]>('/api/stock-items', { headers: getAuthHeaders(request) })

    if (result.error) {
      const statusCode = (result.error.details as any)?.status || 500
      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: statusCode }
      )
    }

    // Transform to WarehouseItem format
    let items = (result.data || []).map(stockItemToWarehouseItem)

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase()
      items = items.filter(
        (item: any) =>
          item.name?.toLowerCase().includes(searchLower) ||
          item.article?.toLowerCase().includes(searchLower)
      )
    }

    // Sort by name (as the original route did)
    items.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''))

    return NextResponse.json(items)
  } catch (error) {
    console.error('Warehouse list error:', error)
    return NextResponse.json({ error: 'Failed to fetch warehouse items' }, { status: 500 })
  }
}

// =============================================================================
// POST /api/warehouse - Create warehouse item (proxies to FastAPI /api/stock_items)
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, article, category, quantity, minQuantity, unit, location } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Item name is required' }, { status: 400 })
    }

    // Transform to StockItemCreate format
    const stockItemData = warehouseItemToStockItemCreate({
      name: name.trim(),
      article: article?.trim() || '',
      quantity: quantity ?? 0,
    })

    // Note: category, minQuantity, unit, location are not supported by FastAPI StockItem
    // These fields are omitted but we could add them to notes if needed in the future

    const result = await apiFetch<StockItemResponse>('/api/stock-items', { headers: getAuthHeaders(request), method: 'POST',
      body: stockItemData,
    })

    if (result.error) {
      const statusCode = (result.error.details as any)?.status || 500
      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: statusCode }
      )
    }

    // Transform response back to WarehouseItem format
    const transformed = stockItemToWarehouseItem(result.data!)

    return NextResponse.json(transformed, { status: 201 })
  } catch (error) {
    console.error('Warehouse item create error:', error)
    return NextResponse.json({ error: 'Failed to create warehouse item' }, { status: 500 })
  }
}
