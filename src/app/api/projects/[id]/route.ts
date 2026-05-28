import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const project = await db.project.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            supplier: true,
          },
          orderBy: { rowNumber: 'asc' },
        },
        purchaseRequests: {
          include: {
            supplier: true,
            items: { include: { projectItem: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        invoices: {
          include: {
            supplier: true,
            items: { include: { projectItem: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('Project get error:', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, description, status, customerName } = body

    const existing = await db.project.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name.trim()
    if (description !== undefined) data.description = description.trim()
    if (status !== undefined) data.status = status
    if (customerName !== undefined) data.customerName = customerName.trim()

    const project = await db.project.update({
      where: { id },
      data,
    })

    // Create status history entry if status changed
    if (status !== undefined && status !== existing.status) {
      await db.projectStatusHistory.create({
        data: {
          projectId: id,
          status,
          notes: `Статус изменен: ${existing.status} → ${status}`,
        },
      })
    }

    return NextResponse.json(project)
  } catch (error) {
    console.error('Project update error:', error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await db.project.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    await db.project.delete({ where: { id } })

    return NextResponse.json({ message: 'Project deleted successfully' })
  } catch (error) {
    console.error('Project delete error:', error)
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 })
  }
}
