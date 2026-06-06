import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-client'
import { getAuthHeaders } from '@/lib/auth-proxy'
import type { ProjectResponse } from '@/types/fastapi'
import * as XLSX from 'xlsx'

// =============================================================================
// Type Mappings
// =============================================================================

const STATUS_FROM_FASTAPI: Record<string, string> = {
  'Проектирование': 'new',
  'Закупки': 'processing',
  'Оплачено': 'paid',
  'Доставлено': 'delivered',
  'К закупке': 'pending',
  'Заказано': 'ordered',
  'Доступно': 'available',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидание',
  requested: 'Запрошено',
  invoiced: 'Счёт выставлен',
  partial: 'Частично',
  available: 'Доступно',
  ordered: 'Заказано',
  delivered: 'Доставлено',
  completed: 'Завершено',
}

// =============================================================================
// Helper Functions
// =============================================================================

function toCamelCase(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (Array.isArray(obj)) return obj.map(toCamelCase)
  if (typeof obj !== 'object') return obj

  const result: Record<string, any> = {}
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())

    let mappedKey = camelKey
    let mappedValue = value

    if (key === 'client') {
      mappedKey = 'customerName'
    } else if (key === 'total_cost') {
      mappedKey = 'totalCost'
    } else if (key === 'created_at') {
      mappedKey = 'createdAt'
    } else if (key === 'updated_at') {
      mappedKey = 'updatedAt'
    } else if (key === 'project_id') {
      mappedKey = 'projectId'
    } else if (key === 'supplier_id') {
      mappedKey = 'supplierId'
    } else if (key === 'stock_item_id') {
      mappedKey = 'stockItemId'
    }

    if (key === 'status' && typeof value === 'string') {
      mappedValue = STATUS_FROM_FASTAPI[value] || value
    }

    if (typeof mappedValue === 'object' && mappedValue !== null && !Array.isArray(mappedValue)) {
      mappedValue = toCamelCase(mappedValue)
    } else if (Array.isArray(mappedValue)) {
      mappedValue = mappedValue.map(toCamelCase)
    }

    result[mappedKey] = mappedValue
  }
  return result
}

// =============================================================================
// GET /api/projects/[id]/export - Export project to Excel
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch project from FastAPI
    const result = await apiFetch<ProjectResponse>(`/api/projects/${id}`, { headers: getAuthHeaders(request) })

    if (result.error) {
      const statusCode = (result.error.details as any)?.status || 500
      if (statusCode === 404) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      return NextResponse.json(
        { error: result.error.error, details: result.error.details },
        { status: statusCode }
      )
    }

    const project = toCamelCase(result.data)

    // ── Sheet 1: "Позиции" ───────────────────────────────────────────────
    const positionsData = project.items?.map((item: any, index: number) => ({
      '№': index + 1,
      'Наименование': item.name || '',
      'Артикул': item.sku || '',
      'Категория': '', // FastAPI items don't have category
      'Кол-во': item.qty || 0,
      'Ед.': 'шт', // Default unit
      'Поставщик': '', // Supplier name would need separate lookup
      'Цена': 0, // Price not in FastAPI project items
      'Статус': STATUS_LABELS[item.status] || item.status,
      'Примечание': '',
    })) || []

    const wb = XLSX.utils.book_new()
    const ws1 = XLSX.utils.json_to_sheet(positionsData)

    // Set column widths
    ws1['!cols'] = [
      { wch: 5 },   // №
      { wch: 40 },  // Наименование
      { wch: 15 },  // Артикул
      { wch: 15 },  // Категория
      { wch: 8 },   // Кол-во
      { wch: 6 },   // Ед.
      { wch: 25 },  // Поставщик
      { wch: 12 },  // Цена
      { wch: 15 },  // Статус
      { wch: 25 },  // Примечание
    ]

    XLSX.utils.book_append_sheet(wb, ws1, 'Позиции')

    // ── Sheet 2: "По поставщикам" ────────────────────────────────────────
    const bySupplierData: Record<string, string | number>[] = []
    let globalIndex = 0

    // Group items by supplier (simplified for now)
    const supplierGroups = new Map<string, any[]>()
    for (const item of (project.items || [])) {
      const key = 'Поставщик' // Simplified - would need supplier lookup
      if (!supplierGroups.has(key)) {
        supplierGroups.set(key, [])
      }
      supplierGroups.get(key)!.push(item)
    }

    for (const [supplierName, items] of supplierGroups) {
      bySupplierData.push({
        'Поставщик': supplierName,
        'Наименование': '',
        'Кол-во': '',
        'Ед.': '',
        'Цена': '',
        'Сумма': '',
      })

      let subtotal = 0
      for (const item of items) {
        globalIndex++
        const lineTotal = (item.qty || 0) * 0 // Price not available
        subtotal += lineTotal
        bySupplierData.push({
          'Поставщик': '',
          'Наименование': item.name,
          'Кол-во': item.qty || 0,
          'Ед.': 'шт',
          'Цена': 0,
          'Сумма': lineTotal,
        })
      }

      bySupplierData.push({
        'Поставщик': `Итого: ${supplierName}`,
        'Наименование': '',
        'Кол-во': items.reduce((s: number, i: any) => s + (i.qty || 0), 0),
        'Ед.': '',
        'Цена': '',
        'Сумма': subtotal,
      })

      bySupplierData.push({
        'Поставщик': '',
        'Наименование': '',
        'Кол-во': '',
        'Ед.': '',
        'Цена': '',
        'Сумма': '',
      })
    }

    const ws2 = XLSX.utils.json_to_sheet(bySupplierData)
    ws2['!cols'] = [
      { wch: 30 },  // Поставщик
      { wch: 40 },  // Наименование
      { wch: 8 },   // Кол-во
      { wch: 6 },   // Ед.
      { wch: 12 },  // Цена
      { wch: 14 },  // Сумма
    ]

    XLSX.utils.book_append_sheet(wb, ws2, 'По поставщикам')

    // ── Generate buffer ──────────────────────────────────────────────────
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const sanitized = (project.name || 'project').replace(/[^a-zA-Zа-яА-Я0-9_\-\s]/g, '').replace(/\s+/g, '-')

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="project-${sanitized}.xlsx"`,
      },
    })
  } catch (error) {
    console.error('Project export error:', error)
    return NextResponse.json({ error: 'Failed to export project' }, { status: 500 })
  }
}
