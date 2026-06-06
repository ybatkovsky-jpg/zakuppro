/**
 * Telegram Settings API Route
 *
 * TODO: M005/S01 - This route was not part of the API migration slice.
 * This endpoint manages Telegram bot settings stored in Prisma.
 * Future migration: Create equivalent FastAPI settings endpoints.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET /api/settings/telegram — получить настройки Telegram бота
// ?raw=true — вернуть реальный токен (для внутреннего использования ботом)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const raw = searchParams.get('raw') === 'true'

    const settings = await db.telegramSettings.findFirst()
    if (!settings) {
      const created = await db.telegramSettings.create({ data: {} })
      return NextResponse.json({
        ...created,
        botToken: raw ? created.botToken : (created.botToken ? '••••••••' : ''),
        allowedChatIds: '',
      })
    }
    return NextResponse.json({
      ...settings,
      botToken: raw ? settings.botToken : (settings.botToken ? '••••••••' : ''),
      allowedChatIds: settings.allowedUsers
        ? (() => { try { return JSON.parse(settings.allowedUsers).join(', ') } catch { return settings.allowedUsers } })()
        : '',
    })
  } catch (error) {
    console.error('Error fetching telegram settings:', error)
    return NextResponse.json({ error: 'Не удалось загрузить настройки Telegram' }, { status: 500 })
  }
}

// PUT /api/settings/telegram — сохранить настройки Telegram
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const existing = await db.telegramSettings.findFirst()

    // Не перезаписываем токен-заглушку
    const botToken = body.botToken === '••••••••' && existing?.botToken
      ? existing.botToken
      : body.botToken ?? ''

    const isConfigured = !!botToken

    // allowedChatIds: comma-separated string like "600270757, 123456789"
    const allowedChatIds = body.allowedChatIds ?? ''
    // Store as JSON array for backward compat with allowedUsers field
    const allowedUsers = allowedChatIds
      ? JSON.stringify(allowedChatIds.split(',').map((s: string) => s.trim()).filter(Boolean))
      : '[]'

    const data = {
      botToken,
      webhookUrl: body.webhookUrl ?? '',
      chatId: body.chatId ?? '',
      allowedUsers,
      isConfigured,
      isEnabled: body.isEnabled ?? false,
    }

    let result
    if (existing) {
      result = await db.telegramSettings.update({
        where: { id: existing.id },
        data,
      })
    } else {
      result = await db.telegramSettings.create({ data })
    }

    return NextResponse.json({
      ...result,
      botToken: result.botToken ? '••••••••' : '',
      allowedChatIds: result.allowedUsers ? JSON.parse(result.allowedUsers).join(', ') : '',
    })
  } catch (error) {
    console.error('Error saving telegram settings:', error)
    return NextResponse.json({ error: 'Не удалось сохранить настройки Telegram' }, { status: 500 })
  }
}

// POST /api/settings/telegram — тест подключения к Telegram Bot API или включение/выключение бота
// Body: { action: 'test' } — тест подключения (по умолчанию)
// Body: { isEnabled: true/false } — включить/выключить бота
export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown> = {}
    try {
      body = await request.json()
    } catch {
      // Пустое тело — тест подключения
    }

    const settings = await db.telegramSettings.findFirst()

    // ── Включение/выключение бота ──────────────────────────────
    if (typeof body.isEnabled === 'boolean') {
      const isEnabled = body.isEnabled as boolean

      if (!settings) {
        const created = await db.telegramSettings.create({
          data: { isEnabled, isConfigured: false },
        })
        return NextResponse.json({
          success: true,
          isEnabled,
          message: isEnabled ? 'Бот включён' : 'Бот выключен',
          botToken: created.botToken ? '••••••••' : '',
        })
      }

      await db.telegramSettings.update({
        where: { id: settings.id },
        data: {
          isEnabled,
          isConfigured: !!settings.botToken,
        },
      })

      return NextResponse.json({
        success: true,
        isEnabled,
        message: isEnabled ? 'Бот включён' : 'Бот выключен',
      })
    }

    // ── Тест подключения (по умолчанию) ───────────────────────
    if (!settings || !settings.botToken) {
      return NextResponse.json({ success: false, error: 'Укажите токен бота' })
    }

    // Реальная проверка токена через Telegram API
    const response = await fetch(`https://api.telegram.org/bot${settings.botToken}/getMe`)
    const data = await response.json()

    if (data.ok) {
      await db.telegramSettings.update({
        where: { id: settings.id },
        data: { lastMessageAt: new Date() },
      })
      return NextResponse.json({
        success: true,
        message: `Бот @${data.result.username} (${data.result.first_name}) — подключён`,
        botInfo: data.result,
      })
    } else {
      return NextResponse.json({
        success: false,
        error: `Ошибка Telegram API: ${data.description || 'Неверный токен'}`,
      })
    }
  } catch (error) {
    console.error('Error testing telegram connection:', error)
    return NextResponse.json({ success: false, error: 'Ошибка при проверке подключения к Telegram' }, { status: 500 })
  }
}
