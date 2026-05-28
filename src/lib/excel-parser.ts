import * as XLSX from 'xlsx'

export interface ParsedExcelItem {
  rowNumber: number
  name: string
  article: string
  category: string
  quantity: number
  unit: string
  supplier: string
  price: number
  notes: string
}

export function parseExcelFile(buffer: ArrayBuffer): ParsedExcelItem[] {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]

  if (!worksheet) {
    throw new Error('Не удалось найти лист в Excel файле')
  }

  const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' })

  if (rawData.length === 0) {
    throw new Error('Excel файл пуст')
  }

  const items: ParsedExcelItem[] = rawData.map((row, index) => {
    // Try to find matching columns (flexible matching)
    const name = findColumnValue(row, ['наименование', 'название', 'позиция', 'товар', 'комплектующее', 'деталь', 'name', 'item', 'product', 'description']) as string
    const article = findColumnValue(row, ['артикул', 'код', 'sku', 'article', 'part_number', 'partnumber', 'код_товара']) as string
    const category = findColumnValue(row, ['категория', 'группа', 'тип', 'category', 'group', 'type']) as string
    const quantity = parseNumber(findColumnValue(row, ['количество', 'кол-во', 'кол.', 'qty', 'quantity', 'count', 'amount', 'объем']) as string)
    const unit = findColumnValue(row, ['единица', 'ед.', 'ед.изм', 'unit', 'measure']) as string || 'шт'
    const supplier = findColumnValue(row, ['поставщик', 'vendor', 'supplier', 'продавец', 'partner']) as string
    const price = parseNumber(findColumnValue(row, ['цена', 'стоимость', 'price', 'cost', 'rate']) as string)
    const notes = findColumnValue(row, ['примечание', 'заметка', 'комментарий', 'notes', 'comment', 'remark', 'прим.']) as string

    return {
      rowNumber: index + 1,
      name: String(name || ''),
      article: String(article || ''),
      category: String(category || ''),
      quantity: quantity || 0,
      unit: String(unit || 'шт'),
      supplier: String(supplier || ''),
      price: price || 0,
      notes: String(notes || ''),
    }
  }).filter(item => item.name.trim() !== '')

  return items
}

function findColumnValue(row: Record<string, unknown>, possibleNames: string[]): unknown {
  const keys = Object.keys(row)

  for (const name of possibleNames) {
    const key = keys.find(k => k.toLowerCase().trim().includes(name.toLowerCase()))
    if (key && row[key] !== undefined && row[key] !== '') {
      return row[key]
    }
  }

  return ''
}

function parseNumber(value: string): number {
  if (typeof value === 'number') return value
  if (!value) return 0
  const cleaned = String(value).replace(/[^\d.,-]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}
