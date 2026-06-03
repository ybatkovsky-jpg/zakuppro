import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-client'
import type { SupplierResponse, SupplierCreate } from '@/types/fastapi'

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Transform FastAPI snake_case response to camelCase for frontend compatibility
 * Handles field differences: FastAPI has 'requisites' only, Prisma had
 * phone, contactPerson, address. We map these to/from requisites for compatibility.
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

    if (key === 'created_at') {
      mappedKey = 'createdAt'
    } else if (key === 'updated_at') {
      mappedKey = 'updatedAt'
    }

    // Recurse for nested objects
    if (typeof mappedValue === 'object' && mappedValue !== null && !Array.isArray(mappedValue)) {
      mappedValue = toCamelCase(mappedValue)
    } else if (Array.isArray(mappedValue)) {
      mappedValue = mappedValue.map(toCamelCase)
    }

    result[mappedKey] = mappedValue
  }

  // Add Prisma compatibility fields (from requisites)
  if (result.requisites) {
    // Try to parse requisites as JSON for phone, contactPerson, address
    try {
      const parsed = typeof result.requisites === 'string'
        ? JSON.parse(result.requisites)
        : result.requisites

      if (typeof parsed === 'object' && parsed !== null) {
        result.phone = parsed.phone || ''
        result.contactPerson = parsed.contactPerson || ''
        result.address = parsed.address || ''
      }
    } catch {
      // If not JSON, store as notes
      result.notes = result.requisites
      result.phone = ''
      result.contactPerson = ''
      result.address = ''
    }
  } else {
    // Ensure empty fields for compatibility
    result.phone = result.phone || ''
    result.contactPerson = result.contactPerson || ''
    result.address = result.address || ''
    result.notes = result.notes || ''
  }

  return result
}

/**
 * Transform camelCase request body to snake_case for FastAPI
 * Maps Prisma fields (phone, contactPerson, address) to requisites
 */
function toSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(toSnakeCase)
  if (typeof obj !== 'object') return obj

  const result: Record<string, any> = {}
  const extraFields: Record<string, string> = {}

  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)

    let mappedKey = snakeKey
    let mappedValue = value

    // Collect Prisma-specific fields to store in requisites
    if (key === 'phone' || key === 'contactPerson' || key === 'address' || key === 'notes') {
      extraFields[key] = value
      continue
    }

    if (typeof mappedValue === 'object' && mappedValue !== null) {
      mappedValue = toSnakeCase(mappedValue)
    }

    result[mappedKey] = mappedValue
  }

  // Build requisites from extra fields
  if (Object.keys(extraFields).length > 0) {
    result.requisites = JSON.stringify(extraFields)
  }

  return result
}

// =============================================================================
// GET /api/suppliers - List suppliers
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const skip = searchParams.get('skip')
    const limit = searchParams.get('limit')

    const params: Record<string, string | number> = {}
    if (skip) params.skip = parseInt(skip, 10)
    if (limit) params.limit = parseInt(limit, 10)
    if (search) params.search = search

    const result = await apiFetch<SupplierResponse[]>('/api/suppliers', { params })

    if (result.error) {
      const statusCode = (result.error.details as any)?.status || 500
      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: statusCode }
      )
    }

    // Transform to camelCase and add Prisma compatibility fields
    const transformed = Array.isArray(result.data)
      ? result.data.map(toCamelCase)
      : toCamelCase(result.data)

    // Add _count for compatibility
    const withCounts = Array.isArray(transformed)
      ? (transformed as any[]).map((supplier: any) => ({
          ...supplier,
          _count: { projectItems: 0 }, // FastAPI doesn't provide this
        }))
      : transformed

    return NextResponse.json(withCounts)
  } catch (error) {
    console.error('Suppliers list error:', error)
    return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 })
  }
}

// =============================================================================
// POST /api/suppliers - Create supplier
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, contactPerson, address, notes } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Supplier name is required' }, { status: 400 })
    }

    // Build create data with field mapping
    const supplierData: SupplierCreate = {
      name: name.trim(),
      email: email?.trim() || '',
      requisites: JSON.stringify({
        phone: phone?.trim() || '',
        contactPerson: contactPerson?.trim() || '',
        address: address?.trim() || '',
        notes: notes?.trim() || '',
      }),
    }

    const result = await apiFetch<SupplierResponse>('/api/suppliers', {
      method: 'POST',
      body: supplierData,
    })

    if (result.error) {
      const statusCode = (result.error.details as any)?.status || 500
      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: statusCode }
      )
    }

    const transformed = toCamelCase(result.data)
    return NextResponse.json(transformed, { status: 201 })
  } catch (error) {
    console.error('Supplier create error:', error)
    return NextResponse.json({ error: 'Failed to create supplier' }, { status: 500 })
  }
}
