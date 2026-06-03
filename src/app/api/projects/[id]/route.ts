import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-client'
import type { ProjectResponse, ProjectUpdate } from '@/types/fastapi'

// =============================================================================
// Type Mappings
// =============================================================================

const STATUS_TO_FASTAPI: Record<string, string> = {
  'new': 'Проектирование',
  'processing': 'Закупки',
  'paid': 'Оплачено',
  'delivered': 'Доставлено',
}

const STATUS_FROM_FASTAPI: Record<string, string> = {
  'Проектирование': 'new',
  'Закупки': 'processing',
  'Оплачено': 'paid',
  'Доставлено': 'delivered',
}

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

    if (key === 'client') {
      mappedKey = 'customerName'
    } else if (key === 'total_cost') {
      mappedKey = 'totalCost'
    } else if (key === 'created_at') {
      mappedKey = 'createdAt'
    } else if (key === 'updated_at') {
      mappedKey = 'updatedAt'
    } else if (key === 'project_id') {
      mappedKey = 'projectId'
    } else if (key === 'supplier_id') {
      mappedKey = 'supplierId'
    } else if (key === 'stock_item_id') {
      mappedKey = 'stockItemId'
    }

    if (key === 'status' && typeof value === 'string') {
      mappedValue = STATUS_FROM_FASTAPI[value] || value
    }

    if (typeof mappedValue === 'object' && mappedValue !== null && !Array.isArray(mappedValue)) {
      mappedValue = toCamelCase(mappedValue)
    } else if (Array.isArray(mappedValue)) {
      mappedValue = mappedValue.map(toCamelCase)
    }

    result[mappedKey] = mappedValue
  }
  return result
}

function toSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(toSnakeCase)
  if (typeof obj !== 'object') return obj

  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)

    let mappedKey = snakeKey
    let mappedValue = value

    if (key === 'customerName') {
      mappedKey = 'client'
    } else if (key === 'totalCost') {
      mappedKey = 'total_cost'
    }

    if (key === 'status' && typeof value === 'string') {
      mappedValue = STATUS_TO_FASTAPI[value] || value
    }

    if (typeof mappedValue === 'object' && mappedValue !== null) {
      mappedValue = toSnakeCase(mappedValue)
    }

    result[mappedKey] = mappedValue
  }
  return result
}

// =============================================================================
// GET /api/projects/[id] - Get single project
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await apiFetch<ProjectResponse>(`/api/projects/${id}`)

    if (result.error) {
      const statusCode = (result.error.details as any)?.status || 500
      if (statusCode === 404) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: statusCode }
      )
    }

    const transformed = toCamelCase(result.data)
    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Project get error:', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

// =============================================================================
// PATCH /api/projects/[id] - Update project (using PUT for FastAPI)
// =============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, status, customerName, totalCost } = body

    const updateData: ProjectUpdate = {}
    if (name !== undefined) updateData.name = name.trim()
    if (customerName !== undefined) updateData.client = customerName.trim()
    if (totalCost !== undefined) updateData.total_cost = totalCost
    if (status !== undefined) {
      updateData.status = STATUS_TO_FASTAPI[status] || status
    }

    const result = await apiFetch<ProjectResponse>(`/api/projects/${id}`, {
      method: 'PUT',
      body: updateData,
    })

    if (result.error) {
      const statusCode = (result.error.details as any)?.status || 500
      if (statusCode === 404) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: statusCode }
      )
    }

    const transformed = toCamelCase(result.data)
    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Project update error:', error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

// =============================================================================
// DELETE /api/projects/[id] - Delete project
// =============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const result = await apiFetch(`/api/projects/${id}`, {
      method: 'DELETE',
    })

    if (result.error) {
      const statusCode = (result.error.details as any)?.status || 500
      if (statusCode === 404) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: statusCode }
      )
    }

    return NextResponse.json({ message: 'Project deleted successfully' })
  } catch (error) {
    console.error('Project delete error:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
