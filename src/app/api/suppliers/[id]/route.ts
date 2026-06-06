import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-client'
import { getAuthHeaders } from '@/lib/auth-proxy'
import type { SupplierResponse, SupplierUpdate } from '@/types/fastapi'

// =============================================================================
// Helper Functions
// =============================================================================

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

    if (typeof mappedValue === 'object' && mappedValue !== null && !Array.isArray(mappedValue)) {
      mappedValue = toCamelCase(mappedValue)
    } else if (Array.isArray(mappedValue)) {
      mappedValue = mappedValue.map(toCamelCase)
    }

    result[mappedKey] = mappedValue
  }

  // Add Prisma compatibility fields from requisites
  if (result.requisites) {
    try {
      const parsed = typeof result.requisites === 'string'
        ? JSON.parse(result.requisites)
        : result.requisites

      if (typeof parsed === 'object' && parsed !== null) {
        result.phone = parsed.phone || ''
        result.contactPerson = parsed.contactPerson || ''
        result.address = parsed.address || ''
        result.notes = parsed.notes || ''
      }
    } catch {
      result.notes = result.requisites
      result.phone = ''
      result.contactPerson = ''
      result.address = ''
    }
  } else {
    result.phone = result.phone || ''
    result.contactPerson = result.contactPerson || ''
    result.address = result.address || ''
    result.notes = result.notes || ''
  }

  return result
}

function buildRequisites(phone?: string, contactPerson?: string, address?: string, notes?: string): string {
  const data: Record<string, string> = {}
  if (phone !== undefined) data.phone = phone.trim()
  if (contactPerson !== undefined) data.contactPerson = contactPerson.trim()
  if (address !== undefined) data.address = address.trim()
  if (notes !== undefined) data.notes = notes.trim()
  return JSON.stringify(data)
}

// =============================================================================
// GET /api/suppliers/[id] - Get single supplier
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await apiFetch<SupplierResponse>(`/api/suppliers/${id}`, { headers: getAuthHeaders(request) })

    if (result.error) {
      const statusCode = (result.error.details as any)?.status || 500
      if (statusCode === 404) {
        return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
      }
      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: statusCode }
      )
    }

    const transformed = toCamelCase(result.data)

    // Add nested data placeholders for compatibility
    const response = {
      ...transformed,
      projectItems: [],
      purchaseRequests: [],
      invoices: [],
      _count: {
        projectItems: 0,
        purchaseRequests: 0,
        invoices: 0,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Supplier get error:', error)
    return NextResponse.json({ error: 'Failed to fetch supplier' }, { status: 500 })
  }
}

// =============================================================================
// PATCH /api/suppliers/[id] - Update supplier
// =============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, email, phone, contactPerson, address, notes } = body

    const updateData: SupplierUpdate = {}

    if (name !== undefined) updateData.name = name.trim()
    if (email !== undefined) updateData.email = email.trim()

    // Combine Prisma fields into requisites
    const hasRequisitesFields =
      phone !== undefined ||
      contactPerson !== undefined ||
      address !== undefined ||
      notes !== undefined

    if (hasRequisitesFields) {
      // First fetch existing to merge requisites
      const existingResult = await apiFetch<SupplierResponse>(`/api/suppliers/${id}`, { headers: getAuthHeaders(request) })
      if (!existingResult.error && existingResult.data) {
        const existing = existingResult.data as any
        let existingRequisites: Record<string, string> = {}

        try {
          if (existing.requisites) {
            existingRequisites = typeof existing.requisites === 'string'
              ? JSON.parse(existing.requisites)
              : existing.requisites
          }
        } catch {
          existingRequisites = {}
        }

        const mergedRequisites = {
          phone: phone !== undefined ? phone.trim() : (existingRequisites.phone || ''),
          contactPerson: contactPerson !== undefined ? contactPerson.trim() : (existingRequisites.contactPerson || ''),
          address: address !== undefined ? address.trim() : (existingRequisites.address || ''),
          notes: notes !== undefined ? notes.trim() : (existingRequisites.notes || ''),
        }

        updateData.requisites = JSON.stringify(mergedRequisites)
      }
    }

    const result = await apiFetch<SupplierResponse>(`/api/suppliers/${id}`, { headers: getAuthHeaders(request),
      method: 'PUT',
      body: updateData,
    })

    if (result.error) {
      const statusCode = (result.error.details as any)?.status || 500
      if (statusCode === 404) {
        return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
      }
      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: statusCode }
      )
    }

    const transformed = toCamelCase(result.data)
    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Supplier update error:', error)
    return NextResponse.json({ error: 'Failed to update supplier' }, { status: 500 })
  }
}

// =============================================================================
// DELETE /api/suppliers/[id] - Delete supplier
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await apiFetch(`/api/suppliers/${id}`, { headers: getAuthHeaders(request),
      method: 'DELETE',
    })

    if (result.error) {
      const statusCode = (result.error.details as any)?.status || 500
      if (statusCode === 404) {
        return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
      }
      // Check for constraint violation (409 equivalent)
      if (typeof result.error.error === 'string' &&
          (result.error.error.includes('constraint') || result.error.error.includes('related'))) {
        return NextResponse.json(
          { error: 'Cannot delete supplier with related items. Remove items first.' },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: statusCode }
      )
    }

    return NextResponse.json({ message: 'Supplier deleted successfully' })
  } catch (error) {
    console.error('Supplier delete error:', error)
    return NextResponse.json({ error: 'Failed to delete supplier' }, { status: 500 })
  }
}
