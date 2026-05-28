import { db } from '@/lib/db'
import { parseExcelFile } from '@/lib/excel-parser'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const projectName = formData.get('projectName') as string | null

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    if (!projectName || !projectName.trim()) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsedItems = parseExcelFile(buffer)

    if (parsedItems.length === 0) {
      return NextResponse.json({ error: 'No valid items found in Excel file' }, { status: 400 })
    }

    // Collect unique supplier names
    const supplierNames = [...new Set(parsedItems.map((item) => item.supplier).filter((s) => s.trim() !== ''))]

    // Find or create suppliers
    const supplierMap: Record<string, string> = {}

    for (const supplierName of supplierNames) {
      const existing = await db.supplier.findFirst({
        where: { name: supplierName.trim() },
      })

      if (existing) {
        supplierMap[supplierName.trim()] = existing.id
      } else {
        const created = await db.supplier.create({
          data: { name: supplierName.trim() },
        })
        supplierMap[supplierName.trim()] = created.id
      }
    }

    // Create project with items
    const project = await db.project.create({
      data: {
        name: projectName.trim(),
        fileName: file.name,
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
            supplierId: item.supplier.trim() ? supplierMap[item.supplier.trim()] || null : null,
          })),
        },
      },
      include: {
        items: {
          include: { supplier: true },
          orderBy: { rowNumber: 'asc' },
        },
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('Project upload error:', error)
    const message = error instanceof Error ? error.message : 'Failed to upload project'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
