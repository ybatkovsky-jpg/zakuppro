import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const result = {
      company: '',
      suppliers: [] as string[],
      projects: [] as string[],
      warehouseItems: [] as string[],
    }

    // ── Company Details ────────────────────────────────────────────────
    const existingCompany = await db.companyDetails.findFirst({
      where: { isDefault: true },
    })

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

    // ── Projects & Items ───────────────────────────────────────────────
    const existingProjectNames = new Set((await db.project.findMany({ select: { name: true } })).map(p => p.name))

    // Get supplier IDs by name
    const allSuppliers = await db.supplier.findMany()
    const supplierMap = new Map(allSuppliers.map((s) => [s.name, s.id]))

    const electroId = supplierMap.get('ООО "ЭлектроПоставка"')
    const stroyId = supplierMap.get('ЗАО "СтройМатериалы"')
    const technoId = supplierMap.get('ООО "ТехноПром"')
    const metizId = supplierMap.get('АО "МетизГрупп"')

    // Project 1: Ремонт офиса - Москва
    if (!existingProjectNames.has('Ремонт офиса - Москва')) {
      const project1 = await db.project.create({
        data: {
          name: 'Ремонт офиса - Москва',
          customerName: 'ООО Альфа',
          status: 'processing',
          description: 'Капитальный ремонт офисного помещения',
        },
      })

      await db.projectItem.createMany({
        data: [
          { projectId: project1.id, supplierId: electroId, name: 'Кабель ВВГнг 3х2.5', quantity: 500, unit: 'м', price: 45, category: 'Электрика', rowNumber: 1 },
          { projectId: project1.id, supplierId: electroId, name: 'Розетка встраиваемая', quantity: 30, unit: 'шт', price: 280, category: 'Электрика', rowNumber: 2 },
          { projectId: project1.id, supplierId: electroId, name: 'Выключатель одноклавишный', quantity: 15, unit: 'шт', price: 195, category: 'Электрика', rowNumber: 3 },
          { projectId: project1.id, supplierId: stroyId, name: 'Гипсокартон 12.5мм', quantity: 50, unit: 'лист', price: 380, category: 'Отделка', rowNumber: 4 },
          { projectId: project1.id, supplierId: stroyId, name: 'Профиль CD 60/27', quantity: 100, unit: 'шт', price: 95, category: 'Отделка', rowNumber: 5 },
          { projectId: project1.id, supplierId: stroyId, name: 'Шпаклёвка Knauf', quantity: 20, unit: 'меш', price: 450, category: 'Отделка', rowNumber: 6 },
          { projectId: project1.id, supplierId: metizId, name: 'Болт М12х60', quantity: 200, unit: 'шт', price: 28, category: 'Крепёж', rowNumber: 7 },
          { projectId: project1.id, supplierId: metizId, name: 'Гайка М12', quantity: 200, unit: 'шт', price: 12, category: 'Крепёж', rowNumber: 8 },
        ],
      })

      result.projects.push('Ремонт офиса - Москва (8 позиций)')
    } else {
      result.projects.push('Ремонт офиса - Москва (already exists)')
    }

    // Project 2: Строительство склада - Подольск
    if (!existingProjectNames.has('Строительство склада - Подольск')) {
      const project2 = await db.project.create({
        data: {
          name: 'Строительство склада - Подольск',
          customerName: 'ЗАО Бета',
          status: 'new',
          description: 'Строительство складского помещения',
        },
      })

      await db.projectItem.createMany({
        data: [
          { projectId: project2.id, supplierId: technoId, name: 'Арматура А500 d12', quantity: 1000, unit: 'м', price: 52, category: 'Металл', rowNumber: 1 },
          { projectId: project2.id, supplierId: technoId, name: 'Профлист С-21', quantity: 200, unit: 'м²', price: 580, category: 'Кровля', rowNumber: 2 },
          { projectId: project2.id, supplierId: stroyId, name: 'Цемент М500', quantity: 50, unit: 'меш', price: 420, category: 'Строительство', rowNumber: 3 },
          { projectId: project2.id, supplierId: metizId, name: 'Саморез 4.2х32', quantity: 2000, unit: 'шт', price: 3.5, category: 'Крепёж', rowNumber: 4 },
          { projectId: project2.id, supplierId: technoId, name: 'Уголок 50х50х5', quantity: 100, unit: 'м', price: 185, category: 'Металл', rowNumber: 5 },
          { projectId: project2.id, supplierId: null, name: 'Пленка гидроизоляционная', quantity: 300, unit: 'м²', price: 65, category: 'Гидроизоляция', rowNumber: 6 },
        ],
      })

      result.projects.push('Строительство склада - Подольск (6 позиций)')
    } else {
      result.projects.push('Строительство склада - Подольск (already exists)')
    }

    // ── Warehouse Items ────────────────────────────────────────────────
    const existingWarehouse = await db.warehouseItem.findMany()

    if (existingWarehouse.length === 0) {
      const warehouseData = [
        { name: 'Кабель ВВГнг 3х1.5', article: 'КВВГ-1.5', category: 'Электрика', quantity: 200, minQuantity: 50, unit: 'м', location: 'Стеллаж А1' },
        { name: 'Саморез 4.2х25', article: 'СР-4.2х25', category: 'Крепёж', quantity: 5000, minQuantity: 1000, unit: 'шт', location: 'Стеллаж Б3' },
        { name: 'Изолента ПВХ', article: 'ИЗ-ПВХ', category: 'Электрика', quantity: 30, minQuantity: 50, unit: 'шт', location: 'Стеллаж А2' },
        { name: 'Дюбель 8х40', article: 'Д-8х40', category: 'Крепёж', quantity: 800, minQuantity: 200, unit: 'шт', location: 'Стеллаж Б1' },
        { name: 'Грунтовка глубокого проникновения', article: 'ГГП-10', category: 'Отделка', quantity: 5, minQuantity: 10, unit: 'л', location: 'Стеллаж В2' },
      ]

      for (const w of warehouseData) {
        await db.warehouseItem.create({ data: w })
        result.warehouseItems.push(w.name)
      }
    } else {
      result.warehouseItems = ['skipped (warehouse items already exist)']
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
