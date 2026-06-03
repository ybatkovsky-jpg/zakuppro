/**
 * Send Email API Route
 *
 * TODO: M005/S01 - This route was not part of the API migration slice.
 * This endpoint sends emails through SMTP using Prisma settings.
 * Future migration: Integrate with FastAPI email service.
 */
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { db } from '@/lib/db'

// POST /api/email/send — отправить письмо через настроенный SMTP
export async function POST(request: NextRequest) {
  let transport: nodemailer.Transporter | null = null

  try {
    const body = await request.json()
    const { to, subject, body: emailBody, cc, bcc, replyTo, projectId, supplierId } = body as {
      to?: string
      subject?: string
      body?: string
      cc?: string[]
      bcc?: string[]
      replyTo?: string
      projectId?: string
      supplierId?: string
    }

    // Валидация обязательных полей
    if (!to || !to.trim()) {
      return NextResponse.json(
        { error: 'Укажите адрес получателя (поле "to")' },
        { status: 400 }
      )
    }
    if (!subject || !subject.trim()) {
      return NextResponse.json(
        { error: 'Укажите тему письма (поле "subject")' },
        { status: 400 }
      )
    }
    if (!emailBody) {
      return NextResponse.json(
        { error: 'Укажите тело письма (поле "body")' },
        { status: 400 }
      )
    }

    // Получаем настройки SMTP из БД
    const settings = await db.emailSettings.findFirst()
    if (!settings) {
      return NextResponse.json(
        { error: 'Настройки почты не найдены. Сначала настройте SMTP в разделе "Настройки".' },
        { status: 400 }
      )
    }

    if (!settings.smtpHost || !settings.smtpUser || !settings.smtpPassword) {
      return NextResponse.json(
        { error: 'SMTP не настроен. Укажите сервер, пользователя и пароль в разделе "Настройки".' },
        { status: 400 }
      )
    }

    if (!settings.senderEmail) {
      return NextResponse.json(
        { error: 'Не указан email отправителя. Настройте поле "Email отправителя" в настройках.' },
        { status: 400 }
      )
    }

    // Проверяем, что пароль не замаскирован (не должен быть для отправки)
    if (settings.smtpPassword === '••••••••') {
      return NextResponse.json(
        { error: 'Пароль SMTP замаскирован. Пересохраните настройки почты.' },
        { status: 400 }
      )
    }

    // Определяем параметры шифрования
    const useTLS = settings.smtpEncryption === 'tls'
    const useSSL = settings.smtpEncryption === 'ssl'

    // Создаём транспорт
    transport = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort,
      secure: useSSL,
      auth: {
        user: settings.smtpUser,
        pass: settings.smtpPassword,
      },
      tls: useTLS
        ? { rejectUnauthorized: false }
        : undefined,
      connectionTimeout: 30000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
    })

    // Формируем From
    const fromAddress = settings.senderName
      ? `"${settings.senderName}" <${settings.senderEmail}>`
      : settings.senderEmail

    // Добавляем подпись к телу письма
    const fullBody = settings.emailSignature
      ? `${emailBody}<br><br>--<br>${settings.emailSignature.replace(/\n/g, '<br>')}`
      : emailBody

    // Собираем письмо
    const mailOptions: nodemailer.SendMailOptions = {
      from: fromAddress,
      to: to.trim(),
      subject: subject.trim(),
      html: fullBody,
    }

    if (cc && Array.isArray(cc) && cc.length > 0) {
      mailOptions.cc = cc.filter(c => c?.trim()).join(', ')
    }
    if (bcc && Array.isArray(bcc) && bcc.length > 0) {
      mailOptions.bcc = bcc.filter(b => b?.trim()).join(', ')
    }
    if (replyTo?.trim()) {
      mailOptions.replyTo = replyTo.trim()
    }

    // Отправляем письмо
    const result = await transport.sendMail(mailOptions)

    // Логируем отправленное письмо
    await db.emailLog.create({
      data: {
        projectId: projectId || null,
        supplierId: supplierId || null,
        direction: 'outgoing',
        subject: subject.trim(),
        body: emailBody,
        from: fromAddress,
        to: to.trim(),
        sentAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: `Письмо успешно отправлено на ${to.trim()}`,
    })
  } catch (error: unknown) {
    console.error('Error sending email:', error)

    const errMsg = error instanceof Error ? error.message : String(error)

    // Формируем понятное сообщение об ошибке на русском
    let ruMessage = `Ошибка отправки письма: ${errMsg}`
    if (errMsg.includes('EAUTH') || errMsg.includes('Invalid login')) {
      ruMessage = 'Ошибка аутентификации SMTP: неверный логин или пароль. Проверьте настройки.'
    } else if (errMsg.includes('ECONNREFUSED')) {
      ruMessage = 'SMTP сервер отклонил соединение. Проверьте адрес и порт сервера.'
    } else if (errMsg.includes('ENOTFOUND') || errMsg.includes('getaddrinfo')) {
      ruMessage = 'Не удалось найти SMTP сервер. Проверьте правильность адреса.'
    } else if (errMsg.includes('ETIMEDOUT') || errMsg.includes('timeout')) {
      ruMessage = 'Таймаут подключения к SMTP серверу. Сервер не отвечает.'
    } else if (errMsg.includes('ESOCKET') || errMsg.includes('SSL') || errMsg.includes('TLS')) {
      ruMessage = 'Ошибка шифрования при подключении к SMTP. Проверьте настройки шифрования (TLS/SSL).'
    }

    return NextResponse.json(
      { success: false, error: ruMessage },
      { status: 500 }
    )
  } finally {
    // Всегда закрываем транспорт
    if (transport) {
      try {
        await transport.close()
      } catch {
        // игнорируем ошибку закрытия
      }
    }
  }
}
