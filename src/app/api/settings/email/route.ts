/**
 * Email Settings API Route
 *
 * TODO: M005/S01 - This route was not part of the API migration slice.
 * This endpoint manages email settings stored in Prisma.
 * Future migration: Create equivalent FastAPI settings endpoints.
 */
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { ImapFlow } from 'imapflow'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

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

// POST /api/settings/email — тест подключения (реальный SMTP/IMAP)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { testType } = body // 'smtp' | 'imap'

    // Получаем текущие настройки из БД для подстановки реальных паролей
    const existing = await db.emailSettings.findFirst()

    // Вспомогательная функция: получить реальный пароль (если с фронтенда пришла маска)
    const resolveSmtpPassword = (pwd: string | undefined) => {
      if (pwd && pwd !== '••••••••') return pwd
      return existing?.smtpPassword ?? ''
    }
    const resolveImapPassword = (pwd: string | undefined) => {
      if (pwd && pwd !== '••••••••') return pwd
      return existing?.imapPassword ?? ''
    }

    if (testType === 'smtp') {
      const smtpHost = body.smtpHost || existing?.smtpHost || ''
      const smtpPort = body.smtpPort || existing?.smtpPort || 587
      const smtpUser = body.smtpUser || existing?.smtpUser || ''
      const smtpPassword = resolveSmtpPassword(body.smtpPassword)
      const smtpEncryption = body.smtpEncryption || existing?.smtpEncryption || 'tls'

      if (!smtpHost) {
        // Сохраняем ошибку тестирования
        if (existing) {
          await db.emailSettings.update({
            where: { id: existing.id },
            data: { smtpTestResult: 'error', smtpLastTestedAt: new Date() },
          })
        }
        return NextResponse.json({ success: false, error: 'Укажите SMTP сервер' })
      }
      if (!smtpUser) {
        if (existing) {
          await db.emailSettings.update({
            where: { id: existing.id },
            data: { smtpTestResult: 'error', smtpLastTestedAt: new Date() },
          })
        }
        return NextResponse.json({ success: false, error: 'Укажите пользователя SMTP' })
      }
      if (!smtpPassword) {
        if (existing) {
          await db.emailSettings.update({
            where: { id: existing.id },
            data: { smtpTestResult: 'error', smtpLastTestedAt: new Date() },
          })
        }
        return NextResponse.json({ success: false, error: 'Укажите пароль SMTP' })
      }

      // Определяем параметры шифрования
      const useTLS = smtpEncryption === 'tls'
      const useSSL = smtpEncryption === 'ssl'

      const transport = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: useSSL, // SSL = true для порта 465
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
        tls: useTLS
          ? {
              // Не отклонять самоподписанные сертификаты
              rejectUnauthorized: false,
            }
          : undefined,
        connectionTimeout: 15000, // 15 секунд таймаут
        greetingTimeout: 10000,
        socketTimeout: 15000,
      })

      try {
        await transport.verify()

        // Успешное подключение — обновляем статус в БД
        if (existing) {
          await db.emailSettings.update({
            where: { id: existing.id },
            data: {
              isConfigured: true,
              lastCheckedAt: new Date(),
              smtpTestResult: 'success',
              smtpLastTestedAt: new Date(),
            },
          })
        }

        await transport.close()
        return NextResponse.json({
          success: true,
          message: `SMTP подключение к ${smtpHost}:${smtpPort} — успешно. Аутентификация пройдена.`,
        })
      } catch (smtpError: unknown) {
        await transport.close()

        // Сохраняем ошибку тестирования в БД
        if (existing) {
          await db.emailSettings.update({
            where: { id: existing.id },
            data: { smtpTestResult: 'error', smtpLastTestedAt: new Date() },
          })
        }

        const errMsg = smtpError instanceof Error ? smtpError.message : String(smtpError)

        // Формируем понятное сообщение об ошибке на русском
        let ruMessage = `Ошибка подключения к SMTP ${smtpHost}:${smtpPort}: ${errMsg}`
        if (errMsg.includes('EAUTH') || errMsg.includes('Invalid login')) {
          ruMessage = `Ошибка аутентификации SMTP: неверный логин или пароль для ${smtpUser}@${smtpHost}`
        } else if (errMsg.includes('ECONNREFUSED')) {
          ruMessage = `Сервер ${smtpHost}:${smtpPort} отклонил соединение. Проверьте адрес и порт SMTP.`
        } else if (errMsg.includes('ENOTFOUND') || errMsg.includes('getaddrinfo')) {
          ruMessage = `Не удалось найти SMTP сервер ${smtpHost}. Проверьте правильность адреса.`
        } else if (errMsg.includes('ETIMEDOUT') || errMsg.includes('timeout')) {
          ruMessage = `Таймаут подключения к SMTP ${smtpHost}:${smtpPort}. Сервер не отвечает.`
        } else if (errMsg.includes('ESOCKET') || errMsg.includes('SSL') || errMsg.includes('TLS')) {
          ruMessage = `Ошибка шифрования при подключении к SMTP ${smtpHost}. Проверьте настройки шифрования (TLS/SSL/Нет).`
        }

        return NextResponse.json({ success: false, error: ruMessage })
      }
    }

    if (testType === 'imap') {
      const imapHost = body.imapHost || existing?.imapHost || ''
      const imapPort = body.imapPort || existing?.imapPort || 993
      const imapUser = body.imapUser || existing?.imapUser || ''
      const imapPassword = resolveImapPassword(body.imapPassword)
      const imapEncryption = body.imapEncryption || existing?.imapEncryption || 'ssl'

      if (!imapHost) {
        if (existing) {
          await db.emailSettings.update({
            where: { id: existing.id },
            data: { imapTestResult: 'error', imapLastTestedAt: new Date() },
          })
        }
        return NextResponse.json({ success: false, error: 'Укажите IMAP сервер' })
      }
      if (!imapUser) {
        if (existing) {
          await db.emailSettings.update({
            where: { id: existing.id },
            data: { imapTestResult: 'error', imapLastTestedAt: new Date() },
          })
        }
        return NextResponse.json({ success: false, error: 'Укажите пользователя IMAP' })
      }
      if (!imapPassword) {
        if (existing) {
          await db.emailSettings.update({
            where: { id: existing.id },
            data: { imapTestResult: 'error', imapLastTestedAt: new Date() },
          })
        }
        return NextResponse.json({ success: false, error: 'Укажите пароль IMAP' })
      }

      const useTLS = imapEncryption === 'ssl' || imapEncryption === 'tls'

      const client = new ImapFlow({
        host: imapHost,
        port: imapPort,
        secure: useTLS,
        auth: {
          user: imapUser,
          pass: imapPassword,
        },
        tls: {
          rejectUnauthorized: false,
        },
        logger: false as unknown as undefined, // Отключаем логирование imapflow
      })

      try {
        // Пытаемся подключиться и залогиниться
        await client.connect()

        // Успешное подключение — обновляем статус в БД и закрываем
        if (existing) {
          await db.emailSettings.update({
            where: { id: existing.id },
            data: { imapTestResult: 'success', imapLastTestedAt: new Date() },
          })
        }

        await client.logout()

        return NextResponse.json({
          success: true,
          message: `IMAP подключение к ${imapHost}:${imapPort} — успешно. Аутентификация пройдена.`,
        })
      } catch (imapError: unknown) {
        // Пробуем закрыть соединение при ошибке
        try { await client.logout() } catch { /* ignore */ }

        // Сохраняем ошибку тестирования в БД
        if (existing) {
          await db.emailSettings.update({
            where: { id: existing.id },
            data: { imapTestResult: 'error', imapLastTestedAt: new Date() },
          })
        }

        const errMsg = imapError instanceof Error ? imapError.message : String(imapError)

        // Формируем понятное сообщение об ошибке на русском
        let ruMessage = `Ошибка подключения к IMAP ${imapHost}:${imapPort}: ${errMsg}`
        if (errMsg.includes('AUTHENTICATIONFAILED') || errMsg.includes('Invalid credentials') || errMsg.includes('login failed')) {
          ruMessage = `Ошибка аутентификации IMAP: неверный логин или пароль для ${imapUser}@${imapHost}`
        } else if (errMsg.includes('ECONNREFUSED')) {
          ruMessage = `Сервер ${imapHost}:${imapPort} отклонил соединение. Проверьте адрес и порт IMAP.`
        } else if (errMsg.includes('ENOTFOUND') || errMsg.includes('getaddrinfo')) {
          ruMessage = `Не удалось найти IMAP сервер ${imapHost}. Проверьте правильность адреса.`
        } else if (errMsg.includes('ETIMEDOUT') || errMsg.includes('timeout') || errMsg.includes('Timeout')) {
          ruMessage = `Таймаут подключения к IMAP ${imapHost}:${imapPort}. Сервер не отвечает.`
        } else if (errMsg.includes('SSL') || errMsg.includes('TLS') || errMsg.includes('certificate')) {
          ruMessage = `Ошибка шифрования при подключении к IMAP ${imapHost}. Проверьте настройки шифрования (SSL/TLS).`
        }

        return NextResponse.json({ success: false, error: ruMessage })
      }
    }

    return NextResponse.json({ success: false, error: 'Неизвестный тип теста. Укажите testType: "smtp" или "imap".' })
  } catch (error) {
    console.error('Error testing email connection:', error)
    return NextResponse.json({ success: false, error: 'Ошибка при проверке подключения' }, { status: 500 })
  }
}
