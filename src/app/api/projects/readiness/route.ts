import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-client'
import { getAuthHeaders } from '@/lib/auth-proxy'
import type { ProjectReadinessResponse } from '@/types/fastapi'

/**
 * GET /api/projects/readiness - Per-project readiness with item counts by procurement stage.
 *
 * Proxies to FastAPI GET /api/projects/readiness on the internal backend.
 * The readiness response is already flat (no nested objects needing camelCase
 * conversion) — readiness/breakdown keys are already camelCase-friendly.
 */

export async function GET(request: NextRequest) {
  try {
    const result = await apiFetch<ProjectReadinessResponse[]>('/api/projects/readiness', { headers: getAuthHeaders(request) })

    if (result.error) {
      const statusCode =
        result.error.error === 'Not authenticated' ? 401
        : result.error.error === 'Not authorized' ? 403
        : 500

      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: statusCode }
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error('Project readiness error:', error)
    return NextResponse.json({ error: 'Failed to fetch project readiness' }, { status: 500 })
  }
}
