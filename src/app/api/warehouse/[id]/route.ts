import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-client'
import { getAuthHeaders } from '@/lib/auth-proxy'
import type { StockItemResponse, StockItemUpdate } from '@/types/fastapi'

// =============================================================================
// Type Mappings - WarehouseItem (Prisma) <-> StockItem (FastAPI)
// =============================================================================

/**
 * Transform FastAPI StockItem to Prisma WarehouseItem format for frontend compatibility
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
// GET /api/warehouse/[id] - Get warehouse item detail (proxies to FastAPI /api/stock_items/{id})
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // FastAPI uses numeric IDs, Prisma uses string IDs
    // Try to parse as number for FastAPI
    const numericId = parseInt(id, 10)
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid warehouse item ID' }, { status: 400 })
    }

    const result = await apiFetch<StockItemResponse>(`/api/stock-items/${numericId}`, { headers: getAuthHeaders(request) })

    if (result.error) {
      const statusCode = (result.error.details as any)?.status || 500
      if (statusCode === 404) {
        return NextResponse.json({ error: 'Warehouse item not found' }, { status: 404 })
      }
      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: statusCode }
      )
    }

    // Transform to WarehouseItem format
    const transformed = stockItemToWarehouseItem(result.data!)

    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Warehouse item get error:', error)
    return NextResponse.json({ error: 'Failed to fetch warehouse item' }, { status: 500 })
  }
}

// =============================================================================
// PATCH /api/warehouse/[id] - Update warehouse item (proxies to FastAPI /api/stock_items/{id})
// =============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, article, category, quantity, minQuantity, unit, location } = body

    // FastAPI uses numeric IDs
    const numericId = parseInt(id, 10)
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid warehouse item ID' }, { status: 400 })
    }

    // Note: category, minQuantity, unit, location are not supported by FastAPI StockItem
    // These fields will be ignored but we preserve them in the response for compatibility

    // Transform to StockItemUpdate format
    const stockItemData = warehouseItemToStockItemUpdate({
      name,
      article,
      quantity,
    })

    const result = await apiFetch<StockItemResponse>(`/api/stock-items/${numericId}`, { headers: getAuthHeaders(request),
      method: 'PATCH',
      body: stockItemData,
    })

    if (result.error) {
      const statusCode = (result.error.details as any)?.status || 500
      if (statusCode === 404) {
        return NextResponse.json({ error: 'Warehouse item not found' }, { status: 404 })
      }
      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: statusCode }
      )
    }

    // Transform response back to WarehouseItem format
    const transformed = stockItemToWarehouseItem(result.data!)

    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Warehouse item update error:', error)
    return NextResponse.json({ error: 'Failed to update warehouse item' }, { status: 500 })
  }
}

// =============================================================================
// DELETE /api/warehouse/[id] - Delete warehouse item (proxies to FastAPI /api/stock_items/{id})
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // FastAPI uses numeric IDs
    const numericId = parseInt(id, 10)
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid warehouse item ID' }, { status: 400 })
    }

    const result = await apiFetch(`/api/stock-items/${numericId}`, { headers: getAuthHeaders(request),
      method: 'DELETE',
    })

    if (result.error) {
      const statusCode = (result.error.details as any)?.status || 500
      if (statusCode === 404) {
        return NextResponse.json({ error: 'Warehouse item not found' }, { status: 404 })
      }
      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: statusCode }
      )
    }

    return NextResponse.json({ message: 'Warehouse item deleted successfully' })
  } catch (error) {
    console.error('Warehouse item delete error:', error)
    return NextResponse.json({ error: 'Failed to delete warehouse item' }, { status: 500 })
  }
}
