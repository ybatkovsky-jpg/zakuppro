/**
 * Database Seed API Route
 *
 * TODO: M005/S01 - This route was not part of the API migration slice.
 * This endpoint seeds the Prisma database with test data.
 * Future migration: Replace with FastAPI seed endpoint.
 */
import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const result = {
      company: '',
      suppliers: [] as string[],
      projects: [] as string[],
      warehouseItems: [] as string[],
      purchaseRequests: [] as string[],
      invoices: [] as string[],
      stockMovements: [] as string[],
      automationRules: [] as string[],
      deliveries: [] as string[],
    }

    // ── Company Details ────────────────────────────────────────────────
    const existingCompany = await db.companyDetails.findFirst({
      where: { isDefault: true },
    })

    try {
      if (existingCompany) {
        await db.companyDetails.update({
          where: { id: existingCompany.id },
          data: {
            companyName: 'ООО СтройКомплект',
            inn: '7701234567',
            kpp: '770101001',
            ogrn: '1027700123456',
            address: 'г. Москва, ул. Промышленная, д. 15, оф. 301',
            email: 'zakupki@stroykomplekt.ru',
            phone: '+7 (495) 123-45-67',
            bankName: 'ПАО Сбербанк',
            bankAccount: '40702810938000123456',
            korAccount: '30101810400000000225',
            bik: '044525225',
          },
        })
        result.company = 'updated'
      } else {
        await db.companyDetails.create({
          data: {
            companyName: 'ООО СтройКомплект',
            inn: '7701234567',
            kpp: '770101001',
            ogrn: '1027700123456',
            address: 'г. Москва, ул. Промышленная, д. 15, оф. 301',
            email: 'zakupki@stroykomplekt.ru',
            phone: '+7 (495) 123-45-67',
            bankName: 'ПАО Сбербанк',
            bankAccount: '40702810938000123456',
            korAccount: '30101810400000000225',
            bik: '044525225',
            isDefault: true,
          },
        })
        result.company = 'created'
      }
    } catch {
      // If update fails (read-only DB), try create
      try {
        await db.companyDetails.create({
          data: {
            companyName: 'ООО СтройКомплект',
            inn: '7701234567',
            kpp: '770101001',
            ogrn: '1027700123456',
            address: 'г. Москва, ул. Промышленная, д. 15, оф. 301',
            email: 'zakupki@stroykomplekt.ru',
            phone: '+7 (495) 123-45-67',
            bankName: 'ПАО Сбербанк',
            bankAccount: '40702810938000123456',
            korAccount: '30101810400000000225',
            bik: '044525225',
            isDefault: true,
          },
        })
        result.company = 'created (fallback)'
      } catch {
        result.company = 'skipped (write error)'
      }
    }

    // ── Suppliers ──────────────────────────────────────────────────────
    const existingSuppliers = await db.supplier.findMany()
    const supplierNames = new Set(existingSuppliers.map((s) => s.name))

    const suppliersData = [
      { name: 'ООО "ЭлектроПоставка"', email: 'info@electropost.ru', phone: '+7(495)111-22-33', contactPerson: 'Иванов Алексей' },
      { name: 'ЗАО "СтройМатериалы"', email: 'sales@stroymat.ru', phone: '+7(495)222-33-44', contactPerson: 'Петрова Мария' },
      { name: 'ИП Сидоров К.А.', email: 'sidorov@mail.ru', phone: '+7(495)333-44-55', contactPerson: 'Сидоров Константин' },
      { name: 'ООО "ТехноПром"', email: 'order@technoprom.ru', phone: '+7(495)444-55-66', contactPerson: 'Козлова Елена' },
      { name: 'АО "МетизГрупп"', email: 'metiz@metizgroup.ru', phone: '+7(495)555-66-77', contactPerson: 'Новиков Дмитрий' },
    ]

    if (supplierNames.size === 0) {
      for (const s of suppliersData) {
        await db.supplier.create({ data: s })
      }
      result.suppliers = suppliersData.map((s) => s.name)
    } else {
      result.suppliers = ['skipped (already exist)']
    }

    // ── Get supplier IDs ─────────────────────────────────────────────
    const allSuppliers = await db.supplier.findMany()
    const supplierMap = new Map(allSuppliers.map((s) => [s.name, s.id]))

    const electroId = supplierMap.get('ООО "ЭлектроПоставка"')!
    const stroyId = supplierMap.get('ЗАО "СтройМатериалы"')!
    const sidorovId = supplierMap.get('ИП Сидоров К.А.')!
    const technoId = supplierMap.get('ООО "ТехноПром"')!
    const metizId = supplierMap.get('АО "МетизГрупп"')!

    // ── Update existing "Строительство склада" status ────────────────
    const existingSklad = await db.project.findFirst({
      where: { name: 'Строительство склада - Подольск' },
    })
    if (existingSklad && existingSklad.status === 'new') {
      await db.project.update({
        where: { id: existingSklad.id },
        data: { status: 'requested' },
      })
      result.projects.push('Строительство склада - Подольск (status updated to requested)')
    }

    // ── Projects & Items ───────────────────────────────────────────────
    const existingProjectNames = new Set((await db.project.findMany({ select: { name: true } })).map(p => p.name))

    // Project 1: Ремонт офиса - Москва (processing) — keep existing
    if (!existingProjectNames.has('Ремонт офиса - Москва')) {
      const project1 = await db.project.create({
        data: {
          name: 'Ремонт офиса - Москва',
          customerName: 'ООО Альфа',
          status: 'processing',
          description: 'Капитальный ремонт офисного помещения',
        },
      })

      const p1Items = [
        { projectId: project1.id, supplierId: electroId, name: 'Кабель ВВГнг 3х2.5', quantity: 500, unit: 'м', price: 45, category: 'Электрика', rowNumber: 1 },
        { projectId: project1.id, supplierId: electroId, name: 'Розетка встраиваемая', quantity: 30, unit: 'шт', price: 280, category: 'Электрика', rowNumber: 2 },
        { projectId: project1.id, supplierId: electroId, name: 'Выключатель одноклавишный', quantity: 15, unit: 'шт', price: 195, category: 'Электрика', rowNumber: 3 },
        { projectId: project1.id, supplierId: stroyId, name: 'Гипсокартон 12.5мм', quantity: 50, unit: 'лист', price: 380, category: 'Отделка', rowNumber: 4 },
        { projectId: project1.id, supplierId: stroyId, name: 'Профиль CD 60/27', quantity: 100, unit: 'шт', price: 95, category: 'Отделка', rowNumber: 5 },
        { projectId: project1.id, supplierId: stroyId, name: 'Шпаклёвка Knauf', quantity: 20, unit: 'меш', price: 450, category: 'Отделка', rowNumber: 6 },
        { projectId: project1.id, supplierId: metizId, name: 'Болт М12х60', quantity: 200, unit: 'шт', price: 28, category: 'Крепёж', rowNumber: 7 },
        { projectId: project1.id, supplierId: metizId, name: 'Гайка М12', quantity: 200, unit: 'шт', price: 12, category: 'Крепёж', rowNumber: 8 },
      ]
      await db.projectItem.createMany({ data: p1Items })
      result.projects.push('Ремонт офиса - Москва (8 позиций)')
    } else {
      result.projects.push('Ремонт офиса - Москва (already exists)')
    }

    // Project 2: Строительство склада - Подольск (requested)
    if (!existingProjectNames.has('Строительство склада - Подольск')) {
      const project2 = await db.project.create({
        data: {
          name: 'Строительство склада - Подольск',
          customerName: 'ЗАО Бета',
          status: 'requested',
          description: 'Строительство складского помещения',
        },
      })

      const p2Items = [
        { projectId: project2.id, supplierId: technoId, name: 'Арматура А500 d12', quantity: 1000, unit: 'м', price: 52, category: 'Металл', rowNumber: 1 },
        { projectId: project2.id, supplierId: technoId, name: 'Профлист С-21', quantity: 200, unit: 'м²', price: 580, category: 'Кровля', rowNumber: 2 },
        { projectId: project2.id, supplierId: stroyId, name: 'Цемент М500', quantity: 50, unit: 'меш', price: 420, category: 'Строительство', rowNumber: 3 },
        { projectId: project2.id, supplierId: metizId, name: 'Саморез 4.2х32', quantity: 2000, unit: 'шт', price: 3.5, category: 'Крепёж', rowNumber: 4 },
        { projectId: project2.id, supplierId: technoId, name: 'Уголок 50х50х5', quantity: 100, unit: 'м', price: 185, category: 'Металл', rowNumber: 5 },
        { projectId: project2.id, supplierId: null, name: 'Пленка гидроизоляционная', quantity: 300, unit: 'м²', price: 65, category: 'Гидроизоляция', rowNumber: 6 },
      ]
      await db.projectItem.createMany({ data: p2Items })
      result.projects.push('Строительство склада - Подольск (6 позиций)')
    } else {
      result.projects.push('Строительство склада - Подольск (already exists)')
    }

    // Project 3: Оснащение производства - Тула (invoiced)
    if (!existingProjectNames.has('Оснащение производства - Тула')) {
      const project3 = await db.project.create({
        data: {
          name: 'Оснащение производства - Тула',
          customerName: 'ООО Гамма',
          status: 'invoiced',
          description: 'Оснащение нового производственного цеха',
        },
      })

      const p3Items = [
        { projectId: project3.id, supplierId: electroId, name: 'Автомат 3P 25А', quantity: 20, unit: 'шт', price: 1200, category: 'Электрика', rowNumber: 1, status: 'invoiced' },
        { projectId: project3.id, supplierId: electroId, name: 'Кабель КГ 3х4', quantity: 300, unit: 'м', price: 185, category: 'Электрика', rowNumber: 2, status: 'invoiced' },
        { projectId: project3.id, supplierId: technoId, name: 'Станок сверлильный СС-16', quantity: 3, unit: 'шт', price: 45000, category: 'Оборудование', rowNumber: 3, status: 'invoiced' },
        { projectId: project3.id, supplierId: technoId, name: 'Станок токарный ТВ-7', quantity: 2, unit: 'шт', price: 125000, category: 'Оборудование', rowNumber: 4, status: 'invoiced' },
        { projectId: project3.id, supplierId: sidorovId, name: 'Масло индустриальное И-20', quantity: 50, unit: 'л', price: 180, category: 'СМЗ', rowNumber: 5, status: 'requested' },
        { projectId: project3.id, supplierId: metizId, name: 'Болт М16х80', quantity: 500, unit: 'шт', price: 45, category: 'Крепёж', rowNumber: 6, status: 'invoiced' },
        { projectId: project3.id, supplierId: stroyId, name: 'Краска порошковая RAL', quantity: 100, unit: 'кг', price: 350, category: 'Отделка', rowNumber: 7, status: 'requested' },
      ]
      await db.projectItem.createMany({ data: p3Items })
      result.projects.push('Оснащение производства - Тула (7 позиций)')
    } else {
      result.projects.push('Оснащение производства - Тула (already exists)')
    }

    // Project 4: Закупка оборудования - СПб (paid)
    if (!existingProjectNames.has('Закупка оборудования - СПб')) {
      const project4 = await db.project.create({
        data: {
          name: 'Закупка оборудования - СПб',
          customerName: 'ПАО Дельта',
          status: 'paid',
          description: 'Закупка оборудования для нового филиала',
        },
      })

      const p4Items = [
        { projectId: project4.id, supplierId: technoId, name: 'Кондиционер сплит-система', quantity: 8, unit: 'шт', price: 55000, category: 'Оборудование', rowNumber: 1, status: 'delivered' },
        { projectId: project4.id, supplierId: technoId, name: 'Вентилятор канальный', quantity: 4, unit: 'шт', price: 18500, category: 'Вентиляция', rowNumber: 2, status: 'invoiced' },
        { projectId: project4.id, supplierId: electroId, name: 'Щит распределительный', quantity: 6, unit: 'шт', price: 8200, category: 'Электрика', rowNumber: 3, status: 'delivered' },
        { projectId: project4.id, supplierId: electroId, name: 'УЗО 3P 63А 30мА', quantity: 12, unit: 'шт', price: 2800, category: 'Электрика', rowNumber: 4, status: 'invoiced' },
        { projectId: project4.id, supplierId: sidorovId, name: 'Труба ПП D32', quantity: 200, unit: 'м', price: 95, category: 'Сантехника', rowNumber: 5, status: 'delivered' },
        { projectId: project4.id, supplierId: sidorovId, name: 'Фитинг обжимной D32', quantity: 80, unit: 'шт', price: 120, category: 'Сантехника', rowNumber: 6, status: 'invoiced' },
        { projectId: project4.id, supplierId: metizId, name: 'Анкер клиновой М12', quantity: 150, unit: 'шт', price: 65, category: 'Крепёж', rowNumber: 7, status: 'delivered' },
        { projectId: project4.id, supplierId: stroyId, name: 'Панель акустическая', quantity: 40, unit: 'шт', price: 1200, category: 'Отделка', rowNumber: 8, status: 'invoiced' },
      ]
      await db.projectItem.createMany({ data: p4Items })
      result.projects.push('Закупка оборудования - СПб (8 позиций)')
    } else {
      result.projects.push('Закупка оборудования - СПб (already exists)')
    }

    // Project 5: Монтаж вентиляции - Казань (delivered)
    if (!existingProjectNames.has('Монтаж вентиляции - Казань')) {
      const project5 = await db.project.create({
        data: {
          name: 'Монтаж вентиляции - Казань',
          customerName: 'ООО Эпсилон',
          status: 'delivered',
          description: 'Монтаж системы вентиляции и кондиционирования',
        },
      })

      const p5Items = [
        { projectId: project5.id, supplierId: technoId, name: 'Вентилятор радиальный ВР-3', quantity: 2, unit: 'шт', price: 32000, category: 'Вентиляция', rowNumber: 1, status: 'delivered' },
        { projectId: project5.id, supplierId: technoId, name: 'Клапан обратный D315', quantity: 4, unit: 'шт', price: 4500, category: 'Вентиляция', rowNumber: 2, status: 'delivered' },
        { projectId: project5.id, supplierId: technoId, name: 'Воздуховод оцинк. D315', quantity: 80, unit: 'м', price: 680, category: 'Вентиляция', rowNumber: 3, status: 'delivered' },
        { projectId: project5.id, supplierId: electroId, name: 'Привод электрический', quantity: 6, unit: 'шт', price: 7500, category: 'Автоматика', rowNumber: 4, status: 'delivered' },
        { projectId: project5.id, supplierId: electroId, name: 'Датчик температуры канальный', quantity: 8, unit: 'шт', price: 3200, category: 'Автоматика', rowNumber: 5, status: 'delivered' },
        { projectId: project5.id, supplierId: sidorovId, name: 'Хомут D315', quantity: 30, unit: 'шт', price: 280, category: 'Крепёж', rowNumber: 6, status: 'delivered' },
        { projectId: project5.id, supplierId: metizId, name: 'Саморез кровельный 4.8х35', quantity: 500, unit: 'шт', price: 4.2, category: 'Крепёж', rowNumber: 7, status: 'delivered' },
        { projectId: project5.id, supplierId: stroyId, name: 'Герметик силиконовый', quantity: 30, unit: 'шт', price: 320, category: 'Герметизация', rowNumber: 8, status: 'delivered' },
      ]
      await db.projectItem.createMany({ data: p5Items })
      result.projects.push('Монтаж вентиляции - Казань (8 позиций)')
    } else {
      result.projects.push('Монтаж вентиляции - Казань (already exists)')
    }

    // ── Purchase Requests ─────────────────────────────────────────────
    // Only create if there are no existing requests
    const existingRequests = await db.purchaseRequest.findMany()
    if (existingRequests.length === 0) {
      // Find project IDs
      const allProjects = await db.project.findMany()
      const projectMap = new Map(allProjects.map(p => [p.name, p.id]))

      const project3Id = projectMap.get('Оснащение производства - Тула')
      const project4Id = projectMap.get('Закупка оборудования - СПб')
      const project5Id = projectMap.get('Монтаж вентиляции - Казань')
      const project2Id = projectMap.get('Строительство склада - Подольск')

      // Request 1: Draft for project 3 (Оснащение производства) -> ТехноПром
      if (project3Id) {
        const p3Items = await db.projectItem.findMany({
          where: { projectId: project3Id, supplierId: technoId },
        })
        if (p3Items.length > 0) {
          await db.purchaseRequest.create({
            data: {
              projectId: project3Id,
              supplierId: technoId,
              status: 'draft',
              emailTo: 'order@technoprom.ru',
              emailSubject: 'Запрос цен на оборудование',
              notes: 'Срочно требуется информация по срокам поставки станков',
              items: {
                create: p3Items.map(item => ({
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
          result.purchaseRequests.push('Запрос ТехноПром (проект Тула) - draft')
        }
      }

      // Request 2: Sent for project 4 (Закупка оборудования) -> ЭлектроПоставка
      if (project4Id) {
        const p4ElectroItems = await db.projectItem.findMany({
          where: { projectId: project4Id, supplierId: electroId },
        })
        if (p4ElectroItems.length > 0) {
          await db.purchaseRequest.create({
            data: {
              projectId: project4Id,
              supplierId: electroId,
              status: 'sent',
              emailTo: 'info@electropost.ru',
              emailSubject: 'Запрос на электротехническое оборудование',
              sentAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
              notes: 'Запрос отправлен 3 дня назад',
              items: {
                create: p4ElectroItems.map(item => ({
                  projectItemId: item.id,
                  quantity: item.quantity,
                  price: item.price,
                  available: true,
                  availableQty: item.quantity,
                  deliveryDays: 5,
                })),
              },
            },
          })
          result.purchaseRequests.push('Запрос ЭлектроПоставка (проект СПб) - sent')
        }
      }

      // Request 3: Responded for project 5 (Монтаж вентиляции) -> ТехноПром
      if (project5Id) {
        const p5TechnoItems = await db.projectItem.findMany({
          where: { projectId: project5Id, supplierId: technoId },
        })
        if (p5TechnoItems.length > 0) {
          await db.purchaseRequest.create({
            data: {
              projectId: project5Id,
              supplierId: technoId,
              status: 'responded',
              emailTo: 'order@technoprom.ru',
              emailSubject: 'Запрос на вентиляционное оборудование',
              sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
              responseAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
              notes: 'Поставщик подтвердил наличие, срок 10 дней',
              items: {
                create: p5TechnoItems.map(item => ({
                  projectItemId: item.id,
                  quantity: item.quantity,
                  price: item.price,
                  available: true,
                  availableQty: item.quantity,
                  deliveryDays: 10,
                })),
              },
            },
          })
          result.purchaseRequests.push('Запрос ТехноПром (проект Казань) - responded')
        }
      }

      // Request 4: Sent for project 2 (Строительство склада) -> СтройМатериалы
      if (project2Id) {
        const p2StroyItems = await db.projectItem.findMany({
          where: { projectId: project2Id, supplierId: stroyId },
        })
        if (p2StroyItems.length > 0) {
          await db.purchaseRequest.create({
            data: {
              projectId: project2Id,
              supplierId: stroyId,
              status: 'sent',
              emailTo: 'sales@stroymat.ru',
              emailSubject: 'Запрос цен на стройматериалы',
              sentAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
              notes: '',
              items: {
                create: p2StroyItems.map(item => ({
                  projectItemId: item.id,
                  quantity: item.quantity,
                  price: item.price,
                  available: true,
                  availableQty: item.quantity,
                  deliveryDays: 7,
                })),
              },
            },
          })
          result.purchaseRequests.push('Запрос СтройМатериалы (проект Подольск) - sent')
        }
      }
    } else {
      result.purchaseRequests = ['skipped (requests already exist)']
    }

    // ── Invoices ──────────────────────────────────────────────────────
    const existingInvoices = await db.invoice.findMany()
    if (existingInvoices.length === 0) {
      const allProjects = await db.project.findMany()
      const projectMap = new Map(allProjects.map(p => [p.name, p.id]))

      const project5Id = projectMap.get('Монтаж вентиляции - Казань')
      const project4Id = projectMap.get('Закупка оборудования - СПб')
      const project3Id = projectMap.get('Оснащение производства - Тула')

      // Invoice 1: Approved for project 5 (Монтаж вентиляции) -> ТехноПром
      if (project5Id) {
        const p5TechnoItems = await db.projectItem.findMany({
          where: { projectId: project5Id, supplierId: technoId },
        })
        if (p5TechnoItems.length > 0) {
          const invoiceItems = p5TechnoItems.map(item => ({
            projectItemId: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            isMatch: true,
            mismatchReason: '',
          }))
          const totalAmount = invoiceItems.reduce((sum, i) => sum + i.quantity * i.price, 0)

          await db.invoice.create({
            data: {
              projectId: project5Id,
              supplierId: technoId,
              invoiceNumber: 'СЧ-2026-001',
              totalAmount,
              status: 'approved',
              receivedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
              notes: 'Счёт согласован, ожидает оплату',
              items: { create: invoiceItems },
            },
          })
          result.invoices.push('Счёт ТехноПром (проект Казань) - approved')
        }
      }

      // Invoice 2: Verified for project 4 (Закупка оборудования) -> ЭлектроПоставка
      if (project4Id) {
        const p4ElectroItems = await db.projectItem.findMany({
          where: { projectId: project4Id, supplierId: electroId },
        })
        if (p4ElectroItems.length > 0) {
          const invoiceItems = p4ElectroItems.map((item, idx) => ({
            projectItemId: item.id,
            name: item.name,
            quantity: item.quantity,
            price: idx === 0 ? item.price * 1.05 : item.price, // slight price mismatch on first item
            isMatch: idx !== 0,
            mismatchReason: idx === 0 ? 'Цена выше на 5%' : '',
          }))
          const totalAmount = invoiceItems.reduce((sum, i) => sum + i.quantity * i.price, 0)

          await db.invoice.create({
            data: {
              projectId: project4Id,
              supplierId: electroId,
              invoiceNumber: 'СЧ-2026-002',
              totalAmount,
              status: 'verified',
              receivedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
              notes: 'Расхождение в цене на щит распределительный',
              items: { create: invoiceItems },
            },
          })
          result.invoices.push('Счёт ЭлектроПоставка (проект СПб) - verified')
        }
      }

      // Invoice 3: Paid for project 5 (Монтаж вентиляции) -> Сидоров
      if (project5Id) {
        const p5SidorovItems = await db.projectItem.findMany({
          where: { projectId: project5Id, supplierId: sidorovId },
        })
        if (p5SidorovItems.length > 0) {
          const invoiceItems = p5SidorovItems.map(item => ({
            projectItemId: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            isMatch: true,
            mismatchReason: '',
          }))
          const totalAmount = invoiceItems.reduce((sum, i) => sum + i.quantity * i.price, 0)

          await db.invoice.create({
            data: {
              projectId: project5Id,
              supplierId: sidorovId,
              invoiceNumber: 'СЧ-2026-003',
              totalAmount,
              status: 'paid',
              receivedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
              paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
              notes: 'Оплачено безналичным расчётом',
              items: { create: invoiceItems },
            },
          })
          result.invoices.push('Счёт Сидоров (проект Казань) - paid')
        }
      }

      // Invoice 4: Received for project 3 (Оснащение производства) -> МетизГрупп
      if (project3Id) {
        const p3MetizItems = await db.projectItem.findMany({
          where: { projectId: project3Id, supplierId: metizId },
        })
        if (p3MetizItems.length > 0) {
          const invoiceItems = p3MetizItems.map(item => ({
            projectItemId: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            isMatch: false,
            mismatchReason: '',
          }))
          const totalAmount = invoiceItems.reduce((sum, i) => sum + i.quantity * i.price, 0)

          await db.invoice.create({
            data: {
              projectId: project3Id,
              supplierId: metizId,
              invoiceNumber: 'СЧ-2026-004',
              totalAmount,
              status: 'received',
              receivedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
              notes: 'Новый счёт, требует проверки',
              items: { create: invoiceItems },
            },
          })
          result.invoices.push('Счёт МетизГрупп (проект Тула) - received')
        }
      }
    } else {
      result.invoices = ['skipped (invoices already exist)']
    }

    // ── Warehouse Items ────────────────────────────────────────────────
    const existingWarehouse = await db.warehouseItem.findMany()
    const existingWarehouseArticles = new Set(existingWarehouse.map(w => w.article))

    const warehouseData = [
      { name: 'Кабель ВВГнг 3х1.5', article: 'КВВГ-1.5', category: 'Электрика', quantity: 200, minQuantity: 50, unit: 'м', location: 'Стеллаж А1' },
      { name: 'Саморез 4.2х25', article: 'СР-4.2х25', category: 'Крепёж', quantity: 5000, minQuantity: 1000, unit: 'шт', location: 'Стеллаж Б3' },
      { name: 'Изолента ПВХ', article: 'ИЗ-ПВХ', category: 'Электрика', quantity: 30, minQuantity: 50, unit: 'шт', location: 'Стеллаж А2' },
      { name: 'Дюбель 8х40', article: 'Д-8х40', category: 'Крепёж', quantity: 800, minQuantity: 200, unit: 'шт', location: 'Стеллаж Б1' },
      { name: 'Грунтовка глубокого проникновения', article: 'ГГП-10', category: 'Отделка', quantity: 5, minQuantity: 10, unit: 'л', location: 'Стеллаж В2' },
      // Additional items
      { name: 'Труба ПП D20', article: 'ТПП-20', category: 'Сантехника', quantity: 150, minQuantity: 30, unit: 'м', location: 'Стеллаж Г1' },
      { name: 'Фильтр воздушный карманный', article: 'ФВК-500', category: 'Вентиляция', quantity: 12, minQuantity: 5, unit: 'шт', location: 'Стеллаж Д2' },
      { name: 'Шайба плоская М12', article: 'ШП-М12', category: 'Крепёж', quantity: 3000, minQuantity: 500, unit: 'шт', location: 'Стеллаж Б2' },
      { name: 'Краска эмаль ПФ-115 белая', article: 'ПФ-115-Б', category: 'Отделка', quantity: 8, minQuantity: 15, unit: 'кг', location: 'Стеллаж В1' },
      { name: 'Предохранитель ПН-2 100А', article: 'ПН2-100', category: 'Электрика', quantity: 0, minQuantity: 10, unit: 'шт', location: 'Стеллаж А3' },
    ]

    for (const w of warehouseData) {
      if (!existingWarehouseArticles.has(w.article)) {
        try {
          await db.warehouseItem.create({ data: w })
          result.warehouseItems.push(w.name)
        } catch {
          result.warehouseItems.push(`${w.name} (skipped)`)
        }
      }
    }

    if (result.warehouseItems.length === 0) {
      result.warehouseItems = ['skipped (all warehouse items already exist)']
    }

    // ── Stock Movements ────────────────────────────────────────────────
    const existingTransactions = await db.warehouseTransaction.findMany()
    if (existingTransactions.length === 0) {
      const allWarehouseItems = await db.warehouseItem.findMany()
      const whMap = new Map(allWarehouseItems.map(w => [w.article, w.id]))

      const movements = [
        { warehouseItemId: whMap.get('КВВГ-1.5')!, type: 'out', quantity: 100, notes: 'Выдача на проект Ремонт офиса', createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
        { warehouseItemId: whMap.get('СР-4.2х25')!, type: 'out', quantity: 500, notes: 'Выдача на проект Строительство склада', createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) },
        { warehouseItemId: whMap.get('КВВГ-1.5')!, type: 'in', quantity: 300, notes: 'Поступление от ЭлектроПоставка', createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        { warehouseItemId: whMap.get('Д-8х40')!, type: 'out', quantity: 200, notes: 'Выдача на проект Монтаж вентиляции', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
        { warehouseItemId: whMap.get('ШП-М12')!, type: 'in', quantity: 1000, notes: 'Поступление от МетизГрупп', createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
        { warehouseItemId: whMap.get('ИЗ-ПВХ')!, type: 'out', quantity: 20, notes: 'Выдача на проект Закупка оборудования', createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
        { warehouseItemId: whMap.get('ТПП-20')!, type: 'in', quantity: 200, notes: 'Поступление от Сидоров К.А.', createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) },
        { warehouseItemId: whMap.get('ПФ-115-Б')!, type: 'out', quantity: 5, notes: 'Выдача на проект Оснащение производства', createdAt: new Date() },
      ].filter(m => m.warehouseItemId)

      for (const m of movements) {
        await db.warehouseTransaction.create({ data: m })
        result.stockMovements.push(`${m.type}: ${m.notes}`)
      }
    } else {
      result.stockMovements = ['skipped (transactions already exist)']
    }

    // ── Status History for projects ────────────────────────────────────
    const allProjects = await db.project.findMany()
    for (const p of allProjects) {
      const existingHistory = await db.projectStatusHistory.findMany({
        where: { projectId: p.id },
      })
      if (existingHistory.length === 0 && p.status !== 'new') {
        // Create a basic status history
        if (p.status === 'processing' || p.status === 'requested' || p.status === 'invoiced' || p.status === 'paid' || p.status === 'delivered') {
          await db.projectStatusHistory.create({
            data: {
              projectId: p.id,
              status: 'new',
              notes: 'Проект создан',
              createdAt: new Date(p.createdAt),
            },
          })
          await db.projectStatusHistory.create({
            data: {
              projectId: p.id,
              status: p.status,
              notes: `Статус изменён на ${p.status}`,
              createdAt: p.updatedAt,
            },
          })
        }
      }
    }

    // ── Automation Rules ────────────────────────────────────────────────
    const existingRules = await db.automationRule.findMany()
    const existingRuleTypes = new Set(existingRules.map(r => r.type))

    const automationRulesData = [
      {
        type: 'auto_create_requests',
        name: 'Автосоздание запросов',
        enabled: false,
        config: JSON.stringify({ createDraft: true, assignSupplier: true }),
      },
      {
        type: 'auto_status_transition',
        name: 'Автопереход статуса',
        enabled: false,
        config: JSON.stringify({ checkInterval: 'daily' }),
      },
      {
        type: 'auto_warehouse_check',
        name: 'Проверка склада',
        enabled: false,
        config: JSON.stringify({ matchByArticle: true, matchByName: true }),
      },
      {
        type: 'low_stock_alert',
        name: 'Уведомление о низком запасе',
        enabled: false,
        config: JSON.stringify({ threshold: 0.5, notifyEmail: true }),
      },
      {
        type: 'invoice_auto_reconcile',
        name: 'Автосверка счетов',
        enabled: false,
        config: JSON.stringify({ autoVerify: false, notifyDiscrepancy: true }),
      },
    ]

    for (const rule of automationRulesData) {
      if (!existingRuleTypes.has(rule.type)) {
        await db.automationRule.create({ data: rule })
        result.automationRules.push(rule.name)
      } else {
        result.automationRules.push(`${rule.name} (already exists)`)
      }
    }

    // ── Deliveries ────────────────────────────────────────────────────
    const existingDeliveries = await db.delivery.findMany()
    if (existingDeliveries.length === 0) {
      const allProjects = await db.project.findMany()
      const projectMap = new Map(allProjects.map(p => [p.name, p.id]))

      const project4Id = projectMap.get('Закупка оборудования - СПб')
      const project5Id = projectMap.get('Монтаж вентиляции - Казань')
      const project1Id = projectMap.get('Ремонт офиса - Москва')
      const project3Id = projectMap.get('Оснащение производства - Тула')

      const deliveriesData = [
        {
          projectId: project4Id!,
          supplierId: technoId,
          status: 'in_transit',
          trackingNumber: 'ДЛ-2026-44871',
          carrier: 'Деловые Линии',
          estimatedDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          notes: 'Кондиционеры и щиты распределительные',
        },
        {
          projectId: project5Id!,
          supplierId: technoId,
          status: 'delivered',
          trackingNumber: 'ПЭК-987654',
          carrier: 'ПЭК',
          estimatedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          actualDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          notes: 'Вентиляторы и воздуховоды',
        },
        {
          projectId: project1Id!,
          supplierId: stroyId,
          status: 'shipped',
          trackingNumber: 'СДЭК-1203456',
          carrier: 'СДЭК',
          estimatedDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          notes: 'Гипсокартон и профиль',
        },
        {
          projectId: project3Id!,
          supplierId: metizId,
          status: 'pending',
          trackingNumber: '',
          carrier: 'Байкал Сервис',
          estimatedDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          notes: 'Крепёж и метизы для производства',
        },
      ].filter(d => d.projectId)

      for (const d of deliveriesData) {
        await db.delivery.create({ data: d })
        result.deliveries.push(`${d.carrier} (${d.status})`)
      }
    } else {
      result.deliveries = ['skipped (deliveries already exist)']
    }

    return NextResponse.json({ success: true, seeded: result })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to seed database' },
      { status: 500 }
    )
  }
}
