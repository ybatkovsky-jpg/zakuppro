import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { parseExcelFile } from '@/lib/excel-parser'

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
    const { name, description, customerName, fileData, fileName } = body

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }

    // Если переданы файловые данные (от Telegram Bot), парсим Excel
    if (fileData && typeof fileData === 'string') {
      try {
        const buffer = Buffer.from(fileData, 'base64')
        const parsedItems = parseExcelFile(buffer.buffer as ArrayBuffer)

        if (parsedItems.length === 0) {
          return NextResponse.json({ error: 'Excel файл пуст или не содержит распознаваемых позиций' }, { status: 400 })
        }

        // Создаём проект с позициями из Excel
        const project = await db.project.create({
          data: {
            name: name.trim(),
            description: description?.trim() || '',
            customerName: customerName?.trim() || '',
            fileName: fileName || '',
            items: {
              create: parsedItems.map((item) => ({
                name: item.name,
                article: item.article,
                category: item.category,
                quantity: item.quantity,
                unit: item.unit,
                price: item.price,
                notes: item.notes,
                rowNumber: item.rowNumber,
                status: 'pending' as const,
              })),
            },
          },
          include: {
            _count: { select: { items: true } },
          },
        })

        return NextResponse.json(project, { status: 201 })
      } catch (parseError) {
        console.error('Excel parse error:', parseError)
        return NextResponse.json({ error: `Ошибка парсинга Excel: ${parseError instanceof Error ? parseError.message : 'неизвестная ошибка'}` }, { status: 400 })
      }
    }

    // Обычное создание проекта (без файла)
    const project = await db.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() || '',
        customerName: customerName?.trim() || '',
      },
      include: {
        _count: { select: { items: true } },
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('Project create error:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
}
