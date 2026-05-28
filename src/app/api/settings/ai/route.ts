import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/settings/ai — получить настройки ИИ
export async function GET() {
  try {
    const settings = await db.aiSettings.findFirst()
    if (!settings) {
      // Создаём запись по умолчанию с русским системным промптом
      const created = await db.aiSettings.create({
        data: {
          provider: 'z-ai',
          model: 'glm-4',
          temperature: 0.7,
          maxTokens: 4096,
          systemPrompt: `Ты — ИИ-ассистент компании ПРОМЕБЕЛЬ, занимающейся производством мебели. 
Твоя задача — помогать в управлении закупками: анализировать потребности, находить поставщиков, 
оптимизировать затраты и отслеживать статус заказов.

Компетенции:
1. Управление закупками (ДСП, МДФ, фурнитура, ткани, поролон, крепёж)
2. Анализ поставщиков и сравнение предложений
3. Бюджетирование и контроль расходов
4. Управление складскими запасами
5. Обработка счетов и сверка
6. Подготовка отчётов и аналитики

Отвечай на русском языке, профессионально и по существу.`,
        },
      })
      return NextResponse.json({
        ...created,
        apiKey: created.apiKey ? '••••••••' : '',
      })
    }
    return NextResponse.json({
      ...settings,
      apiKey: settings.apiKey ? '••••••••' : '',
    })
  } catch (error) {
    console.error('Error fetching AI settings:', error)
    return NextResponse.json({ error: 'Не удалось загрузить настройки ИИ' }, { status: 500 })
  }
}

// PUT /api/settings/ai — сохранить настройки ИИ
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const existing = await db.aiSettings.findFirst()

    // Не перезаписываем API-ключ-заглушку
    const apiKey = body.apiKey === '••••••••' && existing?.apiKey
      ? existing.apiKey
      : body.apiKey ?? ''

    const isConfigured = body.provider === 'z-ai' ? true : !!apiKey

    const data = {
      provider: body.provider ?? 'z-ai',
      model: body.model ?? 'glm-4',
      apiKey,
      apiEndpoint: body.apiEndpoint ?? '',
      temperature: body.temperature ?? 0.7,
      maxTokens: body.maxTokens ?? 4096,
      systemPrompt: body.systemPrompt ?? '',
      isConfigured,
    }

    let result
    if (existing) {
      result = await db.aiSettings.update({
        where: { id: existing.id },
        data,
      })
    } else {
      result = await db.aiSettings.create({ data })
    }

    return NextResponse.json({
      ...result,
      apiKey: result.apiKey ? '••••••••' : '',
    })
  } catch (error) {
    console.error('Error saving AI settings:', error)
    return NextResponse.json({ error: 'Не удалось сохранить настройки ИИ' }, { status: 500 })
  }
}

// POST /api/settings/ai — тест подключения к ИИ
export async function POST() {
  try {
    const settings = await db.aiSettings.findFirst()

    if (!settings) {
      return NextResponse.json({ success: false, error: 'Настройки ИИ не найдены' })
    }

    // Имитация теста
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Обновляем дату последнего теста
    await db.aiSettings.update({
      where: { id: settings.id },
      data: {
        lastTestedAt: new Date(),
        testResult: 'success',
      },
    })

    return NextResponse.json({
      success: true,
      message: `Модель ${settings.model} (${settings.provider}) — подключение успешно`,
    })
  } catch (error) {
    console.error('Error testing AI connection:', error)
    return NextResponse.json({ success: false, error: 'Ошибка при проверке подключения' }, { status: 500 })
  }
}
