import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/settings/telegram — получить настройки Telegram бота
export async function GET() {
  try {
    const settings = await db.telegramSettings.findFirst()
    if (!settings) {
      const created = await db.telegramSettings.create({ data: {} })
      return NextResponse.json({
        ...created,
        botToken: created.botToken ? '••••••••' : '',
      })
    }
    return NextResponse.json({
      ...settings,
      botToken: settings.botToken ? '••••••••' : '',
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

    const data = {
      botToken,
      webhookUrl: body.webhookUrl ?? '',
      chatId: body.chatId ?? '',
      allowedUsers: body.allowedUsers ?? '[]',
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
    })
  } catch (error) {
    console.error('Error saving telegram settings:', error)
    return NextResponse.json({ error: 'Не удалось сохранить настройки Telegram' }, { status: 500 })
  }
}

// POST /api/settings/telegram — тест подключения к Telegram Bot API
export async function POST() {
  try {
    const settings = await db.telegramSettings.findFirst()

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
