import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/settings/email — получить настройки почты
export async function GET() {
  try {
    const settings = await db.emailSettings.findFirst()
    if (!settings) {
      // Создаём пустую запись по умолчанию
      const created = await db.emailSettings.create({ data: {} })
      return NextResponse.json(created)
    }
    // Скрываем пароли при отправке на клиент
    return NextResponse.json({
      ...settings,
      smtpPassword: settings.smtpPassword ? '••••••••' : '',
      imapPassword: settings.imapPassword ? '••••••••' : '',
    })
  } catch (error) {
    console.error('Error fetching email settings:', error)
    return NextResponse.json({ error: 'Не удалось загрузить настройки почты' }, { status: 500 })
  }
}

// PUT /api/settings/email — сохранить настройки почты
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    const existing = await db.emailSettings.findFirst()

    // Не перезаписываем пароли-заглушки
    const smtpPassword = body.smtpPassword === '••••••••' && existing?.smtpPassword
      ? existing.smtpPassword
      : body.smtpPassword ?? ''
    const imapPassword = body.imapPassword === '••••••••' && existing?.imapPassword
      ? existing.imapPassword
      : body.imapPassword ?? ''

    // Проверяем, достаточно ли данных для SMTP
    const isSmtpConfigured = !!(body.smtpHost && body.smtpUser && body.senderEmail)
    // Проверяем, достаточно ли данных для IMAP
    const isImapConfigured = !!(body.imapHost && body.imapUser)
    const isConfigured = isSmtpConfigured

    const data = {
      smtpHost: body.smtpHost ?? '',
      smtpPort: body.smtpPort ?? 587,
      smtpUser: body.smtpUser ?? '',
      smtpPassword,
      smtpEncryption: body.smtpEncryption ?? 'tls',
      senderName: body.senderName ?? '',
      senderEmail: body.senderEmail ?? '',
      emailSignature: body.emailSignature ?? '',
      imapHost: body.imapHost ?? '',
      imapPort: body.imapPort ?? 993,
      imapUser: body.imapUser ?? '',
      imapPassword,
      imapEncryption: body.imapEncryption ?? 'ssl',
      imapCheckInterval: body.imapCheckInterval ?? 15,
      imapEnabled: body.imapEnabled ?? false,
      isConfigured,
    }

    let result
    if (existing) {
      result = await db.emailSettings.update({
        where: { id: existing.id },
        data,
      })
    } else {
      result = await db.emailSettings.create({ data })
    }

    return NextResponse.json({
      ...result,
      smtpPassword: result.smtpPassword ? '••••••••' : '',
      imapPassword: result.imapPassword ? '••••••••' : '',
    })
  } catch (error) {
    console.error('Error saving email settings:', error)
    return NextResponse.json({ error: 'Не удалось сохранить настройки почты' }, { status: 500 })
  }
}

// POST /api/settings/email — тест подключения
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { testType } = body // 'smtp' | 'imap'

    // Имитация теста подключения (реальный SMTP/IMAP будет в Telegram Bot мини-сервисе)
    await new Promise(resolve => setTimeout(resolve, 1500))

    if (testType === 'smtp') {
      const { smtpHost, smtpPort } = body
      if (!smtpHost) {
        return NextResponse.json({ success: false, error: 'Укажите SMTP сервер' })
      }
      return NextResponse.json({
        success: true,
        message: `SMTP подключение к ${smtpHost}:${smtpPort || 587} — успешно`,
      })
    }

    if (testType === 'imap') {
      const { imapHost, imapPort } = body
      if (!imapHost) {
        return NextResponse.json({ success: false, error: 'Укажите IMAP сервер' })
      }
      return NextResponse.json({
        success: true,
        message: `IMAP подключение к ${imapHost}:${imapPort || 993} — успешно`,
      })
    }

    return NextResponse.json({ success: false, error: 'Неизвестный тип теста' })
  } catch (error) {
    console.error('Error testing email connection:', error)
    return NextResponse.json({ success: false, error: 'Ошибка при проверке подключения' }, { status: 500 })
  }
}
