/**
 * Export data as a CSV file with proper Russian character encoding (UTF-8 BOM).
 */

interface ColumnDef {
  key: string
  header: string
}

function escapeCSV(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value)
  // If the string contains a comma, double quote, or newline, wrap it in quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string,
  columns: ColumnDef[],
): void {
  // UTF-8 BOM for proper Russian character encoding in Excel
  const BOM = '\uFEFF'

  // Header row
  const headerRow = columns.map((col) => escapeCSV(col.header)).join(',')

  // Data rows
  const dataRows = data.map((row) =>
    columns.map((col) => escapeCSV(row[col.key])).join(','),
  )

  const csvContent = BOM + headerRow + '\n' + dataRows.join('\n')

  // Create blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
