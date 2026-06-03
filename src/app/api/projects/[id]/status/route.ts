import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-client'
import type { ProjectUpdate } from '@/types/fastapi'

// =============================================================================
// Type Mappings
// =============================================================================

const STATUS_TO_FASTAPI: Record<string, string> = {
  'new': 'Проектирование',
  'processing': 'Закупки',
  'paid': 'Оплачено',
  'delivered': 'Доставлено',
  'cancelled': 'Отменен',
  'requested': 'Закупки',
  'invoiced': 'На оплате',
  'completed': 'Завершен',
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  'new': ['processing', 'cancelled'],
  'processing': ['requested', 'cancelled'],
  'requested': ['invoiced', 'processing', 'cancelled'],
  'invoiced': ['paid', 'requested', 'cancelled'],
  'paid': ['delivered', 'invoiced'],
  'delivered': ['completed', 'paid'],
  'completed': [],
  'cancelled': [],
}

const MANDATORY_COMMENT_TRANSITIONS = ['cancelled']

// =============================================================================
// Helper Functions
// =============================================================================

function getRussianStatus(englishStatus: string): string {
  return STATUS_TO_FASTAPI[englishStatus] || englishStatus
}

// =============================================================================
// POST /api/projects/[id]/status - Update project status
// =============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { status, comment, changedAt } = body

    if (!status) {
      return NextResponse.json(
        { error: 'Не указан новый статус' },
        { status: 400 }
      )
    }

    // First, fetch the current project to validate transition
    const currentResult = await apiFetch(`/api/projects/${id}`)

    if (currentResult.error) {
      const statusCode = (currentResult.error.details as any)?.status || 500
      if (statusCode === 404) {
        return NextResponse.json(
          { error: 'Проект не найден' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: currentResult.error.error, details: currentResult.error.details },
        { status: statusCode }
      )
    }

    const currentProject: any = currentResult.data
    const currentStatus = currentProject.status

    // Validate transition (using English status codes)
    const allowedTransitions = VALID_TRANSITIONS[currentStatus as keyof typeof VALID_TRANSITIONS] || []
    if (!allowedTransitions.includes(status)) {
      return NextResponse.json(
        {
          error: `Недопустимый переход статуса: ${currentStatus} → ${status}`,
          allowedTransitions,
        },
        { status: 400 }
      )
    }

    // Validate mandatory comment
    if (MANDATORY_COMMENT_TRANSITIONS.includes(status) && !comment?.trim()) {
      return NextResponse.json(
        { error: 'Для данного перехода необходимо указать причину' },
        { status: 400 }
      )
    }

    // Update project status via FastAPI
    const updateData: ProjectUpdate = {
      status: getRussianStatus(status),
    }

    const result = await apiFetch(`/api/projects/${id}`, {
      method: 'PUT',
      body: updateData,
    })

    if (result.error) {
      const statusCode = (result.error.details as any)?.status || 500
      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: statusCode }
      )
    }

    return NextResponse.json({
      success: true,
      fromStatus: currentStatus,
      toStatus: status,
      message: `Статус проекта изменен: ${currentStatus} → ${status}`,
    })
  } catch (error) {
    console.error('Status change error:', error)
    return NextResponse.json(
      { error: 'Ошибка изменения статуса' },
      { status: 500 }
    )
  }
}
