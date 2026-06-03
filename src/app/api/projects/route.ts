import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-client'
import type { ProjectResponse, ProjectCreate, ProjectUpdate } from '@/types/fastapi'

// =============================================================================
// Type Mappings
// =============================================================================

// Prisma (old) -> FastAPI (new) status mappings
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

/**
 * Transform FastAPI snake_case response to camelCase for frontend compatibility
 */
function toCamelCase(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(toCamelCase)
  if (typeof obj !== 'object') return obj

  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    // Map snake_case to camelCase
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())

    // Special field mappings for Prisma compatibility
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
    // camelCase to snake_case
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)

    // Special field mappings
    let mappedKey = snakeKey
    let mappedValue = value

    if (key === 'customerName') {
      mappedKey = 'client'
    } else if (key === 'totalCost') {
      mappedKey = 'total_cost'
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

// =============================================================================
// GET /api/projects - List projects
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const skip = searchParams.get('skip')
    const limit = searchParams.get('limit')

    const params: Record<string, string | number> = {}
    if (skip) params.skip = parseInt(skip, 10)
    if (limit) params.limit = parseInt(limit, 10)
    if (status) {
      // Map English status to Russian for FastAPI
      params.status = STATUS_TO_FASTAPI[status] || status
    }
    if (search) params.search = search

    const result = await apiFetch<ProjectResponse[]>('/api/projects', { params })

    if (result.error) {
      const statusCode = (result.error.details as any)?.status || 500
      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: statusCode }
      )
    }

    // Transform to camelCase for frontend
    const transformed = toCamelCase(result.data)

    // Add _count for compatibility with existing frontend
    const withCounts = Array.isArray(transformed)
      ? (transformed as any[]).map((project: any) => ({
          ...project,
          _count: { items: project.items?.length || 0 },
        }))
      : transformed

    return NextResponse.json(withCounts)
  } catch (error) {
    console.error('Projects list error:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

// =============================================================================
// POST /api/projects - Create project
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, customerName, description, fileData, fileName } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }

    // Handle Excel file upload (parseExcelFile from frontend)
    // For now, we create project without items via FastAPI
    // Excel parsing will be migrated to FastAPI in a future task
    const projectData: ProjectCreate = {
      name: name.trim(),
      client: customerName?.trim() || '',
      status: STATUS_TO_FASTAPI.new,
      total_cost: null,
    }

    const result = await apiFetch<ProjectResponse>('/api/projects', {
      method: 'POST',
      body: projectData,
    })

    if (result.error) {
      const statusCode = (result.error.details as any)?.status || 500
      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: statusCode }
      )
    }

    // Transform response to camelCase
    const transformed = toCamelCase(result.data)
    const responseWithCount = {
      ...transformed,
      _count: { items: 0 },
    }

    return NextResponse.json(responseWithCount, { status: 201 })
  } catch (error) {
    console.error('Project create error:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
