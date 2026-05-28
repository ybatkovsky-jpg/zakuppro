import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const supplierId = searchParams.get('supplierId')

    const where: Record<string, unknown> = {}
    if (projectId) where.projectId = projectId
    if (supplierId) where.supplierId = supplierId

    const logs = await db.emailLog.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      include: {
        project: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error('Email logs list error:', error)
    return NextResponse.json({ error: 'Failed to fetch email logs' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, supplierId, direction, subject, body: emailBody, from, to } = body

    if (!direction || !['outgoing', 'incoming'].includes(direction)) {
      return NextResponse.json({ error: 'Direction must be "outgoing" or "incoming"' }, { status: 400 })
    }
    if (!subject || !subject.trim()) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
    }

    const log = await db.emailLog.create({
      data: {
        projectId: projectId || null,
        supplierId: supplierId || null,
        direction,
        subject: subject.trim(),
        body: emailBody?.trim() || '',
        from: from?.trim() || '',
        to: to?.trim() || '',
      },
      include: {
        project: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(log, { status: 201 })
  } catch (error) {
    console.error('Email log create error:', error)
    return NextResponse.json({ error: 'Failed to create email log' }, { status: 500 })
  }
}
