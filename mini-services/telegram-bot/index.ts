import { Bot, Context } from "grammy";
import { createServer } from "http";

// ═══════════════════════════════════════════════════════════════════════════════
// Конфигурация
// ═══════════════════════════════════════════════════════════════════════════════

const PORT = 3003;
const MAIN_APP_URL = "http://localhost:3000";
const TOKEN_RETRY_INTERVAL = 30_000; // 30 секунд

// ═══════════════════════════════════════════════════════════════════════════════
// Глобальное состояние
// ═══════════════════════════════════════════════════════════════════════════════

let isBotRunning = false;
let bot: Bot | null = null;
let retryTimer: ReturnType<typeof setInterval> | null = null;

// ═══════════════════════════════════════════════════════════════════════════════
// Типы
// ═══════════════════════════════════════════════════════════════════════════════

interface TelegramSettings {
  id: string;
  botToken: string;
  webhookUrl: string;
  chatId: string;
  allowedUsers: string;
  isConfigured: boolean;
  isEnabled: boolean;
  lastMessageAt: string | null;
}

interface StatsResponse {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalSuppliers: number;
  totalWarehouseItems: number;
  lowStockItems: number;
  pendingRequests: number;
  sentRequests: number;
  unpaidInvoices: number;
  totalInvoiceAmount: number;
  budgetData: {
    totalBudget: number;
    spentBudget: number;
    pendingBudget: number;
  };
}

interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  contactPerson: string;
  address: string;
  notes: string;
  _count: { projectItems: number };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Вспомогательные функции
// ═══════════════════════════════════════════════════════════════════════════════

function formatNumber(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n);
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(n);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ═══════════════════════════════════════════════════════════════════════════════
// API-клиент для общения с основным приложением
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchFromMainApp<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${MAIN_APP_URL}${path}`);
    if (!response.ok) {
      console.error(`[API] ${path} → ${response.status}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(`[API] Ошибка запроса ${path}:`, error);
    return null;
  }
}

async function getTelegramSettings(): Promise<TelegramSettings | null> {
  return fetchFromMainApp<TelegramSettings>("/api/settings/telegram?raw=true");
}

async function getStats(): Promise<StatsResponse | null> {
  return fetchFromMainApp<StatsResponse>("/api/stats");
}

async function getSuppliers(): Promise<Supplier[] | null> {
  return fetchFromMainApp<Supplier[]>("/api/suppliers");
}

async function createProjectFromFile(
  fileName: string,
  fileBuffer: ArrayBuffer
): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  try {
    const uint8 = new Uint8Array(fileBuffer);
    let binary = "";
    for (let i = 0; i < uint8.length; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64 = btoa(binary);

    const response = await fetch(`${MAIN_APP_URL}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fileName.replace(/\.(xlsx|xls)$/i, ""),
        description: "Импортировано через Telegram Bot",
        customerName: "",
        fileData: base64,
        fileName,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: (errorData as { error?: string }).error || `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    return { success: true, data: data as Record<string, unknown> };
  } catch (error) {
    console.error("[BOT] Ошибка создания проекта из файла:", error);
    return { success: false, error: String(error) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Обработчики команд бота
// ═══════════════════════════════════════════════════════════════════════════════

async function handleStart(ctx: Context): Promise<void> {
  await ctx.reply(
    "🤖 <b>Добро пожаловать в бот ПРОМЕБЕЛЬ!</b>\n\n" +
    "Я помогу управлять закупками прямо из Telegram.\n\n" +
    "📋 <b>Что я умею:</b>\n" +
    "• Показывать статус закупок\n" +
    "• Принимать Excel-файлы для создания проектов\n" +
    "• Искать поставщиков\n" +
    "• Показывать данные склада\n\n" +
    "Введите /help для списка команд.",
    { parse_mode: "HTML" }
  );
}

async function handleHelp(ctx: Context): Promise<void> {
  await ctx.reply(
    "📖 <b>Список команд</b>\n\n" +
    "/start — Приветствие и описание бота\n" +
    "/help — Список команд и описание workflow\n" +
    "/status — Статистика закупок (проекты, запросы, склад)\n" +
    "/settings — Текущий статус и конфигурация бота\n\n" +
    "📄 <b>Загрузка файлов:</b>\n" +
    "Отправьте Excel-файл (.xlsx, .xls) — он будет обработан и создан проект.\n\n" +
    "🔍 <b>Поиск поставщиков:</b>\n" +
    "Просто напишите название поставщика — я найду его в системе.\n\n" +
    "💡 <b>Workflow:</b>\n" +
    "1. Загрузите Excel → создастся проект\n" +
    "2. Проверьте статус через /status\n" +
    "3. Напишите поставщика для деталей",
    { parse_mode: "HTML" }
  );
}

async function handleStatus(ctx: Context): Promise<void> {
  await ctx.reply("⏳ Загружаю статистику...");

  const stats = await getStats();
  if (!stats) {
    await ctx.reply("❌ Не удалось загрузить статистику. Проверьте подключение к серверу.");
    return;
  }

  const budgetPercent = stats.budgetData.totalBudget > 0
    ? Math.round((stats.budgetData.spentBudget / stats.budgetData.totalBudget) * 100)
    : 0;

  await ctx.reply(
    `📊 <b>Статус закупок ПРОМЕБЕЛЬ</b>\n\n` +
    `🏗 <b>Проекты:</b>\n` +
    `   Всего: ${formatNumber(stats.totalProjects)}\n` +
    `   Активных: ${formatNumber(stats.activeProjects)}\n` +
    `   Завершённых: ${formatNumber(stats.completedProjects)}\n\n` +
    `📦 <b>Запросы:</b>\n` +
    `   Черновиков: ${formatNumber(stats.pendingRequests)}\n` +
    `   Отправлено: ${formatNumber(stats.sentRequests)}\n\n` +
    `🏭 <b>Склад:</b>\n` +
    `   Позиций: ${formatNumber(stats.totalWarehouseItems)}\n` +
    `   ⚠️ Нехватка: ${formatNumber(stats.lowStockItems)}\n\n` +
    `💰 <b>Бюджет:</b>\n` +
    `   Общий: ${formatCurrency(stats.budgetData.totalBudget)}\n` +
    `   Потрачено: ${formatCurrency(stats.budgetData.spentBudget)} (${budgetPercent}%)\n` +
    `   Остаток: ${formatCurrency(stats.budgetData.pendingBudget)}\n\n` +
    `🧾 <b>Счета:</b>\n` +
    `   Неоплаченных: ${formatNumber(stats.unpaidInvoices)}\n` +
    `   Сумма: ${formatCurrency(stats.totalInvoiceAmount)}\n\n` +
    `🤝 Поставщиков: ${formatNumber(stats.totalSuppliers)}`,
    { parse_mode: "HTML" }
  );
}

async function handleSettings(ctx: Context): Promise<void> {
  const settings = await getTelegramSettings();
  if (!settings) {
    await ctx.reply("❌ Не удалось получить настройки бота.");
    return;
  }

  const statusEmoji = settings.isEnabled ? "🟢" : "🔴";
  const configuredEmoji = settings.isConfigured ? "✅" : "❌";

  let allowedUsers: string[] = [];
  try {
    allowedUsers = JSON.parse(settings.allowedUsers || "[]");
  } catch { /* ignore */ }

  await ctx.reply(
    `⚙️ <b>Настройки бота</b>\n\n` +
    `${statusEmoji} Статус: <b>${settings.isEnabled ? "Включён" : "Выключен"}</b>\n` +
    `${configuredEmoji} Настроен: <b>${settings.isConfigured ? "Да" : "Нет"}</b>\n` +
    `🔑 Токен: ${settings.botToken ? "установлен" : "не указан"}\n` +
    `💬 Chat ID: ${settings.chatId || "не указан"}\n` +
    `👥 Разрешённые пользователи: ${allowedUsers.length > 0 ? allowedUsers.join(", ") : "все"}\n` +
    `🌐 Webhook URL: ${settings.webhookUrl || "не указан"}\n` +
    `📅 Последнее сообщение: ${settings.lastMessageAt ? new Date(settings.lastMessageAt).toLocaleString("ru-RU") : "нет"}`,
    { parse_mode: "HTML" }
  );
}

async function handleDocument(ctx: Context): Promise<void> {
  const doc = ctx.message?.document;
  if (!doc) {
    await ctx.reply("❌ Не удалось получить файл.");
    return;
  }

  const fileName = doc.file_name || "unknown.xlsx";
  const fileId = doc.file_id;

  if (!/\.(xlsx|xls)$/i.test(fileName)) {
    await ctx.reply(
      "❌ Неподдерживаемый формат файла.\n\n" +
      "Пожалуйста, отправьте Excel-файл (.xlsx или .xls)."
    );
    return;
  }

  await ctx.reply("📄 Файл получен! Обрабатываю...");

  try {
    const fileInfo = await ctx.api.getFile(fileId);
    if (!fileInfo.file_path) {
      await ctx.reply("❌ Не удалось скачать файл с серверов Telegram.");
      return;
    }

    const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${fileInfo.file_path}`;
    const fileResponse = await fetch(fileUrl);

    if (!fileResponse.ok) {
      await ctx.reply("❌ Ошибка при скачивании файла с серверов Telegram.");
      return;
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    const result = await createProjectFromFile(fileName, fileBuffer);

    if (result.success && result.data) {
      const project = result.data;
      const projectName = (project.name as string) || fileName;
      const itemCount = (project._count as { items: number })?.items ??
        (project.items as unknown[])?.length ?? 0;

      await ctx.reply(
        `✅ <b>Проект создан!</b>\n\n` +
        `📋 Название: ${escapeHtml(projectName)}\n` +
        `📦 Позиций: ${formatNumber(itemCount)}\n` +
        `🆔 ID: <code>${project.id}</code>\n\n` +
        `Проект доступен в системе ПРОМЕБЕЛЬ.`,
        { parse_mode: "HTML" }
      );
    } else {
      await ctx.reply(
        `❌ <b>Ошибка обработки файла</b>\n\n` +
        `${escapeHtml(result.error || "Неизвестная ошибка")}\n\n` +
        `Убедитесь, что файл содержит корректные данные.`,
        { parse_mode: "HTML" }
      );
    }
  } catch (error) {
    console.error("[BOT] Ошибка обработки документа:", error);
    await ctx.reply(
      "❌ Произошла ошибка при обработке файла.\n" +
      "Попробуйте ещё раз или обратитесь к администратору."
    );
  }
}

async function handleTextMessage(ctx: Context): Promise<void> {
  const text = ctx.message?.text;
  if (!text || text.startsWith("/")) return;

  const suppliers = await getSuppliers();
  if (suppliers && suppliers.length > 0) {
    const query = text.toLowerCase().trim();
    const matched = suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.contactPerson.toLowerCase().includes(query)
    );

    if (matched.length > 0) {
      const results = matched.slice(0, 3);
      let message = `🔍 <b>Найдено поставщиков: ${matched.length}</b>\n\n`;

      for (const supplier of results) {
        message +=
          `🏢 <b>${escapeHtml(supplier.name)}</b>\n` +
          `   📧 ${escapeHtml(supplier.email || "не указан")}\n` +
          `   📞 ${escapeHtml(supplier.phone || "не указан")}\n` +
          `   👤 ${escapeHtml(supplier.contactPerson || "не указан")}\n` +
          `   📍 ${escapeHtml(supplier.address || "не указан")}\n` +
          `   📦 Позиций: ${supplier._count.projectItems}\n\n`;
      }

      if (matched.length > 3) {
        message += `...и ещё ${matched.length - 3} поставщиков.`;
      }

      await ctx.reply(message, { parse_mode: "HTML" });
      return;
    }
  }

  await ctx.reply(
    "🤔 Не удалось найти поставщика по запросу «" + escapeHtml(text) + "».\n\n" +
    "💡 Попробуйте:\n" +
    "• Написать часть названия поставщика\n" +
    "• Использовать /status для статистики\n" +
    "• Отправить Excel-файл для создания проекта\n" +
    "• /help — список всех команд"
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Инициализация и запуск бота
// ═══════════════════════════════════════════════════════════════════════════════

async function tryInitializeBot(): Promise<void> {
  try {
    const settings = await getTelegramSettings();

    if (!settings || !settings.botToken || !settings.isEnabled) {
      console.log(
        `[BOT] Токен не настроен или бот выключен. ` +
        `Повтор через ${TOKEN_RETRY_INTERVAL / 1000} сек...`
      );
      return;
    }

    // Останавливаем предыдущего бота
    if (bot) {
      try { await bot.stop(); } catch { /* ignore */ }
      bot = null;
    }

    bot = new Bot(settings.botToken);

    // Регистрация обработчиков
    bot.command("start", handleStart);
    bot.command("help", handleHelp);
    bot.command("status", handleStatus);
    bot.command("settings", handleSettings);
    bot.on("message:document", handleDocument);
    bot.on("message:text", handleTextMessage);

    bot.catch((err) => {
      console.error("[BOT] Ошибка:", err);
    });

    // Запуск long polling (не await — запускаем в фоне)
    bot.start({
      onStart: (info) => {
        isBotRunning = true;
        if (retryTimer) {
          clearInterval(retryTimer);
          retryTimer = null;
        }
        console.log(`[BOT] ✅ Запущен: @${info.username} (${info.first_name})`);
      },
    });
  } catch (error) {
    console.error("[BOT] Ошибка инициализации:", error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP-сервер для health checks (используем Node.js http для стабильности)
// ═══════════════════════════════════════════════════════════════════════════════

const httpServer = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (url.pathname === "/" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "ok",
      service: "telegram-bot",
      port: PORT,
      botRunning: isBotRunning,
    }));
    return;
  }

  if (url.pathname === "/status" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: isBotRunning ? "running" : "waiting_for_token",
      service: "telegram-bot",
      port: PORT,
    }));
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

httpServer.listen(PORT, () => {
  console.log(`[SERVICE] 🚀 Telegram Bot service running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[SERVICE] Received SIGTERM, shutting down...");
  httpServer.close(() => {
    console.log("[SERVICE] HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("[SERVICE] Received SIGINT, shutting down...");
  httpServer.close(() => {
    console.log("[SERVICE] HTTP server closed");
    process.exit(0);
  });
});

// Первая попытка инициализации
tryInitializeBot();

// Периодическая проверка токена
retryTimer = setInterval(() => {
  if (!isBotRunning) {
    console.log("[BOT] 🔄 Повторная попытка инициализации...");
    tryInitializeBot();
  }
}, TOKEN_RETRY_INTERVAL);

// Глобальная обработка необработанных ошибок
process.on("uncaughtException", (err) => {
  console.error("[SERVICE] Uncaught exception:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[SERVICE] Unhandled rejection:", reason);
});
