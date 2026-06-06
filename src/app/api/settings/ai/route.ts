/**
 * AI Settings API Route
 * Supports: z-ai, deepseek, openai, anthropic, qwen, yandex, custom
 */
import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const SYSTEM_PROMPT_DEFAULT = `Ты — ИИ-ассистент компании ПРОМЕБЕЛЬ, занимающейся производством мебели.
Твоя задача — помогать в управлении закупками: анализировать потребности, находить поставщиков,
оптимизировать затраты и отслеживать статус заказов.

Компетенции:
1. Управление закупками (ДСП, МДФ, фурнитура, ткани, поролон, крепёж)
2. Анализ поставщиков и сравнение предложений
3. Бюджетирование и контроль расходов
4. Управление складскими запасами
5. Обработка счетов и сверка
6. Подготовка отчётов и аналитики

Отвечай на русском языке, профессионально и по существу.`

// GET /api/settings/ai
export async function GET() {
  try {
    const settings = await db.aiSettings.findFirst()
    if (!settings) {
      const created = await db.aiSettings.create({
        data: {
          provider: 'deepseek',
          model: 'deepseek-chat',
          temperature: 0.7,
          maxTokens: 4096,
          systemPrompt: SYSTEM_PROMPT_DEFAULT,
        },
      })
      return NextResponse.json({
        ...created,
        apiKey: created.apiKey ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : '',
      })
    }
    return NextResponse.json({
      ...settings,
      apiKey: settings.apiKey ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : '',
    })
  } catch (error) {
    console.error('Error fetching AI settings:', error)
    return NextResponse.json({ error: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0418\u0418' }, { status: 500 })
  }
}

// PUT /api/settings/ai
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const existing = await db.aiSettings.findFirst()

    const maskedKey = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'
    const apiKey = body.apiKey === maskedKey && existing?.apiKey
      ? existing.apiKey
      : body.apiKey ?? ''

    const isConfigured = body.provider === 'z-ai' ? true : !!apiKey

    const data = {
      provider: body.provider ?? 'deepseek',
      model: body.model ?? 'deepseek-chat',
      apiKey,
      apiEndpoint: body.apiEndpoint ?? '',
      temperature: body.temperature ?? 0.7,
      maxTokens: body.maxTokens ?? 4096,
      systemPrompt: body.systemPrompt ?? '',
      isConfigured,
    }

    let result
    if (existing) {
      result = await db.aiSettings.update({ where: { id: existing.id }, data })
    } else {
      result = await db.aiSettings.create({ data })
    }

    return NextResponse.json({
      ...result,
      apiKey: result.apiKey ? maskedKey : '',
    })
  } catch (error) {
    console.error('Error saving AI settings:', error)
    return NextResponse.json({ error: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0418\u0418' }, { status: 500 })
  }
}

// POST /api/settings/ai — test connection
export async function POST(_request: NextRequest) {
  try {
    const settings = await db.aiSettings.findFirst()

    if (!settings) {
      return NextResponse.json({ success: false, error: '\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438 \u0418\u0418 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b.' })
    }

    // Test DeepSeek/OpenAI-compatible provider
    if (settings.provider === 'deepseek' || settings.provider === 'openai' || settings.provider === 'qwen' || settings.provider === 'custom') {
      if (!settings.apiKey) {
        return NextResponse.json({ success: false, error: `API \u043a\u043b\u044e\u0447 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d \u0434\u043b\u044f \u043f\u0440\u043e\u0432\u0430\u0439\u0434\u0435\u0440\u0430 ${settings.provider}` })
      }

      let baseUrl = settings.apiEndpoint
      if (settings.provider === 'deepseek') {
        baseUrl = baseUrl || 'https://api.deepseek.com'
      } else if (settings.provider === 'qwen') {
        baseUrl = baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      }

      if (!baseUrl) {
        return NextResponse.json({ success: false, error: '\u041d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d API endpoint' })
      }

      const testUrl = `${baseUrl.replace(/\/$/, '')}/chat/completions`
      const testResponse = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model,
          messages: [
            { role: 'user', content: '\u041e\u0442\u0432\u0435\u0442\u044c \u043e\u0434\u043d\u0438\u043c \u0441\u043b\u043e\u0432\u043e\u043c: \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442' },
          ],
          max_tokens: 20,
        }),
      })

      if (!testResponse.ok) {
        const errBody = await testResponse.text()
        await db.aiSettings.update({
          where: { id: settings.id },
          data: { lastTestedAt: new Date(), testResult: `error: ${testResponse.status}` },
        })
        return NextResponse.json({
          success: false,
          error: `\u041e\u0448\u0438\u0431\u043a\u0430 API (${testResponse.status}): ${errBody.slice(0, 200)}`,
        })
      }

      const data = await testResponse.json()
      const answer = data.choices?.[0]?.message?.content || ''

      await db.aiSettings.update({
        where: { id: settings.id },
        data: { lastTestedAt: new Date(), testResult: 'success', isConfigured: true },
      })

      return NextResponse.json({
        success: true,
        message: `\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 \u043a ${settings.provider} (${settings.model}) \u2014 \u0443\u0441\u043f\u0435\u0448\u043d\u043e. \u041e\u0442\u0432\u0435\u0442: "${answer.slice(0, 50)}"`,
      })
    }

    // Test z-ai provider
    if (settings.provider === 'z-ai') {
      try {
        const zai = await ZAI.create()
        const completion = await zai.chat.completions.create({
          messages: [
            { role: 'assistant', content: '\u0422\u0435\u0441\u0442.' },
            { role: 'user', content: '\u041e\u0442\u0432\u0435\u0442\u044c \u043e\u0434\u043d\u0438\u043c \u0441\u043b\u043e\u0432\u043e\u043c: \u0440\u0430\u0431\u043e\u0442\u0430\u0435\u0442' },
          ],
          thinking: { type: 'disabled' },
        })

        const response = completion.choices[0]?.message?.content
        if (!response) {
          await db.aiSettings.update({
            where: { id: settings.id },
            data: { lastTestedAt: new Date(), testResult: 'warning: empty response' },
          })
          return NextResponse.json({ success: false, error: '\u041f\u0443\u0441\u0442\u043e\u0439 \u043e\u0442\u0432\u0435\u0442' })
        }

        await db.aiSettings.update({
          where: { id: settings.id },
          data: { lastTestedAt: new Date(), testResult: 'success' },
        })
        return NextResponse.json({
          success: true,
          message: `\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 \u043a Z-AI (${settings.model}) \u2014 \u0443\u0441\u043f\u0435\u0448\u043d\u043e.`,
        })
      } catch (aiError: unknown) {
        const errMsg = aiError instanceof Error ? aiError.message : String(aiError)
        await db.aiSettings.update({
          where: { id: settings.id },
          data: { lastTestedAt: new Date(), testResult: `error: ${errMsg}` },
        })
        return NextResponse.json({ success: false, error: `\u041e\u0448\u0438\u0431\u043a\u0430 Z-AI: ${errMsg}` })
      }
    }

    return NextResponse.json({ success: false, error: `\u041f\u0440\u043e\u0432\u0430\u0439\u0434\u0435\u0440 "${settings.provider}" \u043d\u0435 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044f \u0434\u043b\u044f \u0442\u0435\u0441\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044f` })
  } catch (error) {
    console.error('AI test error:', error)
    return NextResponse.json({ success: false, error: '\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u0440\u0438 \u0442\u0435\u0441\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0438' })
  }
}

