/**
 * AI Assistant API Route
 * Uses stored AI settings (DeepSeek, Qwen, Z-AI, etc.)
 */
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `Ты — ИИ-ассистент компании ПРОМЕБЕЛЬ (мебельное производство). Ты помогаешь сотрудникам управлять закупками и оптимизировать процессы снабжения.

Твои основные компетенции:
1. Управление закупками — помощь в создании запросов поставщикам, отслеживании статусов заказов
2. Анализ поставщиков — оценка надёжности, сравнение условий
3. Бюджетирование — анализ бюджетов, предложения по оптимизации затрат
4. Складской учёт — рекомендации по пополнению запасов
5. Работа со счетами — проверка, сверка, контроль оплат
6. Отчётность — формирование сводок и аналитики

Правила общения:
- Отвечай на русском языке
- Будь профессиональным, но дружелюбным
- Давай конкретные и практические рекомендации
- Используй структурированные списки для сложных ответов`

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 })
    }

    // Get stored AI settings
    const settings = await db.aiSettings.findFirst()

    if (settings?.provider && settings.provider !== 'z-ai' && settings.apiKey) {
      // Use DeepSeek/OpenAI/Qwen compatible API
      let baseUrl = settings.apiEndpoint
      if (settings.provider === 'deepseek') {
        baseUrl = baseUrl || 'https://api.deepseek.com'
      } else if (settings.provider === 'qwen') {
        baseUrl = settings.apiEndpoint || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      }

      if (baseUrl) {
        const chatUrl = `${baseUrl.replace(/\/$/, '')}/chat/completions`
        const trimmedMessages = messages.slice(-20)

        const response = await fetch(chatUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`,
          },
          body: JSON.stringify({
            model: settings.model || 'deepseek-chat',
            messages: [
              { role: 'system', content: settings.systemPrompt || SYSTEM_PROMPT },
              ...trimmedMessages,
            ],
            temperature: settings.temperature ?? 0.7,
            max_tokens: settings.maxTokens ?? 4096,
          }),
        })

        if (!response.ok) {
          const errText = await response.text()
          console.error(`AI API error (${settings.provider}): ${response.status} ${errText}`)
          return NextResponse.json(
            { error: `Ошибка ИИ API (${response.status}): проверьте настройки и API ключ` },
            { status: 503 }
          )
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content

        if (content) {
          return NextResponse.json({ response: content })
        }
      }
    }

    // Fallback: try z-ai-web-dev-sdk
    try {
      const ZAI = (await import('z-ai-web-dev-sdk')).default
      const zai = await ZAI.create()
      const trimmedMessages = messages.slice(-20)

      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: SYSTEM_PROMPT },
          ...trimmedMessages,
        ],
        thinking: { type: 'disabled' },
      })

      const response = completion.choices[0]?.message?.content
      if (response) {
        return NextResponse.json({ response })
      }
    } catch (sdkError: any) {
      console.warn('z-ai-web-dev-sdk unavailable:', sdkError.message)
    }

    return NextResponse.json(
      { error: 'ИИ-ассистент временно недоступен. Настройте API-ключ в разделе Настройки → ИИ-провайдер.' },
      { status: 503 }
    )
  } catch (error) {
    console.error('Assistant API error:', error)
    return NextResponse.json(
      { error: 'Произошла ошибка при обработке запроса' },
      { status: 500 }
    )
  }
}

