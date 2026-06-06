/**
 * AI Assistant API Route
 *
 * Uses z-ai-web-dev-sdk if configured, otherwise falls back to FastAPI
 * LLM provider. If neither is available, returns a helpful error message.
 */
import { apiFetch } from '@/lib/api-client'
import { NextResponse } from 'next/server'

const SYSTEM_PROMPT = `Ты — ИИ-ассистент компании ПРОМЕБЕЛЬ (мебельное производство). Ты помогаешь сотрудникам управлять закупками и оптимизировать процессы снабжения.

Твои основные компетенции:
1. **Управление закупками** — помощь в создании запросов поставщикам, отслеживании статусов заказов, контроле сроков поставки
2. **Анализ поставщиков** — оценка надёжности поставщиков, сравнение условий, рекомендации по выбору
3. **Бюджетирование** — анализ бюджетов проектов, выявление перерасходов, предложения по оптимизации затрат
4. **Складской учёт** — рекомендации по пополнению запасов, анализ оборачиваемости, предупреждение о дефиците
5. **Работа с счетами** — помощь в проверке счетов, сверке с запросами, контроль оплат
6. **Отчётность** — формирование сводок, аналитических отчётов, KPI по закупкам

Контекст о компании ПРОМЕБЕЛЬ:
- Специализация: производство корпусной и мягкой мебели
- Основные закупаемые категории материалов: ДСП/МДФ, фурнитура, ткани, поролон, клей, кромка, стекло, зеркала, электротехника
- Типовые поставщики: производители плитных материалов, дилеры фурнитуры, текстильные фабрики, производители химии
- Процессы: от заявки на закупку до получения товара на склад и оплаты счета
- Статусы проектов: новый → в обработке → запрошено → счёт выставлен → оплачено → доставлено → завершён

Правила общения:
- Отвечай на русском языке
- Будь профессиональным, но дружелюбным
- Давай конкретные и практические рекомендации
- Если не хватает данных, спрашивай уточняющие вопросы
- Используй структурированные списки и таблицы для сложных ответов
- Предлагай конкретные действия с указанием следующих шагов`

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return Response.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    // Try z-ai-web-dev-sdk first
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
        return Response.json({ response })
      }
    } catch (sdkError: any) {
      console.warn('z-ai-web-dev-sdk unavailable, trying FastAPI fallback:', sdkError.message)
    }

    // Fallback: try FastAPI /api/assistant endpoint
    try {
      const trimmedMessages = messages.slice(-20)
      const result = await apiFetch<{ response: string }>('/api/assistant/chat', {
        method: 'POST',
        body: {
          messages: trimmedMessages,
          system_prompt: SYSTEM_PROMPT,
        },
      })

      if (result.data?.response) {
        return Response.json({ response: result.data.response })
      }
    } catch (fallbackError: any) {
      console.warn('FastAPI assistant fallback unavailable:', fallbackError.message)
    }

    // No LLM available
    return Response.json(
      { error: 'ИИ-ассистент временно недоступен. Для работы требуется настроить API-ключ LLM (OpenAI, Anthropic или Gemini) в настройках системы.' },
      { status: 503 }
    )
  } catch (error) {
    console.error('Assistant API error:', error)
    return Response.json(
      { error: 'Произошла ошибка при обработке запроса' },
      { status: 500 }
    )
  }
}
