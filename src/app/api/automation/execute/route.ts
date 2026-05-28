import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// POST: Executes a specific automation rule on demand
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { ruleId, type } = body

    // Find the rule either by ID or type
    let rule
    if (ruleId) {
      rule = await db.automationRule.findUnique({ where: { id: ruleId } })
    } else if (type) {
      rule = await db.automationRule.findFirst({ where: { type } })
    }

    if (!rule) {
      return NextResponse.json(
        { error: 'Правило автоматизации не найдено' },
        { status: 404 }
      )
    }

    // Execute the rule
    const result = await executeRule(rule.type)

    // Update rule stats
    await db.automationRule.update({
      where: { id: rule.id },
      data: {
        lastRunAt: new Date(),
        runCount: { increment: 1 },
      },
    })

    return NextResponse.json({
      success: true,
      ruleType: rule.type,
      ruleName: rule.name,
      result,
      executedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error executing automation rule:', error)
    return NextResponse.json(
      { error: 'Failed to execute automation rule' },
      { status: 500 }
    )
  }
}

async function executeRule(type: string): Promise<{
  message: string
  itemsAffected: number
  details: string[]
}> {
  switch (type) {
    case 'auto_create_requests':
      return await executeAutoCreateRequests()
    case 'auto_status_transition':
      return await executeAutoStatusTransition()
    case 'auto_warehouse_check':
      return await executeAutoWarehouseCheck()
    case 'low_stock_alert':
      return await executeLowStockAlert()
    case 'invoice_auto_reconcile':
      return await executeInvoiceAutoReconcile()
    default:
      return {
        message: 'Неизвестный тип правила',
        itemsAffected: 0,
        details: [],
      }
  }
}

// Rule 1: Auto-create purchase requests for project items that have assigned suppliers
async function executeAutoCreateRequests() {
  // Find project items with suppliers but no purchase request items
  const itemsWithoutRequests = await db.projectItem.findMany({
    where: {
      supplierId: { not: null },
      status: 'pending',
      requestItems: { none: {} },
    },
    include: {
      project: true,
      supplier: true,
    },
  })

  // Group by project+supplier
  const groups = new Map<string, typeof itemsWithoutRequests>()
  for (const item of itemsWithoutRequests) {
    const key = `${item.projectId}-${item.supplierId}`
    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(item)
  }

  const details: string[] = []
  let created = 0

  for (const [, items] of groups) {
    if (items.length === 0) continue
    const first = items[0]

    await db.purchaseRequest.create({
      data: {
        projectId: first.projectId,
        supplierId: first.supplierId!,
        status: 'draft',
        emailTo: first.supplier?.email || '',
        emailSubject: `Запрос цен: ${first.project.name}`,
        notes: 'Автоматически создано правилом автоматизации',
        items: {
          create: items.map(item => ({
            projectItemId: item.id,
            quantity: item.quantity,
            price: item.price,
            available: false,
            availableQty: 0,
            deliveryDays: 0,
          })),
        },
      },
    })

    // Update item status to 'requested'
    for (const item of items) {
      await db.projectItem.update({
        where: { id: item.id },
        data: { status: 'requested' },
      })
    }

    created += items.length
    details.push(`${first.supplier?.name}: ${items.length} поз. (${first.project.name})`)
  }

  return {
    message: created > 0
      ? `Создано запросов для ${created} позиций`
      : 'Нет позиций для автоматического создания запросов',
    itemsAffected: created,
    details,
  }
}

// Rule 2: Auto-transition project status when all items are invoiced
async function executeAutoStatusTransition() {
  const projects = await db.project.findMany({
    where: {
      status: { in: ['processing', 'requested'] },
    },
    include: {
      items: true,
    },
  })

  const details: string[] = []
  let transitions = 0

  for (const project of projects) {
    if (project.items.length === 0) continue

    const allInvoiced = project.items.every(
      item => item.status === 'invoiced' || item.status === 'delivered' || item.status === 'completed'
    )

    if (allInvoiced) {
      await db.project.update({
        where: { id: project.id },
        data: { status: 'invoiced' },
      })

      await db.projectStatusHistory.create({
        data: {
          projectId: project.id,
          status: 'invoiced',
          fromStatus: project.status,
          toStatus: 'invoiced',
          comment: 'Автоматический переход: все позиции в статусе "Счёт выставлен"',
          changedBy: 'Автоматизация',
        },
      })

      transitions++
      details.push(`${project.name}: ${project.status} → invoiced`)
    }
  }

  return {
    message: transitions > 0
      ? `Переведено проектов: ${transitions}`
      : 'Нет проектов для автоматического перехода статуса',
    itemsAffected: transitions,
    details,
  }
}

// Rule 3: Check warehouse for available items before creating purchase requests
async function executeAutoWarehouseCheck() {
  const pendingItems = await db.projectItem.findMany({
    where: {
      status: 'pending',
      isFromWarehouse: false,
    },
    include: {
      project: true,
    },
  })

  const warehouseItems = await db.warehouseItem.findMany()
  const warehouseMap = new Map<string, typeof warehouseItems[0]>()

  for (const w of warehouseItems) {
    if (w.article) {
      warehouseMap.set(w.article.toLowerCase(), w)
    }
    warehouseMap.set(w.name.toLowerCase(), w)
  }

  const details: string[] = []
  let marked = 0

  for (const item of pendingItems) {
    const byArticle = item.article ? warehouseMap.get(item.article.toLowerCase()) : null
    const byName = warehouseMap.get(item.name.toLowerCase())
    const warehouseItem = byArticle || byName

    if (warehouseItem && warehouseItem.quantity >= item.quantity) {
      await db.projectItem.update({
        where: { id: item.id },
        data: {
          isFromWarehouse: true,
          status: 'available',
          notes: `Найдено на складе: ${warehouseItem.quantity} ${warehouseItem.unit}`,
        },
      })

      marked++
      details.push(`${item.name}: ${warehouseItem.quantity} ${warehouseItem.unit} на складе`)
    }
  }

  return {
    message: marked > 0
      ? `Найдено на складе: ${marked} позиций`
      : 'Нет позиций, доступных на складе',
    itemsAffected: marked,
    details,
  }
}

// Rule 4: Create alerts for low-stock warehouse items
async function executeLowStockAlert() {
  const lowStockItems = await db.warehouseItem.findMany({
    where: {
      quantity: { lte: 0 },
    },
  })

  const belowMinItems = await db.warehouseItem.findMany({
    where: {
      quantity: { gt: 0 },
      minQuantity: { gt: 0 },
    },
  })

  const lowItems = belowMinItems.filter(item => item.quantity < item.minQuantity)
  const allLowStock = [...lowStockItems, ...lowItems]

  const details = allLowStock.map(item => {
    if (item.quantity <= 0) {
      return `${item.name}: нет в наличии (мин. ${item.minQuantity})`
    }
    return `${item.name}: ${item.quantity} ${item.unit} (мин. ${item.minQuantity})`
  })

  return {
    message: allLowStock.length > 0
      ? `Найдено позиций с низким запасом: ${allLowStock.length}`
      : 'Все позиции склада в норме',
    itemsAffected: allLowStock.length,
    details,
  }
}

// Rule 5: Auto-start reconciliation for received invoices
async function executeInvoiceAutoReconcile() {
  const receivedInvoices = await db.invoice.findMany({
    where: { status: 'received' },
    include: {
      supplier: true,
      project: true,
    },
  })

  const details: string[] = []
  let processed = 0

  for (const invoice of receivedInvoices) {
    // Simulate reconciliation by setting status to 'verified' if invoice has items
    const items = await db.invoiceItem.findMany({
      where: { invoiceId: invoice.id },
    })

    if (items.length > 0) {
      const allMatch = items.every(item => item.isMatch)

      await db.invoice.update({
        where: { id: invoice.id },
        data: {
          status: allMatch ? 'verified' : 'discrepancy',
          notes: allMatch
            ? 'Автоматическая сверка: все позиции совпадают'
            : `Автоматическая сверка: расхождения в ${items.filter(i => !i.isMatch).length} позициях`,
        },
      })

      processed++
      details.push(`${invoice.invoiceNumber}: ${allMatch ? 'совпадает' : 'есть расхождения'}`)
    }
  }

  return {
    message: processed > 0
      ? `Обработано счетов: ${processed}`
      : 'Нет полученных счетов для автоматической сверки',
    itemsAffected: processed,
    details,
  }
}
