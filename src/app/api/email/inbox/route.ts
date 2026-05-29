import { NextRequest, NextResponse } from 'next/server'
import { ImapFlow, FetchMessageObject } from 'imapflow'
import { db } from '@/lib/db'

// GET /api/email/inbox — прочитать входящие письма через IMAP
export async function GET(request: NextRequest) {
  let client: ImapFlow | null = null

  try {
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const unseenParam = searchParams.get('unseen')
    const sinceParam = searchParams.get('since')

    const limit = Math.min(Math.max(parseInt(limitParam || '20', 10) || 20, 1), 100)
    const unseenOnly = unseenParam === 'true'
    const sinceDate = sinceParam ? new Date(sinceParam) : undefined

    // Проверяем валидность даты
    if (sinceParam && sinceDate && isNaN(sinceDate.getTime())) {
      return NextResponse.json(
        { error: 'Неверный формат даты в параметре "since". Используйте ISO формат.' },
        { status: 400 }
      )
    }

    // Получаем настройки IMAP из БД
    const settings = await db.emailSettings.findFirst()
    if (!settings) {
      return NextResponse.json(
        { error: 'Настройки почты не найдены. Сначала настройте IMAP в разделе "Настройки".' },
        { status: 400 }
      )
    }

    if (!settings.imapEnabled) {
      return NextResponse.json(
        { error: 'IMAP приём почты отключён. Включите его в настройках почты.' },
        { status: 400 }
      )
    }

    if (!settings.imapHost || !settings.imapUser || !settings.imapPassword) {
      return NextResponse.json(
        { error: 'IMAP не настроен. Укажите сервер, пользователя и пароль в разделе "Настройки".' },
        { status: 400 }
      )
    }

    // Проверяем, что пароль не замаскирован
    if (settings.imapPassword === '••••••••') {
      return NextResponse.json(
        { error: 'Пароль IMAP замаскирован. Пересохраните настройки почты.' },
        { status: 400 }
      )
    }

    // Определяем параметры шифрования
    const useTLS = settings.imapEncryption === 'ssl' || settings.imapEncryption === 'tls'

    // Создаём IMAP клиент
    client = new ImapFlow({
      host: settings.imapHost,
      port: settings.imapPort,
      secure: useTLS,
      auth: {
        user: settings.imapUser,
        pass: settings.imapPassword,
      },
      tls: {
        rejectUnauthorized: false,
      },
      logger: false as unknown as undefined,
    })

    // Подключаемся
    await client.connect()

    // Выбираем INBOX
    const lock = await client.getMailboxLock('INBOX')

    try {
      // Формируем параметры поиска
      const searchParams: Record<string, unknown> = {}
      if (unseenOnly) {
        searchParams.unseen = true
      }
      if (sinceDate && !isNaN(sinceDate.getTime())) {
        searchParams.since = sinceDate
      }

      // Ищем сообщения
      const messageIds = await client.search(searchParams)

      // Общая статистика
      const totalMessages = messageIds.length
      const unseenSearch = await client.search({ unseen: true })
      const totalUnseen = unseenSearch.length

      // Берём последние N сообщений (с конца списка)
      const fetchIds = messageIds.slice(-limit).reverse()

      const emails: Array<{
        uid: number
        from: string
        to: string
        subject: string
        date: string
        body: string
        isRead: boolean
        hasAttachments: boolean
      }> = []

      for (const msgId of fetchIds) {
        try {
          const message: FetchMessageObject = await client.fetchOne(msgId, {
            uid: true,
            from: true,
            to: true,
            subject: true,
            date: true,
            bodyText: true,
            flags: true,
            envelope: true,
          })

          const fromAddr = message.from
            ? (typeof message.from === 'object' && 'text' in message.from
              ? (message.from as { text: string }).text
              : String(message.from))
            : ''
          const toAddr = message.to
            ? (typeof message.to === 'object' && 'text' in message.to
              ? (message.to as { text: string }).text
              : String(message.to))
            : ''

          // Проверяем наличие вложений по структуре envelope
          let hasAttachments = false
          if (message.bodyStructure) {
            hasAttachments = checkForAttachments(message.bodyStructure)
          }

          const isRead = !message.flags?.has('\\Seen')

          const emailEntry = {
            uid: message.uid ?? msgId,
            from: fromAddr,
            to: toAddr,
            subject: message.subject || '(Без темы)',
            date: message.date ? new Date(message.date).toISOString() : new Date().toISOString(),
            body: message.bodyText || '',
            isRead,
            hasAttachments,
          }

          emails.push(emailEntry)

          // Логируем входящее письмо (только если ещё не логировали недавно)
          const existingLog = await db.emailLog.findFirst({
            where: {
              direction: 'incoming',
              subject: emailEntry.subject,
              from: emailEntry.from,
              sentAt: new Date(emailEntry.date),
            },
          })

          if (!existingLog) {
            await db.emailLog.create({
              data: {
                direction: 'incoming',
                subject: emailEntry.subject,
                body: emailEntry.body.substring(0, 2000), // Ограничиваем размер тела для лога
                from: emailEntry.from,
                to: emailEntry.to,
                sentAt: new Date(emailEntry.date),
              },
            })
          }
        } catch (fetchErr) {
          console.error(`Error fetching message ${msgId}:`, fetchErr)
          // Пропускаем проблемное сообщение, продолжаем с другими
        }
      }

      return NextResponse.json({
        emails,
        total: totalMessages,
        unseen: totalUnseen,
      })
    } finally {
      lock.release()
    }
  } catch (error: unknown) {
    console.error('Error reading inbox:', error)

    const errMsg = error instanceof Error ? error.message : String(error)

    // Формируем понятное сообщение об ошибке на русском
    let ruMessage = `Ошибка чтения почты: ${errMsg}`
    if (errMsg.includes('AUTHENTICATIONFAILED') || errMsg.includes('Invalid credentials') || errMsg.includes('login failed')) {
      ruMessage = 'Ошибка аутентификации IMAP: неверный логин или пароль. Проверьте настройки.'
    } else if (errMsg.includes('ECONNREFUSED')) {
      ruMessage = 'IMAP сервер отклонил соединение. Проверьте адрес и порт сервера.'
    } else if (errMsg.includes('ENOTFOUND') || errMsg.includes('getaddrinfo')) {
      ruMessage = 'Не удалось найти IMAP сервер. Проверьте правильность адреса.'
    } else if (errMsg.includes('ETIMEDOUT') || errMsg.includes('timeout') || errMsg.includes('Timeout')) {
      ruMessage = 'Таймаут подключения к IMAP серверу. Сервер не отвечает.'
    } else if (errMsg.includes('SSL') || errMsg.includes('TLS') || errMsg.includes('certificate')) {
      ruMessage = 'Ошибка шифрования при подключении к IMAP. Проверьте настройки шифрования (SSL/TLS).'
    }

    return NextResponse.json(
      { success: false, error: ruMessage },
      { status: 500 }
    )
  } finally {
    // Всегда закрываем соединение
    if (client) {
      try {
        await client.logout()
      } catch {
        // игнорируем ошибку закрытия
      }
    }
  }
}

// Рекурсивная проверка структуры письма на наличие вложений
function checkForAttachments(structure: unknown): boolean {
  if (!structure || typeof structure !== 'object') return false

  const s = structure as Record<string, unknown>

  // Если есть дочерние элементы, проверяем рекурсивно
  if (Array.isArray(s.childNodes)) {
    for (const child of s.childNodes) {
      if (checkForAttachments(child)) return true
    }
  }

  // Если тип multipart/mixed — почти точно есть вложение
  if (typeof s.type === 'string' && s.type === 'multipart/mixed') {
    return true
  }

  // Проверяем contentDisposition — если attachment, то есть вложение
  if (s.contentDisposition === 'attachment') {
    return true
  }

  // Проверяем по типу контента (не text/ и не multipart/)
  if (typeof s.type === 'string') {
    const t = s.type as string
    if (!t.startsWith('text/') && !t.startsWith('multipart/') && !t.startsWith('multipart/')) {
      // Вероятно вложение (image/, application/, и т.д.)
      if (s.contentDisposition === 'attachment' || s.encoding) {
        return true
      }
    }
  }

  return false
}
