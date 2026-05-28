import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const where: Record<string, unknown> = {}
    if (status) where.status = status
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { customerName: { contains: search } },
      ]
    }

    const projects = await db.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          select: {
            id: true,
            price: true,
            quantity: true,
            status: true,
          },
        },
        _count: {
          select: { items: true },
        },
      },
    })

    return NextResponse.json(projects)
  } catch (error) {
    console.error('Projects list error:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, description, customerName } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }

    const project = await db.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() || '',
        customerName: customerName?.trim() || '',
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('Project create error:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
