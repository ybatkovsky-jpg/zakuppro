import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/projects/[id]/history - Get project status history
 *
 * NOTE: This endpoint uses Prisma directly because FastAPI does not
 * currently have a ProjectStatusHistory endpoint. This should be
 * migrated to FastAPI once the endpoint is available.
 *
 * TODO: Add FastAPI endpoint for project status history and update this route.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const history = await db.projectStatusHistory.findMany({
      where: { projectId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(history)
  } catch (error) {
    console.error('Project history get error:', error)
    return NextResponse.json({ error: 'Failed to fetch project history' }, { status: 500 })
  }
}
