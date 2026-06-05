/**
 * Send Request Email API Route
 *
 * TODO: M005/S01 - This route was not part of the API migration slice.
 * This endpoint sends emails for purchase requests using Prisma data.
 * Future migration: Integrate with FastAPI email service.
 */
import { NextRequest, NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// POST /api/requests/[id]/send-email — отправить запрос поставщику по email
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let transport: nodemailer.Transporter | null = null

  try {
    const { id } = await params

    // Получаем запрос с проектом, поставщиком и позициями
    const purchaseRequest = await db.purchaseRequest.findUnique({
      where: { id },
      include: {
        project: true,
        supplier: true,
        items: {
          include: {
            projectItem: true,
          },
        },
      },
    })

    if (!purchaseRequest) {
      return NextResponse.json(
        { error: 'Запрос на закупку не найден' },
        { status: 404 }
      )
    }

    // Проверяем, можно ли отправить (только черновик)
    if (purchaseRequest.status !== 'draft') {
      return NextResponse.json(
        { error: `Запрос уже отправлен (статус: ${purchaseRequest.status}). Отправка возможна только для черновиков.` },
        { status: 400 }
      )
    }

    // Проверяем email поставщика
    if (!purchaseRequest.supplier.email && !purchaseRequest.emailTo) {
      return NextResponse.json(
        { error: `У поставщика "${purchaseRequest.supplier.name}" не указан email. Укажите email в карточке поставщика.` },
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

    // Проверяем, что пароль не замаскирован
    if (settings.smtpPassword === '••••••••') {
      return NextResponse.json(
        { error: 'Пароль SMTP замаскирован. Пересохраните настройки почты.' },
        { status: 400 }
      )
    }

    // Получаем реквизиты компании для подписи
    const company = await db.companyDetails.findFirst({ where: { isDefault: true } })

    // Формируем тему письма
    const emailSubject = purchaseRequest.emailSubject ||
      `Запрос коммерческого предложения — проект "${purchaseRequest.project.name}"`

    // Формируем тело письма с таблицей позиций
    const recipientName = purchaseRequest.supplier.contactPerson || purchaseRequest.supplier.name
    const projectName = purchaseRequest.project.name

    // Таблица позиций
    const itemRows = purchaseRequest.items
      .map((item, idx) => {
        const pi = item.projectItem
        return `<tr>
          <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: center;">${idx + 1}</td>
          <td style="padding: 6px 10px; border: 1px solid #ddd;">${pi.name}</td>
          <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: center;">${pi.article || '—'}</td>
          <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: center;">${item.quantity}</td>
          <td style="padding: 6px 10px; border: 1px solid #ddd; text-align: center;">${pi.unit}</td>
        </tr>`
      })
      .join('')

    const emailBody = `
      <div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">
        <p>Уважаемый поставщик!</p>
        <p>Прошу предоставить коммерческое предложение на следующие позиции для проекта <strong>«${projectName}»</strong>:</p>
        <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
          <thead>
            <tr style="background-color: #f5f5f5;">
              <th style="padding: 8px 10px; border: 1px solid #ddd; text-align: center;">№</th>
              <th style="padding: 8px 10px; border: 1px solid #ddd; text-align: left;">Наименование</th>
              <th style="padding: 8px 10px; border: 1px solid #ddd; text-align: center;">Артикул</th>
              <th style="padding: 8px 10px; border: 1px solid #ddd; text-align: center;">Кол-во</th>
              <th style="padding: 8px 10px; border: 1px solid #ddd; text-align: center;">Ед.</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>
        <p>Просим указать:</p>
        <ul>
          <li>Наличие на складе и доступное количество</li>
          <li>Актуальную цену с НДС</li>
          <li>Срок поставки</li>
        </ul>
        <br>
        <p>С уважением,<br>
        ${settings.senderName || company?.companyName || ''}<br>
        ${settings.senderEmail}<br>
        ${company?.phone || ''}</p>
      </div>
    `

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

    // Email получателя
    const recipientEmail = purchaseRequest.emailTo || purchaseRequest.supplier.email

    // Отправляем письмо
    const result = await transport.sendMail({
      from: fromAddress,
      to: recipientEmail,
      subject: emailSubject,
      html: emailBody,
    })

    // Обновляем статус запроса
    await db.purchaseRequest.update({
      where: { id },
      data: {
        status: 'sent',
        sentAt: new Date(),
        emailTo: recipientEmail,
        emailSubject,
        emailBody: emailBody.replace(/<[^>]*>/g, ''), // Сохраняем текстовую версию
      },
    })

    // Логируем отправленное письмо
    await db.emailLog.create({
      data: {
        projectId: purchaseRequest.projectId,
        supplierId: purchaseRequest.supplierId,
        direction: 'outgoing',
        subject: emailSubject,
        body: emailBody.replace(/<[^>]*>/g, ''),
        from: fromAddress,
        to: recipientEmail,
        sentAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: `Запрос успешно отправлен на ${recipientEmail}`,
      recipientEmail,
    })
  } catch (error: unknown) {
    console.error('Error sending request email:', error)

    const errMsg = error instanceof Error ? error.message : String(error)

    // Формируем понятное сообщение об ошибке на русском
    let ruMessage = `Ошибка отправки запроса: ${errMsg}`
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
