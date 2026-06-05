/**
 * AI Settings API Route
 *
 * TODO: M005/S01 - This route was not part of the API migration slice.
 * This endpoint manages AI settings stored in Prisma.
 * Future migration: Create equivalent FastAPI settings endpoints.
 */
import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

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

// POST /api/settings/ai — тест подключения к ИИ (реальная проверка)
export async function POST(_request: NextRequest) {
  try {
    const settings = await db.aiSettings.findFirst()

    if (!settings) {
      return NextResponse.json({ success: false, error: 'Настройки ИИ не найдены. Сначала сохраните настройки.' })
    }

    // Если провайдер не z-ai — сообщаем, что тест работает только с Z-AI
    if (settings.provider !== 'z-ai') {
      return NextResponse.json({
        success: false,
        error: `Тестирование подключения доступно только для провайдера Z-AI. Для провайдера "${settings.provider}" проверьте API-ключ вручную, отправив тестовый запрос к вашему эндпоинту.`,
        hint: 'Переключите провайдер на "z-ai" для автоматической проверки, или убедитесь в работоспособности вашего API-ключа самостоятельно.',
      })
    }

    // Реальный тест подключения через z-ai-web-dev-sdk
    try {
      const zai = await ZAI.create()

      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: 'Ты — тестовый ассистент. Отвечай кратко.' },
          { role: 'user', content: 'Ответь одним словом: работает' },
        ],
        thinking: { type: 'disabled' },
      })

      const response = completion.choices[0]?.message?.content

      if (!response) {
        // Пустой ответ — считаем частичной ошибкой
        await db.aiSettings.update({
          where: { id: settings.id },
          data: {
            lastTestedAt: new Date(),
            testResult: 'warning: пустой ответ от модели',
          },
        })

        return NextResponse.json({
          success: false,
          error: `Модель ${settings.model} вернула пустой ответ. Проверьте настройки модели.`,
        })
      }

      // Успешный тест — обновляем дату и результат
      await db.aiSettings.update({
        where: { id: settings.id },
        data: {
          lastTestedAt: new Date(),
          testResult: 'success',
        },
      })

      return NextResponse.json({
        success: true,
        message: `Подключение к ИИ (${settings.provider}, модель ${settings.model}) — успешно. Ответ получен: "${response.slice(0, 50)}${response.length > 50 ? '...' : ''}"`,
      })
    } catch (aiError: unknown) {
      const errMsg = aiError instanceof Error ? aiError.message : String(aiError)

      // Обновляем результат в БД
      await db.aiSettings.update({
        where: { id: settings.id },
        data: {
          lastTestedAt: new Date(),
          testResult: `error: ${errMsg}`,
        },
      })

      // Формируем понятное сообщение на русском
      let ruMessage = `Ошибка подключения к ИИ: ${errMsg}`
      if (errMsg.includes('API key') || errMsg.includes('api_key') || errMsg.includes('unauthorized') || errMsg.includes('401')) {
        ruMessage = 'Ошибка аутентификации ИИ: неверный или просроченный API-ключ.'
      } else if (errMsg.includes('rate limit') || errMsg.includes('429')) {
        ruMessage = 'Превышен лимит запросов к ИИ. Попробуйте позже.'
      } else if (errMsg.includes('timeout') || errMsg.includes('ETIMEDOUT')) {
        ruMessage = 'Таймаут при подключении к ИИ. Сервер не отвечает.'
      } else if (errMsg.includes('network') || errMsg.includes('ECONNREFUSED') || errMsg.includes('fetch')) {
        ruMessage = 'Сетевая ошибка при подключении к ИИ. Проверьте подключение к интернету.'
      } else if (errMsg.includes('model') || errMsg.includes('not found') || errMsg.includes('404')) {
        ruMessage = `Модель "${settings.model}" не найдена. Проверьте название модели в настройках.`
      }

      return NextResponse.json({ success: false, error: ruMessage })
    }
  } catch (error) {
    console.error('Error testing AI connection:', error)
    return NextResponse.json({ success: false, error: 'Ошибка при проверке подключения' }, { status: 500 })
  }
}
