import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const supplierId = searchParams.get('supplierId')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = {}
    if (projectId) where.projectId = projectId
    if (supplierId) where.supplierId = supplierId
    if (status) where.status = status

    const requests = await db.purchaseRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        project: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true, email: true } },
        items: {
          include: {
            projectItem: true,
          },
        },
      },
    })

    return NextResponse.json(requests)
  } catch (error) {
    console.error('Requests list error:', error)
    return NextResponse.json({ error: 'Failed to fetch purchase requests' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, supplierId, emailTo, emailSubject, items } = body

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }
    if (!supplierId) {
      return NextResponse.json({ error: 'Supplier ID is required' }, { status: 400 })
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }

    // ── Fetch project and supplier details ────────────────────────────────
    const [project, supplier, company] = await Promise.all([
      db.project.findUnique({
        where: { id: projectId },
        include: { items: { where: { id: { in: items.map((i: { projectItemId: string }) => i.projectItemId) } } } },
      }),
      db.supplier.findUnique({ where: { id: supplierId } }),
      db.companyDetails.findFirst({ where: { isDefault: true } }),
    ])

    // ── Auto-generate email template ──────────────────────────────────────
    let generatedEmailBody = emailBody || ''

    if (supplier && project && items.length > 0) {
      const supplierName = supplier.name
      const projectName = project.name

      // Build items table for the email
      const itemRows = project.items
        .map((pi, idx) => {
          const reqItem = items.find((i: { projectItemId: string }) => i.projectItemId === pi.id)
          if (!reqItem) return null
          return `  ${idx + 1}. ${pi.name}${pi.article ? ` (арт. ${pi.article})` : ''} — ${reqItem.quantity} ${pi.unit}`
        })
        .filter(Boolean)
        .join('\n')

      const companyName = company?.companyName || ''
      const companyInn = company?.inn || ''
      const companyKpp = company?.kpp || ''
      const companyAddress = company?.address || ''
      const companyBankName = company?.bankName || ''
      const companyBankAccount = company?.bankAccount || ''
      const companyKorAccount = company?.korAccount || ''
      const companyBik = company?.bik || ''
      const companyEmail = company?.email || ''
      const companyPhone = company?.phone || ''

      generatedEmailBody =
        `Добрый день, ${supplierName}!\n\n` +
        `Просим предоставить информацию о наличии и ценах на следующие позиции по проекту «${projectName}»:\n\n` +
        itemRows + '\n\n' +
        `Просим указать:\n` +
        `  — Наличие на складе и доступное количество\n` +
        `  — Актуальную цену с НДС\n` +
        `  — Срок поставки\n\n` +
        `---\n` +
        `${companyName}\n` +
        `ИНН: ${companyInn}${companyKpp ? `, КПП: ${companyKpp}` : ''}\n` +
        `Адрес: ${companyAddress}\n` +
        (companyBankName ? `Банк: ${companyBankName}\nР/с: ${companyBankAccount}\nК/с: ${companyKorAccount}\nБИК: ${companyBik}\n` : '') +
        `Email: ${companyEmail}\n` +
        `Тел.: ${companyPhone}\n`
    }

    const purchaseRequest = await db.purchaseRequest.create({
      data: {
        projectId,
        supplierId,
        emailTo: emailTo?.trim() || supplier?.email || '',
        emailSubject: emailSubject?.trim() || '',
        emailBody: generatedEmailBody,
        items: {
          create: items.map((item: { projectItemId: string; quantity: number; price: number }) => ({
            projectItemId: item.projectItemId,
            quantity: item.quantity,
            price: item.price || 0,
          })),
        },
      },
      include: {
        project: true,
        supplier: true,
        items: { include: { projectItem: true } },
      },
    })

    return NextResponse.json(purchaseRequest, { status: 201 })
  } catch (error) {
    console.error('Request create error:', error)
    return NextResponse.json({ error: 'Failed to create purchase request' }, { status: 500 })
  }
}
