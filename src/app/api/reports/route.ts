import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(n)
}

function formatDate(d: Date | null | string): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return String(d)
  }
}

function formatDateTime(d: Date): string {
  try {
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return d.toISOString()
  }
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    new: 'Новый', processing: 'В обработке', requested: 'Запрошено',
    invoiced: 'Счёт выставлен', paid: 'Оплачено', delivered: 'Доставлено',
    completed: 'Завершён', cancelled: 'Отменён',
    pending: 'Ожидание', shipped: 'Отправлено', in_transit: 'В пути',
    draft: 'Черновик', sent: 'Отправлен', responded: 'Ответ получен',
    received: 'Получен', verified: 'Проверен', discrepancy: 'Расхождение',
    approved: 'Согласован',
  }
  return map[status] || status
}

/** Shared CSS for all reports — print-friendly with ПРОМЕБЕЛЬ branding */
const SHARED_STYLES = `
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    max-width: 960px;
    margin: 0 auto;
    padding: 20px;
    color: #1a1a1a;
    background: #fff;
  }

  /* === ПРОМЕБЕЛЬ Header === */
  .report-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: linear-gradient(135deg, #1a365d 0%, #2b6cb0 100%);
    color: #fff;
    border-radius: 10px;
    margin-bottom: 20px;
  }
  .report-header .brand {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: 1px;
  }
  .report-header .brand-sub {
    font-size: 11px;
    opacity: 0.8;
    margin-top: 2px;
  }
  .report-header .gen-date {
    font-size: 11px;
    text-align: right;
    opacity: 0.85;
    line-height: 1.5;
  }

  /* === Typography === */
  h1 { color: #1a365d; border-bottom: 3px solid #2b6cb0; padding-bottom: 10px; font-size: 22px; margin-top: 0; }
  h2 { color: #2b6cb0; margin-top: 28px; font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; page-break-after: avoid; }
  h3 { color: #4a5568; font-size: 14px; margin-top: 16px; }

  /* === Meta cards === */
  .meta { display: flex; gap: 16px; margin: 16px 0; flex-wrap: wrap; }
  .meta-item { background: #edf2f7; padding: 10px 16px; border-radius: 8px; font-size: 13px; }
  .meta-item strong { display: block; color: #4a5568; font-size: 11px; text-transform: uppercase; margin-bottom: 4px; }

  /* === Summary cards === */
  .summary { display: flex; gap: 16px; margin: 16px 0; flex-wrap: wrap; }
  .summary-card { padding: 12px 18px; border-radius: 8px; border: 1px solid #cbd5e0; }
  .summary-card strong { display: block; font-size: 11px; text-transform: uppercase; color: #4a5568; }
  .summary-card .value { font-size: 20px; font-weight: 700; }

  /* === Tables === */
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  th { background: #2b6cb0; color: white; padding: 8px 12px; text-align: left; font-weight: 600; }
  td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) { background: #f7fafc; }
  .total-row { font-weight: bold; background: #edf2f7 !important; }

  /* === Status badges === */
  .status { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
  .status-new { background: #bee3f8; color: #2b6cb0; }
  .status-processing { background: #e9d8fd; color: #6b46c1; }
  .status-requested { background: #bee3f8; color: #2c5282; }
  .status-invoiced { background: #fefcbf; color: #975a16; }
  .status-paid { background: #c6f6d5; color: #22543d; }
  .status-delivered { background: #c6f6d5; color: #276749; }
  .status-completed { background: #c6f6d5; color: #22543d; }
  .status-cancelled { background: #fed7d7; color: #9b2c2c; }
  .status-pending { background: #e2e8f0; color: #4a5568; }
  .status-shipped { background: #bee3f8; color: #2b6cb0; }
  .status-in_transit { background: #fefcbf; color: #975a16; }

  /* === Footer === */
  .footer {
    margin-top: 40px;
    padding-top: 12px;
    border-top: 2px solid #e2e8f0;
    font-size: 11px;
    color: #718096;
    text-align: center;
  }

  /* === Page break hints === */
  .page-break-before { page-break-before: always; }
  .page-break-after { page-break-after: always; }
  .no-break { page-break-inside: avoid; }

  /* === Print-specific styles === */
  @media print {
    body { padding: 0; max-width: 100%; }
    h1 { font-size: 18px; }
    .report-header {
      background: #1a365d !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      border-radius: 0;
    }
    th {
      background: #2b6cb0 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    tr:nth-child(even) {
      background: #f7fafc !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .total-row {
      background: #edf2f7 !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .status, .summary-card, .meta-item {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print { display: none !important; }
  }
`

/** Shared header HTML for all reports */
function reportHeader(title: string): string {
  const now = new Date()
  return `
  <div class="report-header">
    <div>
      <div class="brand">ПРОМЕБЕЛЬ</div>
      <div class="brand-sub">Управление закупками мебели</div>
    </div>
    <div class="gen-date">
      <div>${title}</div>
      <div>Сформирован: ${formatDateTime(now)}</div>
    </div>
  </div>`
}

/** Shared footer HTML for all reports */
function reportFooter(reportName: string): string {
  return `
  <div class="footer">
    ПРОМЕБЕЛЬ — ${reportName} — сформирован ${formatDateTime(new Date())}<br/>
    Сформировано автоматически
  </div>`
}

async function generateProjectSummary(projectId: string): Promise<string> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      items: { include: { supplier: true } },
      purchaseRequests: { include: { supplier: true, items: { include: { projectItem: true } } } },
      invoices: { include: { supplier: true, items: true } },
      deliveries: { include: { supplier: true } },
      statusHistory: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!project) return '<h1>Проект не найден</h1>'

  const totalBudget = project.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const totalInvoiced = project.invoices.reduce((sum, inv) => sum + inv.totalAmount, 0)

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Отчёт по проекту: ${project.name}</title>
  <style>${SHARED_STYLES}</style>
</head>
<body>
  ${reportHeader('Отчёт по проекту')}

  <h1>📋 Отчёт по проекту</h1>
  <h2 style="border:none; margin-top:4px;">${project.name}</h2>
  ${project.description ? `<p style="color:#4a5568; font-size:13px; margin-top:4px;">${project.description}</p>` : ''}

  <div class="meta">
    <div class="meta-item"><strong>Статус</strong><span class="status status-${project.status}">${getStatusLabel(project.status)}</span></div>
    <div class="meta-item"><strong>Бюджет</strong>${formatCurrency(totalBudget)}</div>
    <div class="meta-item"><strong>Позиций</strong>${project.items.length}</div>
    <div class="meta-item"><strong>Дата создания</strong>${formatDate(project.createdAt)}</div>
  </div>

  <div class="no-break">
    <h2>📦 Позиции проекта</h2>
    <table>
      <thead>
        <tr><th>№</th><th>Наименование</th><th>Артикул</th><th>Поставщик</th><th>Кол-во</th><th>Цена</th><th>Сумма</th><th>Статус</th></tr>
      </thead>
      <tbody>
        ${project.items.map((item, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${item.name}</td>
            <td>${item.article || '—'}</td>
            <td>${item.supplier?.name || '—'}</td>
            <td>${item.quantity} ${item.unit}</td>
            <td>${formatCurrency(item.price)}</td>
            <td>${formatCurrency(item.price * item.quantity)}</td>
            <td><span class="status status-${item.status}">${getStatusLabel(item.status)}</span></td>
          </tr>
        `).join('')}
        <tr class="total-row">
          <td colspan="6" style="text-align:right;">Итого:</td>
          <td>${formatCurrency(totalBudget)}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>

  ${project.invoices.length > 0 ? `
    <div class="page-break-before no-break">
      <h2>🧾 Счета</h2>
      <table>
        <thead><tr><th>№ счёта</th><th>Поставщик</th><th>Сумма</th><th>Статус</th><th>Дата</th></tr></thead>
        <tbody>
          ${project.invoices.map(inv => `
            <tr>
              <td>${inv.invoiceNumber || '—'}</td>
              <td>${inv.supplier.name}</td>
              <td>${formatCurrency(inv.totalAmount)}</td>
              <td><span class="status status-${inv.status}">${getStatusLabel(inv.status)}</span></td>
              <td>${formatDate(inv.receivedAt)}</td>
            </tr>
          `).join('')}
          <tr class="total-row"><td colspan="2" style="text-align:right;">Итого по счетам:</td><td>${formatCurrency(totalInvoiced)}</td><td colspan="2"></td></tr>
        </tbody>
      </table>
    </div>
  ` : ''}

  ${project.deliveries.length > 0 ? `
    <div class="no-break">
      <h2>🚚 Доставки</h2>
      <table>
        <thead><tr><th>Перевозчик</th><th>Трек-номер</th><th>Поставщик</th><th>Статус</th><th>Ожид. дата</th><th>Факт. дата</th></tr></thead>
        <tbody>
          ${project.deliveries.map(d => `
            <tr>
              <td>${d.carrier || '—'}</td>
              <td>${d.trackingNumber || '—'}</td>
              <td>${d.supplier.name}</td>
              <td><span class="status status-${d.status}">${getStatusLabel(d.status)}</span></td>
              <td>${formatDate(d.estimatedDate)}</td>
              <td>${formatDate(d.actualDate)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : ''}

  ${project.statusHistory.length > 0 ? `
    <div class="page-break-before no-break">
      <h2>📜 История изменений</h2>
      <table>
        <thead><tr><th>Дата</th><th>От</th><th>К</th><th>Комментарий</th><th>Автор</th></tr></thead>
        <tbody>
          ${project.statusHistory.map(h => `
            <tr>
              <td>${formatDate(h.createdAt)}</td>
              <td>${getStatusLabel(h.fromStatus)}</td>
              <td>${getStatusLabel(h.toStatus || h.status)}</td>
              <td>${h.comment || '—'}</td>
              <td>${h.changedBy}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : ''}

  ${reportFooter(`Отчёт по проекту «${project.name}»`)}
</body>
</html>`
}

async function generateInvoiceReport(): Promise<string> {
  const invoices = await db.invoice.findMany({
    include: {
      project: { select: { name: true } },
      supplier: { select: { name: true } },
      items: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const totalAmount = invoices.reduce((s, i) => s + i.totalAmount, 0)
  const byStatus = new Map<string, { count: number; amount: number }>()
  invoices.forEach(inv => {
    const entry = byStatus.get(inv.status) || { count: 0, amount: 0 }
    entry.count++
    entry.amount += inv.totalAmount
    byStatus.set(inv.status, entry)
  })

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Отчёт по счетам</title>
  <style>
    ${SHARED_STYLES}
    .summary-card { background: #fffff0; border-color: #d69e2e; }
    .summary-card .value { color: #744210; }
  </style>
</head>
<body>
  ${reportHeader('Отчёт по счетам')}

  <h1>🧾 Отчёт по счетам</h1>

  <div class="summary">
    <div class="summary-card"><strong>Всего счетов</strong><div class="value">${invoices.length}</div></div>
    <div class="summary-card"><strong>Общая сумма</strong><div class="value">${formatCurrency(totalAmount)}</div></div>
  </div>

  ${byStatus.size > 0 ? `
    <div class="no-break">
      <h2>Сводка по статусам</h2>
      <table>
        <thead><tr><th>Статус</th><th>Количество</th><th>Сумма</th></tr></thead>
        <tbody>
          ${Array.from(byStatus.entries()).map(([status, data]) => `
            <tr><td><span class="status status-${status}">${getStatusLabel(status)}</span></td><td>${data.count}</td><td>${formatCurrency(data.amount)}</td></tr>
          `).join('')}
          <tr class="total-row"><td>Итого</td><td>${invoices.length}</td><td>${formatCurrency(totalAmount)}</td></tr>
        </tbody>
      </table>
    </div>
  ` : ''}

  <div class="page-break-before">
    <h2>Все счета</h2>
    <table>
      <thead><tr><th>№</th><th>№ счёта</th><th>Проект</th><th>Поставщик</th><th>Сумма</th><th>Статус</th><th>Дата получения</th><th>Дата оплаты</th></tr></thead>
      <tbody>
        ${invoices.map((inv, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${inv.invoiceNumber || '—'}</td>
            <td>${inv.project.name}</td>
            <td>${inv.supplier.name}</td>
            <td>${formatCurrency(inv.totalAmount)}</td>
            <td><span class="status status-${inv.status}">${getStatusLabel(inv.status)}</span></td>
            <td>${formatDate(inv.receivedAt)}</td>
            <td>${formatDate(inv.paidAt)}</td>
          </tr>
        `).join('')}
        <tr class="total-row"><td colspan="4" style="text-align:right;">Итого:</td><td>${formatCurrency(totalAmount)}</td><td colspan="3"></td></tr>
      </tbody>
    </table>
  </div>

  ${reportFooter('Отчёт по счетам')}
</body>
</html>`
}

async function generateWarehouseReport(): Promise<string> {
  const items = await db.warehouseItem.findMany({ orderBy: { name: 'asc' } })
  const transactions = await db.warehouseTransaction.findMany({
    include: { warehouseItem: true, projectItem: { include: { project: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  const totalItems = items.reduce((s, i) => s + i.quantity, 0)
  const lowStock = items.filter(i => i.minQuantity > 0 && i.quantity < i.minQuantity)
  const outOfStock = items.filter(i => i.quantity <= 0)
  const categories = new Map<string, number>()
  items.forEach(item => {
    const cat = item.category || 'Без категории'
    categories.set(cat, (categories.get(cat) || 0) + 1)
  })

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Отчёт по складу</title>
  <style>
    ${SHARED_STYLES}
    .summary-card.ok { background: #e6fffa; border-color: #319795; }
    .summary-card.ok .value { color: #234e52; }
    .summary-card.warn { background: #fefcbf; border-color: #d69e2e; }
    .summary-card.warn .value { color: #92400e; }
    .summary-card.danger { background: #fed7d7; border-color: #e53e3e; }
    .summary-card.danger .value { color: #9b2c2c; }
    tr.low-stock { background: #fefcbf !important; }
    tr.out-of-stock { background: #fed7d7 !important; }
  </style>
</head>
<body>
  ${reportHeader('Отчёт по складу')}

  <h1>📦 Отчёт по складу</h1>

  <div class="summary">
    <div class="summary-card ok"><strong>Позиций на учёте</strong><div class="value">${items.length}</div></div>
    <div class="summary-card ok"><strong>Общее количество</strong><div class="value">${totalItems}</div></div>
    <div class="summary-card warn"><strong>Низкий запас</strong><div class="value">${lowStock.length}</div></div>
    <div class="summary-card danger"><strong>Нет в наличии</strong><div class="value">${outOfStock.length}</div></div>
  </div>

  ${categories.size > 0 ? `
    <div class="no-break">
      <h2>По категориям</h2>
      <table>
        <thead><tr><th>Категория</th><th>Позиций</th></tr></thead>
        <tbody>${Array.from(categories.entries()).map(([cat, count]) => `<tr><td>${cat}</td><td>${count}</td></tr>`).join('')}</tbody>
      </table>
    </div>
  ` : ''}

  <div class="no-break">
    <h2>Складские остатки</h2>
    <table>
      <thead><tr><th>№</th><th>Наименование</th><th>Артикул</th><th>Категория</th><th>Количество</th><th>Мин. остаток</th><th>Место</th></tr></thead>
      <tbody>
        ${items.map((item, i) => {
          const isLow = item.minQuantity > 0 && item.quantity < item.minQuantity
          const isOut = item.quantity <= 0
          return `<tr class="${isOut ? 'out-of-stock' : isLow ? 'low-stock' : ''}">
            <td>${i + 1}</td><td>${item.name}</td><td>${item.article || '—'}</td><td>${item.category || '—'}</td>
            <td>${item.quantity} ${item.unit}</td><td>${item.minQuantity || '—'}</td><td>${item.location || '—'}</td></tr>`
        }).join('')}
      </tbody>
    </table>
  </div>

  ${transactions.length > 0 ? `
    <div class="page-break-before no-break">
      <h2>Последние операции (50)</h2>
      <table>
        <thead><tr><th>Дата</th><th>Товар</th><th>Тип</th><th>Кол-во</th><th>Проект</th><th>Примечание</th></tr></thead>
        <tbody>
          ${transactions.map(t => `
            <tr><td>${formatDate(t.createdAt)}</td><td>${t.warehouseItem.name}</td>
            <td>${t.type === 'in' ? '➕ Приход' : '➖ Расход'}</td><td>${t.quantity}</td>
            <td>${t.projectItem?.project?.name || '—'}</td><td>${t.notes || '—'}</td></tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  ` : ''}

  ${reportFooter('Отчёт по складу')}
</body>
</html>`
}

async function generateProcurementReport(): Promise<string> {
  const projects = await db.project.findMany({
    include: {
      items: { include: { supplier: true } },
      purchaseRequests: { include: { supplier: true } },
      invoices: true,
      deliveries: { include: { supplier: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  const totalBudget = projects.reduce((s, p) => s + p.items.reduce((si, i) => si + i.price * i.quantity, 0), 0)
  const totalInvoiced = projects.reduce((s, p) => s + p.invoices.reduce((si, i) => si + i.totalAmount, 0), 0)
  const activeProjects = projects.filter(p => !['completed', 'cancelled'].includes(p.status)).length
  const deliveriesInTransit = projects.reduce((s, p) => s + p.deliveries.filter(d => ['shipped', 'in_transit'].includes(d.status)).length, 0)
  const byStatus = new Map<string, number>()
  projects.forEach(p => byStatus.set(p.status, (byStatus.get(p.status) || 0) + 1))

  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Отчёт по закупкам</title>
  <style>
    ${SHARED_STYLES}
    .summary-card { background: #faf5ff; border-color: #805ad5; }
    .summary-card .value { color: #553c9a; }
  </style>
</head>
<body>
  ${reportHeader('Отчёт по закупочной деятельности')}

  <h1>📊 Отчёт по закупочной деятельности</h1>

  <div class="summary">
    <div class="summary-card"><strong>Всего проектов</strong><div class="value">${projects.length}</div></div>
    <div class="summary-card"><strong>Активных</strong><div class="value">${activeProjects}</div></div>
    <div class="summary-card"><strong>Общий бюджет</strong><div class="value">${formatCurrency(totalBudget)}</div></div>
    <div class="summary-card"><strong>Сумма по счетам</strong><div class="value">${formatCurrency(totalInvoiced)}</div></div>
    <div class="summary-card"><strong>Доставок в пути</strong><div class="value">${deliveriesInTransit}</div></div>
  </div>

  <div class="no-break">
    <h2>Проекты по статусам</h2>
    <table>
      <thead><tr><th>Статус</th><th>Количество</th></tr></thead>
      <tbody>${Array.from(byStatus.entries()).map(([status, count]) => `<tr><td><span class="status status-${status}">${getStatusLabel(status)}</span></td><td>${count}</td></tr>`).join('')}</tbody>
    </table>
  </div>

  <div class="page-break-before">
    <h2>Все проекты</h2>
    <table>
      <thead><tr><th>№</th><th>Проект</th><th>Статус</th><th>Позиций</th><th>Бюджет</th><th>Запросов</th><th>Счетов</th><th>Доставок</th><th>Дата</th></tr></thead>
      <tbody>
        ${projects.map((p, i) => {
          const budget = p.items.reduce((s, it) => s + it.price * it.quantity, 0)
          return `<tr>
            <td>${i + 1}</td><td>${p.name}</td>
            <td><span class="status status-${p.status}">${getStatusLabel(p.status)}</span></td>
            <td>${p.items.length}</td><td>${formatCurrency(budget)}</td>
            <td>${p.purchaseRequests.length}</td><td>${p.invoices.length}</td>
            <td>${p.deliveries.length}</td><td>${formatDate(p.createdAt)}</td></tr>`
        }).join('')}
        <tr class="total-row"><td colspan="4" style="text-align:right;">Итого:</td><td>${formatCurrency(totalBudget)}</td><td colspan="4"></td></tr>
      </tbody>
    </table>
  </div>

  ${reportFooter('Отчёт по закупочной деятельности')}
</body>
</html>`
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const projectId = searchParams.get('projectId')

    let html = ''

    switch (type) {
      case 'project-summary':
        if (!projectId) {
          return NextResponse.json({ error: 'projectId обязателен для project-summary' }, { status: 400 })
        }
        html = await generateProjectSummary(projectId)
        break
      case 'invoice-report':
        html = await generateInvoiceReport()
        break
      case 'warehouse-report':
        html = await generateWarehouseReport()
        break
      case 'procurement-report':
        html = await generateProcurementReport()
        break
      default:
        return NextResponse.json({ error: 'Неизвестный тип отчёта. Используйте: project-summary, invoice-report, warehouse-report, procurement-report' }, { status: 400 })
    }

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json({ error: 'Ошибка генерации отчёта' }, { status: 500 })
  }
}
