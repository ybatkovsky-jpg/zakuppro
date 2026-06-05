import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-client'
import type { InvoiceResponse, InvoiceCreate, InvoiceUpdate } from '@/types/fastapi'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// =============================================================================
// Type Mappings
// =============================================================================

// Prisma (English) -> FastAPI (Russian) status mappings
const STATUS_TO_FASTAPI: Record<string, string> = {
  'received': 'Ожидает сверки',
  'verified': 'Сверен',
  'discrepancy': 'Ошибки',
  'approved': 'Ожидает оплаты',
  'paid': 'Оплачен',
  'cancelled': 'Отменен',
}

const STATUS_FROM_FASTAPI: Record<string, string> = {
  'Ожидает сверки': 'received',
  'Сверен': 'verified',
  'Ошибки': 'discrepancy',
  'Ожидает оплаты': 'approved',
  'Оплачен': 'paid',
  'Отменен': 'cancelled',
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Transform FastAPI snake_case response to camelCase for frontend compatibility
 */
function toCamelCase(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(toCamelCase)
  if (typeof obj !== 'object') return obj

  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())

    let mappedKey = camelKey
    let mappedValue = value

    // Special field mappings
    if (key === 'purchase_order_id') {
      mappedKey = 'purchaseOrderId'
    } else if (key === 'file_url') {
      mappedKey = 'fileUrl'
    } else if (key === 'raw_text') {
      mappedKey = 'rawText'
    } else if (key === 'created_at') {
      mappedKey = 'createdAt'
    } else if (key === 'updated_at') {
      mappedKey = 'updatedAt'
    } else if (key === 'unit_price') {
      mappedKey = 'unitPrice'
    } else if (key === 'total_price') {
      mappedKey = 'totalPrice'
    } else if (key === 'project_item_id') {
      mappedKey = 'projectItemId'
    }

    // Status mapping (FastAPI Russian -> English)
    if (key === 'status' && typeof value === 'string') {
      mappedValue = STATUS_FROM_FASTAPI[value] || value
    }

    // Recurse for nested objects
    if (typeof mappedValue === 'object' && mappedValue !== null) {
      mappedValue = toCamelCase(mappedValue)
    }

    result[mappedKey] = mappedValue
  }
  return result
}

/**
 * Transform camelCase request body to snake_case for FastAPI
 */
function toSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(toSnakeCase)
  if (typeof obj !== 'object') return obj

  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)

    let mappedKey = snakeKey
    let mappedValue = value

    // Special field mappings
    if (key === 'purchaseOrderId') {
      mappedKey = 'purchase_order_id'
    } else if (key === 'fileUrl') {
      mappedKey = 'file_url'
    } else if (key === 'rawText') {
      mappedKey = 'raw_text'
    } else if (key === 'createdAt') {
      mappedKey = 'created_at'
    } else if (key === 'updatedAt') {
      mappedKey = 'updated_at'
    }

    // Status mapping (English -> FastAPI Russian)
    if (key === 'status' && typeof value === 'string') {
      mappedValue = STATUS_TO_FASTAPI[value] || value
    }

    // Recurse for nested objects
    if (typeof mappedValue === 'object' && mappedValue !== null) {
      mappedValue = toSnakeCase(mappedValue)
    }

    result[mappedKey] = mappedValue
  }
  return result
}

/**
 * Find or create a PurchaseOrder for given project and supplier
 * This is needed because FastAPI Invoices require a purchase_order_id
 */
async function findOrCreatePurchaseOrder(projectId: string, supplierId: string): Promise<number | null> {
  try {
    // First, try to find existing Prisma records to get FastAPI IDs
    // This is a temporary solution - in production, all IDs would be synchronized
    const project = await db.project.findUnique({ where: { id: projectId } })
    const supplier = await db.supplier.findUnique({ where: { id: supplierId } })

    if (!project || !supplier) {
      return null
    }

    // For now, we cannot reliably map Prisma string IDs to FastAPI integer IDs
    // This requires a migration to sync the databases
    // Return null to indicate this limitation
    return null
  } catch (error) {
    console.error('Error finding purchase order:', error)
    return null
  }
}

// =============================================================================
// GET /api/invoices - List invoices
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    // FastAPI doesn't support projectId filtering directly
    // We need to fetch from FastAPI and filter locally, or use Prisma as fallback
    // For now, use Prisma as the source of truth for invoices
    // TODO: Migrate to FastAPI once ID mapping is established

    const where = projectId ? { projectId } : {}

    const invoices = await db.invoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        _count: {
          select: { items: true },
        },
      },
    })

    return NextResponse.json(invoices)
  } catch (error) {
    console.error('Invoices list error:', error)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}

// =============================================================================
// POST /api/invoices - Create invoice
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, supplierId, invoiceNumber, totalAmount, items } = body

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }
    if (!supplierId) {
      return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 })
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }

    // For now, create in Prisma
    // TODO: Once PurchaseOrder mapping is established, create via FastAPI
    const invoice = await db.invoice.create({
      data: {
        projectId,
        supplierId,
        invoiceNumber: invoiceNumber?.trim() || '',
        totalAmount: totalAmount || 0,
        items: {
          create: items.map(
            (item: { projectItemId?: string; name: string; quantity: number; price: number }) => ({
              projectItemId: item.projectItemId || null,
              name: item.name,
              quantity: item.quantity,
              price: item.price || 0,
            })
          ),
        },
      },
      include: {
        project: true,
        supplier: true,
        items: { include: { projectItem: true } },
      },
    })

    return NextResponse.json(invoice, { status: 201 })
  } catch (error) {
    console.error('Invoice create error:', error)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}
