import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET: Returns list of available automation rules and their current status
export async function GET() {
  try {
    const rules = await db.automationRule.findMany({
      orderBy: { createdAt: 'asc' },
    })

    // Also return the default rule definitions for reference
    const ruleDefinitions = DEFAULT_RULE_DEFINITIONS

    return NextResponse.json({
      rules,
      definitions: ruleDefinitions,
    })
  } catch (error) {
    console.error('Error fetching automation rules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch automation rules' },
      { status: 500 }
    )
  }
}

// POST: Creates or updates automation rules
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, type, name, enabled, config } = body

    if (!type) {
      return NextResponse.json(
        { error: 'Rule type is required' },
        { status: 400 }
      )
    }

    // If id is provided, update existing rule
    if (id) {
      const existing = await db.automationRule.findUnique({ where: { id } })
      if (!existing) {
        return NextResponse.json(
          { error: 'Rule not found' },
          { status: 404 }
        )
      }

      const updated = await db.automationRule.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(type !== undefined && { type }),
          ...(enabled !== undefined && { enabled }),
          ...(config !== undefined && { config: typeof config === 'string' ? config : JSON.stringify(config) }),
        },
      })

      return NextResponse.json({ rule: updated })
    }

    // Create new rule
    const newRule = await db.automationRule.create({
      data: {
        name: name || type,
        type,
        enabled: enabled ?? false,
        config: config ? (typeof config === 'string' ? config : JSON.stringify(config)) : '{}',
      },
    })

    return NextResponse.json({ rule: newRule }, { status: 201 })
  } catch (error) {
    console.error('Error creating/updating automation rule:', error)
    return NextResponse.json(
      { error: 'Failed to create/update automation rule' },
      { status: 500 }
    )
  }
}

// Default rule definitions used for reference and seeding
export const DEFAULT_RULE_DEFINITIONS = [
  {
    type: 'auto_create_requests',
    name: 'Автосоздание запросов',
    description: 'При добавлении позиций в проект автоматически создавать запросы поставщикам для позиций с назначенным поставщиком',
    icon: 'FilePlus',
    color: 'emerald',
  },
  {
    type: 'auto_status_transition',
    name: 'Автопереход статуса',
    description: 'Когда все позиции проекта переходят в статус "Счёт выставлен", автоматически перевести проект в статус "Счёт выставлен"',
    icon: 'ArrowRightCircle',
    color: 'sky',
  },
  {
    type: 'auto_warehouse_check',
    name: 'Проверка склада',
    description: 'Перед созданием запросов автоматически проверять наличие товаров на складе и отмечать доступные позиции',
    icon: 'Warehouse',
    color: 'amber',
  },
  {
    type: 'low_stock_alert',
    name: 'Уведомление о низком запасе',
    description: 'Автоматически создавать уведомления при снижении остатков на складе ниже минимального количества',
    icon: 'AlertTriangle',
    color: 'red',
  },
  {
    type: 'invoice_auto_reconcile',
    name: 'Автосверка счетов',
    description: 'Автоматически запускать сверку при изменении статуса счёта на "Получен"',
    icon: 'FileCheck',
    color: 'violet',
  },
]
