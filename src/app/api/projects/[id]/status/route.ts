import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

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

// Transitions that require a mandatory comment
const MANDATORY_COMMENT_TRANSITIONS = ['cancelled']

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

    const existing = await db.project.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json(
        { error: 'Проект не найден' },
        { status: 404 }
      )
    }

    // Validate transition
    const allowedTransitions = VALID_TRANSITIONS[existing.status] ?? []
    if (!allowedTransitions.includes(status)) {
      return NextResponse.json(
        {
          error: `Недопустимый переход статуса: ${existing.status} → ${status}`,
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

    // Update project status
    await db.project.update({
      where: { id },
      data: { status },
    })

    // Create status history entry - store transition info in notes since the new fields might not be available
    const notesText = `Статус изменен: ${existing.status} → ${status}${comment ? ` | Комментарий: ${comment.trim()}` : ''}`

    await db.projectStatusHistory.create({
      data: {
        projectId: id,
        status,
        notes: notesText,
        ...(changedAt ? { createdAt: new Date(changedAt) } : {}),
      },
    })

    return NextResponse.json({
      success: true,
      fromStatus: existing.status,
      toStatus: status,
      message: `Статус проекта изменен: ${existing.status} → ${status}`,
    })
  } catch (error) {
    console.error('Status change error:', error)
    return NextResponse.json(
      { error: 'Ошибка изменения статуса' },
      { status: 500 }
    )
  }
}
