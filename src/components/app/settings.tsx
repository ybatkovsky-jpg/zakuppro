'use client'

import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { motion } from 'framer-motion'
import {
  Building2,
  Save,
  Loader2,
  MapPin,
  Mail,
  Phone,
  Landmark,
  FileText,
  CreditCard,
  Bell,
  Globe,
  Eye,
  EyeOff,
  Plug,
  CheckCircle2,
  RotateCcw,
  Download,
  Upload,
  Trash2,
  Clock,
  Languages,
  Calendar,
  Image as ImageIcon,
  MailOpen,
  Zap,
  Database,
  Info,
  ChevronDown,
  ChevronRight,
  Shield,
  BookOpen,
  Star,
  Server,
  Bot,
  Brain,
  Send,
  Key,
  Thermometer,
  MessageSquare,
  CircleCheck,
  CircleX,
  Circle,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────

interface CompanyData {
  id: string
  companyName: string
  inn: string
  kpp: string
  ogrn: string
  address: string
  email: string
  phone: string
  bankName: string
  bankAccount: string
  korAccount: string
  bik: string
}

const defaultFormData: Omit<CompanyData, 'id'> = {
  companyName: '',
  inn: '',
  kpp: '',
  ogrn: '',
  address: '',
  email: '',
  phone: '',
  bankName: '',
  bankAccount: '',
  korAccount: '',
  bik: '',
}

// ── Color Map for SectionCard ──────────────────────────────

const sectionColorMap: Record<string, { line: string; iconBg: string; iconText: string }> = {
  'emerald-600': {
    line: 'bg-emerald-600/40',
    iconBg: 'bg-emerald-600/10',
    iconText: 'text-emerald-600 dark:text-emerald-400',
  },
  'sky-600': {
    line: 'bg-sky-600/40',
    iconBg: 'bg-sky-600/10',
    iconText: 'text-sky-600 dark:text-sky-400',
  },
  'violet-600': {
    line: 'bg-violet-600/40',
    iconBg: 'bg-violet-600/10',
    iconText: 'text-violet-600 dark:text-violet-400',
  },
  'amber-600': {
    line: 'bg-amber-600/40',
    iconBg: 'bg-amber-600/10',
    iconText: 'text-amber-600 dark:text-amber-400',
  },
  'teal-600': {
    line: 'bg-teal-600/40',
    iconBg: 'bg-teal-600/10',
    iconText: 'text-teal-600 dark:text-teal-400',
  },
  'rose-600': {
    line: 'bg-rose-600/40',
    iconBg: 'bg-rose-600/10',
    iconText: 'text-rose-600 dark:text-rose-400',
  },
  'orange-600': {
    line: 'bg-orange-600/40',
    iconBg: 'bg-orange-600/10',
    iconText: 'text-orange-600 dark:text-orange-400',
  },
  'cyan-600': {
    line: 'bg-cyan-600/40',
    iconBg: 'bg-cyan-600/10',
    iconText: 'text-cyan-600 dark:text-cyan-400',
  },
  primary: {
    line: 'bg-primary/40',
    iconBg: 'bg-primary/10',
    iconText: 'text-primary',
  },
}

const defaultColor = sectionColorMap.primary

// ── Section wrapper component ──────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
  accentColor = 'primary',
  onSave,
  onReset,
  saveLabel = 'Сохранить',
  resetLabel = 'Сбросить',
  hasChanges = false,
  isSaving = false,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  children: React.ReactNode
  accentColor?: string
  onSave?: () => void
  onReset?: () => void
  saveLabel?: string
  resetLabel?: string
  hasChanges?: boolean
  isSaving?: boolean
}) {
  const colors = sectionColorMap[accentColor] ?? defaultColor

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden accent-border-left" style={{ '--accent-color': colors.line.replace('bg-', '').replace(/\/(\d+)\)?$/, '') } as React.CSSProperties}>
        <div className={`absolute top-0 left-0 right-0 h-[2px] ${colors.line}`} />
        <div className={`absolute top-0 bottom-0 left-0 w-[3px] rounded-full ${colors.line}`} />
        <CardHeader className="pb-4 pl-6">
          <div className="flex items-center gap-3">
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${colors.iconBg} ${colors.iconText}`}>
              <Icon className="size-5" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
            {(onSave || onReset) && (
              <div className="flex items-center gap-2">
                {onReset && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onReset}
                    disabled={!hasChanges || isSaving}
                    className="gap-1.5 text-xs h-8"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    {resetLabel}
                  </Button>
                )}
                {onSave && (
                  <Button
                    size="sm"
                    onClick={onSave}
                    disabled={!hasChanges || isSaving}
                    className="gap-1.5 text-xs h-8 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                  >
                    {isSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    {saveLabel}
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {children}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── Email Preset Data ────────────────────────────────────────

const EMAIL_PRESETS = [
  {
    id: 'yandex',
    name: 'Yandex',
    letter: 'Я',
    color: 'bg-red-500',
    hoverColor: 'hover:bg-red-600',
    textColor: 'text-white',
    borderActive: 'border-red-500',
    bgActive: 'bg-red-50 dark:bg-red-950/30',
    smtp: { host: 'smtp.yandex.ru', port: '587', encryption: 'tls' },
    imap: { host: 'imap.yandex.ru', port: '993', encryption: 'ssl' },
  },
  {
    id: 'gmail',
    name: 'Gmail',
    letter: 'G',
    color: 'bg-amber-500',
    hoverColor: 'hover:bg-amber-600',
    textColor: 'text-white',
    borderActive: 'border-amber-500',
    bgActive: 'bg-amber-50 dark:bg-amber-950/30',
    smtp: { host: 'smtp.gmail.com', port: '587', encryption: 'tls' },
    imap: { host: 'imap.gmail.com', port: '993', encryption: 'ssl' },
  },
  {
    id: 'mailru',
    name: 'Mail.ru',
    letter: 'M',
    color: 'bg-sky-500',
    hoverColor: 'hover:bg-sky-600',
    textColor: 'text-white',
    borderActive: 'border-sky-500',
    bgActive: 'bg-sky-50 dark:bg-sky-950/30',
    smtp: { host: 'smtp.mail.ru', port: '587', encryption: 'tls' },
    imap: { host: 'imap.mail.ru', port: '993', encryption: 'ssl' },
  },
] as const

// ── Connection Status Badge Component ────────────────────────

type ConnectionStatus = 'success' | 'error' | 'unknown'

function ConnectionStatusBadge({
  testResult,
  lastTestedAt,
  label,
}: {
  testResult: string | undefined | null
  lastTestedAt: string | Date | null | undefined
  label: string
}) {
  let status: ConnectionStatus = 'unknown'
  if (testResult === 'success') status = 'success'
  else if (testResult === 'error' || (testResult && testResult !== '')) status = 'error'

  const formatLastTested = (date: string | Date) => {
    try {
      const d = typeof date === 'string' ? new Date(date) : date
      if (isNaN(d.getTime())) return ''
      return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  return (
    <div className="flex items-center gap-2">
      {status === 'success' ? (
        <Badge className="gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100">
          <CircleCheck className="size-3" />
          {label}
        </Badge>
      ) : status === 'error' ? (
        <Badge variant="destructive" className="gap-1">
          <CircleX className="size-3" />
          {label}
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1 text-muted-foreground">
          <Circle className="size-3" />
          {label}
        </Badge>
      )}
      {lastTestedAt && (
        <span className="text-[10px] text-muted-foreground">
          {formatLastTested(lastTestedAt)}
        </span>
      )}
    </div>
  )
}

// ── Email template data ─────────────────────────────────────

// Auto-detect preset from current SMTP host
function detectPreset(smtpHost: string): string | null {
  const match = EMAIL_PRESETS.find(p => p.smtp.host === smtpHost)
  return match?.id ?? null
}

const EMAIL_TEMPLATES = [
  {
    id: 'request',
    name: 'Запрос поставщику',
    subject: 'Запрос коммерческого предложения — {companyName}',
    body: 'Уважаемый поставщик!\n\nПрошу предоставить коммерческое предложение на следующие позиции:\n\n{items}\n\nС уважением,\n{companyName}\n{phone}',
  },
  {
    id: 'invoice_received',
    name: 'Счёт получен',
    subject: 'Счёт принят к рассмотрению — {invoiceNumber}',
    body: 'Уважаемый поставщик!\n\nПодтверждаем получение счёта №{invoiceNumber} от {date}.\n\nРассмотрение в срок до {deadline}.\n\nС уважением,\n{companyName}',
  },
  {
    id: 'order_confirm',
    name: 'Подтверждение заказа',
    subject: 'Подтверждение заказа — {orderNumber}',
    body: 'Уважаемый поставщик!\n\nПодтверждаем заказ №{orderNumber}.\n\nСрок поставки: {deliveryDate}\nСумма: {totalAmount} ₽\n\nС уважением,\n{companyName}',
  },
  {
    id: 'low_stock',
    name: 'Уведомление о низком остатке',
    subject: 'Низкий остаток на складе — {itemName}',
    body: 'Внимание!\n\nОстаток позиции "{itemName}" ниже минимального.\n\nТекущий: {currentQty} {unit}\nМинимальный: {minQty} {unit}\n\nРекомендуется пополнение.\n\nПРОМЕБЕЛЬ',
  },
]

// ── Main Component ─────────────────────────────────────────

export function Settings() {
  const queryClient = useQueryClient()
  const [localEdits, setLocalEdits] = useState<Partial<Omit<CompanyData, 'id'>> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Notification state ────────────────────────────────────
  const [notifications, setNotifications] = useState({
    email: true,
    lowStock: true,
    newInvoices: true,
    projectStatus: true,
    dailyDigest: false,
  })
  const [notificationsChanged, setNotificationsChanged] = useState(false)

  // ── Email Settings (SMTP/IMAP) state ──────────────────────
  const [emailSettings, setEmailSettings] = useState({
    smtpHost: '',
    smtpPort: '587',
    smtpUser: '',
    smtpPassword: '',
    smtpEncryption: 'tls',
    senderName: '',
    senderEmail: '',
    emailSignature: '',
    imapHost: '',
    imapPort: '993',
    imapUser: '',
    imapPassword: '',
    imapEncryption: 'ssl',
    imapCheckInterval: '15',
    imapEnabled: false,
  })
  const [emailSettingsChanged, setEmailSettingsChanged] = useState(false)
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [showImapPassword, setShowImapPassword] = useState(false)
  const [testingSmtp, setTestingSmtp] = useState(false)
  const [testingImap, setTestingImap] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)

  // ── AI Settings state ──────────────────────────────────────
  const [aiSettings, setAiSettings] = useState({
    provider: 'z-ai',
    model: 'glm-4',
    apiKey: '',
    apiEndpoint: '',
    temperature: '0.7',
    maxTokens: '4096',
    systemPrompt: '',
  })
  const [aiSettingsChanged, setAiSettingsChanged] = useState(false)
  const [showAiApiKey, setShowAiApiKey] = useState(false)
  const [testingAi, setTestingAi] = useState(false)

  // ── Telegram Settings state ────────────────────────────────
  const [telegramSettings, setTelegramSettings] = useState({
    botToken: '',
    webhookUrl: '',
    chatId: '',
    isEnabled: false,
  })
  const [telegramSettingsChanged, setTelegramSettingsChanged] = useState(false)
  const [showBotToken, setShowBotToken] = useState(false)
  const [testingTelegram, setTestingTelegram] = useState(false)

  // ── User Preferences state ─────────────────────────────────
  const [preferences, setPreferences] = useState({
    language: 'ru',
    timezone: 'Europe/Moscow',
    dateFormat: 'DD.MM.YYYY',
    currency: 'RUB',
  })
  const [preferencesChanged, setPreferencesChanged] = useState(false)

  // ── Automation Defaults state ──────────────────────────────
  const [automationDefaults, setAutomationDefaults] = useState({
    autoRunInterval: '60',
    lowStockThreshold: '20',
    autoCreateRequests: false,
    autoStatusTransition: false,
    notifyOnAutoAction: true,
  })
  const [automationChanged, setAutomationChanged] = useState(false)

  // ── Email Templates state ──────────────────────────────────
  const [selectedTemplate, setSelectedTemplate] = useState<string>('request')
  const [templateEdits, setTemplateEdits] = useState<Record<string, { subject: string; body: string }>>({})
  const [templateChanged, setTemplateChanged] = useState(false)

  // ── Logo state ─────────────────────────────────────────────
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  // ── Data Management state ──────────────────────────────────
  const [resetDbOpen, setResetDbOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const importFileRef = useRef<HTMLInputElement>(null)

  // ── Query ──────────────────────────────────────────────────

  const { data: company, isLoading } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const res = await fetch('/api/company')
      if (!res.ok) throw new Error('Failed to fetch company details')
      return res.json() as Promise<CompanyData>
    },
  })

  // ── Email Settings Query ───────────────────────────────────
  const { data: emailData } = useQuery({
    queryKey: ['email-settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings/email')
      if (!res.ok) return null
      return res.json()
    },
  })

  // ── AI Settings Query ──────────────────────────────────────
  const { data: aiData } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings/ai')
      if (!res.ok) return null
      return res.json()
    },
  })

  // ── Telegram Settings Query ────────────────────────────────
  const { data: telegramData } = useQuery({
    queryKey: ['telegram-settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings/telegram')
      if (!res.ok) return null
      return res.json()
    },
  })

  // ── Mutation ───────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async (data: Omit<CompanyData, 'id'>) => {
      const res = await fetch('/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to save company details')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company'] })
      setLocalEdits(null)
      toast({
        title: 'Сохранено',
        description: 'Данные компании успешно обновлены',
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Ошибка сохранения',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const serverData = useMemo(() => {
    if (!company) return defaultFormData
    return {
      companyName: company.companyName || '',
      inn: company.inn || '',
      kpp: company.kpp || '',
      ogrn: company.ogrn || '',
      address: company.address || '',
      email: company.email || '',
      phone: company.phone || '',
      bankName: company.bankName || '',
      bankAccount: company.bankAccount || '',
      korAccount: company.korAccount || '',
      bik: company.bik || '',
    }
  }, [company])

  const formData = localEdits ? { ...serverData, ...localEdits } : serverData
  const hasChanges = localEdits !== null && Object.keys(localEdits).length > 0

  // ── Initialize settings from server data ───────────────────
  useMemo(() => {
    if (emailData) {
      setEmailSettings({
        smtpHost: emailData.smtpHost ?? '',
        smtpPort: String(emailData.smtpPort ?? 587),
        smtpUser: emailData.smtpUser ?? '',
        smtpPassword: emailData.smtpPassword ?? '',
        smtpEncryption: emailData.smtpEncryption ?? 'tls',
        senderName: emailData.senderName ?? '',
        senderEmail: emailData.senderEmail ?? '',
        emailSignature: emailData.emailSignature ?? '',
        imapHost: emailData.imapHost ?? '',
        imapPort: String(emailData.imapPort ?? 993),
        imapUser: emailData.imapUser ?? '',
        imapPassword: emailData.imapPassword ?? '',
        imapEncryption: emailData.imapEncryption ?? 'ssl',
        imapCheckInterval: String(emailData.imapCheckInterval ?? 15),
        imapEnabled: emailData.imapEnabled ?? false,
      })
      // Auto-detect active preset from server data
      const detectedPreset = detectPreset(emailData.smtpHost ?? '')
      if (detectedPreset) {
        setSelectedPreset(detectedPreset)
      }
    }
  }, [emailData])

  useMemo(() => {
    if (aiData) {
      setAiSettings({
        provider: aiData.provider ?? 'z-ai',
        model: aiData.model ?? 'glm-4',
        apiKey: aiData.apiKey ?? '',
        apiEndpoint: aiData.apiEndpoint ?? '',
        temperature: String(aiData.temperature ?? 0.7),
        maxTokens: String(aiData.maxTokens ?? 4096),
        systemPrompt: aiData.systemPrompt ?? '',
      })
    }
  }, [aiData])

  useMemo(() => {
    if (telegramData) {
      setTelegramSettings({
        botToken: telegramData.botToken ?? '',
        webhookUrl: telegramData.webhookUrl ?? '',
        chatId: telegramData.chatId ?? '',
        isEnabled: telegramData.isEnabled ?? false,
      })
    }
  }, [telegramData])

  // ── Handlers ───────────────────────────────────────────────

  const handleChange = (field: keyof typeof serverData, value: string) => {
    setLocalEdits((prev) => ({ ...(prev || {}), [field]: value }))
  }

  const handleSave = () => {
    saveMutation.mutate(formData)
  }

  const handleReset = () => {
    setLocalEdits(null)
    toast({ title: 'Сброшено', description: 'Изменения отменены' })
  }

  const handleNotificationToggle = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }))
    setNotificationsChanged(true)
  }

  const handleSaveNotifications = () => {
    setNotificationsChanged(false)
    toast({
      title: 'Настройки сохранены',
      description: 'Настройки уведомлений обновлены',
    })
  }

  const handleResetNotifications = () => {
    setNotifications({ email: true, lowStock: true, newInvoices: true, projectStatus: true, dailyDigest: false })
    setNotificationsChanged(false)
    toast({ title: 'Сброшено', description: 'Настройки уведомлений сброшены' })
  }

  // ── Email Settings Handlers ────────────────────────────────
  const handleEmailChange = (field: keyof typeof emailSettings, value: string | boolean) => {
    setEmailSettings((prev) => ({ ...prev, [field]: value }))
    setEmailSettingsChanged(true)
    // Clear preset selection when manually changing server settings
    if (['smtpHost', 'smtpPort', 'smtpEncryption', 'imapHost', 'imapPort', 'imapEncryption'].includes(field)) {
      setSelectedPreset(null)
    }
  }

  const handlePresetClick = (presetId: string) => {
    const preset = EMAIL_PRESETS.find(p => p.id === presetId)
    if (!preset) return
    setSelectedPreset(presetId)
    setEmailSettings((prev) => ({
      ...prev,
      smtpHost: preset.smtp.host,
      smtpPort: preset.smtp.port,
      smtpEncryption: preset.smtp.encryption,
      imapHost: preset.imap.host,
      imapPort: preset.imap.port,
      imapEncryption: preset.imap.encryption,
      // Auto-fill IMAP user from SMTP user if empty
      imapUser: prev.imapUser || prev.smtpUser,
      imapPassword: prev.imapPassword || prev.smtpPassword,
    }))
    setEmailSettingsChanged(true)
    toast({ title: `Пресет ${preset.name}`, description: `Настройки ${preset.name} применены. Укажите логин и пароль.` })
  }

  const handleSaveEmail = async () => {
    try {
      const res = await fetch('/api/settings/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...emailSettings,
          smtpPort: parseInt(emailSettings.smtpPort) || 587,
          imapPort: parseInt(emailSettings.imapPort) || 993,
          imapCheckInterval: parseInt(emailSettings.imapCheckInterval) || 15,
        }),
      })
      if (!res.ok) throw new Error('Ошибка сохранения')
      setEmailSettingsChanged(false)
      queryClient.invalidateQueries({ queryKey: ['email-settings'] })
      toast({ title: 'Настройки почты сохранены', description: 'SMTP/IMAP настройки обновлены' })
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось сохранить настройки почты', variant: 'destructive' })
    }
  }

  const handleResetEmail = () => {
    if (emailData) {
      setEmailSettings({
        smtpHost: emailData.smtpHost ?? '',
        smtpPort: String(emailData.smtpPort ?? 587),
        smtpUser: emailData.smtpUser ?? '',
        smtpPassword: emailData.smtpPassword ?? '',
        smtpEncryption: emailData.smtpEncryption ?? 'tls',
        senderName: emailData.senderName ?? '',
        senderEmail: emailData.senderEmail ?? '',
        emailSignature: emailData.emailSignature ?? '',
        imapHost: emailData.imapHost ?? '',
        imapPort: String(emailData.imapPort ?? 993),
        imapUser: emailData.imapUser ?? '',
        imapPassword: emailData.imapPassword ?? '',
        imapEncryption: emailData.imapEncryption ?? 'ssl',
        imapCheckInterval: String(emailData.imapCheckInterval ?? 15),
        imapEnabled: emailData.imapEnabled ?? false,
      })
    }
    setEmailSettingsChanged(false)
    toast({ title: 'Сброшено', description: 'Изменения отменены' })
  }

  const handleTestSmtp = async () => {
    setTestingSmtp(true)
    try {
      const res = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType: 'smtp', ...emailSettings }),
      })
      const data = await res.json()
      toast({
        title: data.success ? 'SMTP подключение' : 'Ошибка SMTP',
        description: data.message || data.error,
        variant: data.success ? 'default' : 'destructive',
      })
      // Refetch email settings to update connection status
      queryClient.invalidateQueries({ queryKey: ['email-settings'] })
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось проверить SMTP', variant: 'destructive' })
    } finally {
      setTestingSmtp(false)
    }
  }

  const handleTestImap = async () => {
    setTestingImap(true)
    try {
      const res = await fetch('/api/settings/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testType: 'imap', ...emailSettings }),
      })
      const data = await res.json()
      toast({
        title: data.success ? 'IMAP подключение' : 'Ошибка IMAP',
        description: data.message || data.error,
        variant: data.success ? 'default' : 'destructive',
      })
      // Refetch email settings to update connection status
      queryClient.invalidateQueries({ queryKey: ['email-settings'] })
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось проверить IMAP', variant: 'destructive' })
    } finally {
      setTestingImap(false)
    }
  }

  // ── AI Settings Handlers ───────────────────────────────────
  const handleAiChange = (field: keyof typeof aiSettings, value: string) => {
    setAiSettings((prev) => ({ ...prev, [field]: value }))
    setAiSettingsChanged(true)
  }

  const handleSaveAi = async () => {
    try {
      const res = await fetch('/api/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...aiSettings,
          temperature: parseFloat(aiSettings.temperature) || 0.7,
          maxTokens: parseInt(aiSettings.maxTokens) || 4096,
        }),
      })
      if (!res.ok) throw new Error('Ошибка сохранения')
      setAiSettingsChanged(false)
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] })
      toast({ title: 'Настройки ИИ сохранены', description: 'Провайдер и модель обновлены' })
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось сохранить настройки ИИ', variant: 'destructive' })
    }
  }

  const handleResetAi = () => {
    if (aiData) {
      setAiSettings({
        provider: aiData.provider ?? 'z-ai',
        model: aiData.model ?? 'glm-4',
        apiKey: aiData.apiKey ?? '',
        apiEndpoint: aiData.apiEndpoint ?? '',
        temperature: String(aiData.temperature ?? 0.7),
        maxTokens: String(aiData.maxTokens ?? 4096),
        systemPrompt: aiData.systemPrompt ?? '',
      })
    }
    setAiSettingsChanged(false)
    toast({ title: 'Сброшено', description: 'Изменения отменены' })
  }

  const handleTestAi = async () => {
    setTestingAi(true)
    try {
      const res = await fetch('/api/settings/ai', { method: 'POST' })
      const data = await res.json()
      toast({
        title: data.success ? 'ИИ подключение' : 'Ошибка ИИ',
        description: data.message || data.error,
        variant: data.success ? 'default' : 'destructive',
      })
      // Refetch AI settings to update connection status
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] })
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось проверить подключение', variant: 'destructive' })
    } finally {
      setTestingAi(false)
    }
  }

  // ── Telegram Settings Handlers ─────────────────────────────
  const handleTelegramChange = (field: keyof typeof telegramSettings, value: string | boolean) => {
    setTelegramSettings((prev) => ({ ...prev, [field]: value }))
    setTelegramSettingsChanged(true)
  }

  const handleSaveTelegram = async () => {
    try {
      const res = await fetch('/api/settings/telegram', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telegramSettings),
      })
      if (!res.ok) throw new Error('Ошибка сохранения')
      setTelegramSettingsChanged(false)
      queryClient.invalidateQueries({ queryKey: ['telegram-settings'] })
      toast({ title: 'Настройки Telegram сохранены', description: 'Бот настроен' })
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось сохранить настройки Telegram', variant: 'destructive' })
    }
  }

  const handleResetTelegram = () => {
    if (telegramData) {
      setTelegramSettings({
        botToken: telegramData.botToken ?? '',
        webhookUrl: telegramData.webhookUrl ?? '',
        chatId: telegramData.chatId ?? '',
        isEnabled: telegramData.isEnabled ?? false,
      })
    }
    setTelegramSettingsChanged(false)
    toast({ title: 'Сброшено', description: 'Изменения отменены' })
  }

  const handleTestTelegram = async () => {
    setTestingTelegram(true)
    try {
      const res = await fetch('/api/settings/telegram', { method: 'POST' })
      const data = await res.json()
      toast({
        title: data.success ? 'Telegram подключение' : 'Ошибка Telegram',
        description: data.message || data.error,
        variant: data.success ? 'default' : 'destructive',
      })
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось проверить подключение', variant: 'destructive' })
    } finally {
      setTestingTelegram(false)
    }
  }

  const handlePreferenceChange = (field: keyof typeof preferences, value: string) => {
    setPreferences((prev) => ({ ...prev, [field]: value }))
    setPreferencesChanged(true)
  }

  const handleSavePreferences = () => {
    setPreferencesChanged(false)
    toast({
      title: 'Настройки сохранены',
      description: 'Пользовательские настройки обновлены',
    })
  }

  const handleResetPreferences = () => {
    setPreferences({ language: 'ru', timezone: 'Europe/Moscow', dateFormat: 'DD.MM.YYYY', currency: 'RUB' })
    setPreferencesChanged(false)
    toast({ title: 'Сброшено', description: 'Пользовательские настройки сброшены' })
  }

  const handleAutomationChange = (field: keyof typeof automationDefaults, value: string | boolean) => {
    setAutomationDefaults((prev) => ({ ...prev, [field]: value }))
    setAutomationChanged(true)
  }

  const handleSaveAutomation = () => {
    setAutomationChanged(false)
    toast({
      title: 'Настройки сохранены',
      description: 'Настройки автоматизации обновлены',
    })
  }

  const handleResetAutomation = () => {
    setAutomationDefaults({
      autoRunInterval: '60',
      lowStockThreshold: '20',
      autoCreateRequests: false,
      autoStatusTransition: false,
      notifyOnAutoAction: true,
    })
    setAutomationChanged(false)
    toast({ title: 'Сброшено', description: 'Настройки автоматизации сброшены' })
  }

  // Email template handlers
  const currentTemplate = EMAIL_TEMPLATES.find(t => t.id === selectedTemplate) ?? EMAIL_TEMPLATES[0]
  const currentTemplateEdit = templateEdits[selectedTemplate]

  const handleTemplateSubjectChange = (value: string) => {
    setTemplateEdits(prev => ({
      ...prev,
      [selectedTemplate]: {
        subject: value,
        body: currentTemplateEdit?.body ?? currentTemplate.body,
      },
    }))
    setTemplateChanged(true)
  }

  const handleTemplateBodyChange = (value: string) => {
    setTemplateEdits(prev => ({
      ...prev,
      [selectedTemplate]: {
        subject: currentTemplateEdit?.subject ?? currentTemplate.subject,
        body: value,
      },
    }))
    setTemplateChanged(true)
  }

  const handleSaveTemplate = () => {
    setTemplateChanged(false)
    toast({
      title: 'Шаблон сохранён',
      description: `Шаблон "${currentTemplate.name}" обновлён`,
    })
  }

  const handleResetTemplate = () => {
    setTemplateEdits(prev => {
      const next = { ...prev }
      delete next[selectedTemplate]
      return next
    })
    setTemplateChanged(false)
    toast({ title: 'Сброшено', description: 'Шаблон сброшен к значению по умолчанию' })
  }

  // Logo upload handler
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setLogoPreview(ev.target?.result as string)
        toast({ title: 'Логотип загружен', description: 'Предпросмотр обновлён' })
      }
      reader.readAsDataURL(file)
    }
  }

  // Data management handlers
  const handleExportAll = async () => {
    setExporting(true)
    try {
      // Simulate export
      await new Promise(resolve => setTimeout(resolve, 1500))
      const data = {
        exportDate: new Date().toISOString(),
        version: '3.0',
        company: formData,
        preferences,
        notifications,
        automation: automationDefaults,
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `promebel_export_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast({ title: 'Экспорт завершён', description: 'Данные успешно экспортированы' })
    } catch {
      toast({ title: 'Ошибка экспорта', description: 'Не удалось экспортировать данные', variant: 'destructive' })
    } finally {
      setExporting(false)
    }
  }

  const handleImportData = () => {
    importFileRef.current?.click()
  }

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1500))
      toast({ title: 'Импорт завершён', description: 'Данные успешно импортированы' })
    } catch {
      toast({ title: 'Ошибка импорта', description: 'Не удалось импортировать данные', variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  const handleResetDb = () => {
    toast({ title: 'База данных сброшена', description: 'Все данные удалены и пересозданы' })
    setResetDbOpen(false)
  }

  // ── Render ─────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Загрузка настроек...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div className="relative -mx-6 -mt-6 px-6 pt-6 pb-5 bg-gradient-to-b from-primary/5 via-primary/[0.02] to-transparent">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm">Данные компании для документов и запросов</p>
          </div>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:scale-[1.02]"
          >
            {saveMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Сохранить всё
          </Button>
        </div>
      </div>

      {/* Company Logo Upload Section */}
      <SectionCard
        icon={ImageIcon}
        title="Логотип компании"
        description="Загрузите логотип для использования в документах и интерфейсе"
        accentColor="emerald-600"
        onSave={() => toast({ title: 'Логотип сохранён', description: 'Логотип обновлён' })}
        hasChanges={logoPreview !== null}
        saveLabel="Сохранить"
      >
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="size-24 rounded-xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden bg-muted/30">
              {logoPreview ? (
                <img src={logoPreview} alt="Логотип" className="size-full object-contain p-1" />
              ) : (
                <ImageIcon className="size-8 text-muted-foreground/40" />
              )}
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm text-muted-foreground">
              Рекомендуемый формат: PNG или SVG, мин. 200×200px
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                Загрузить
              </Button>
              {logoPreview && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLogoPreview(null)}
                  className="gap-1.5 text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Удалить
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>
        </div>
      </SectionCard>

      {/* Company Details Section */}
      <SectionCard
        icon={Building2}
        title="Реквизиты компании"
        description="Основная информация о компании, используемая в запросах и документах"
        accentColor="emerald-600"
        onSave={handleSave}
        onReset={handleReset}
        hasChanges={hasChanges}
        isSaving={saveMutation.isPending}
      >
        <div className="space-y-2">
          <Label htmlFor="companyName" className="text-sm font-medium">
            Название компании
          </Label>
          <Input
            id="companyName"
            value={formData.companyName}
            onChange={(e) => handleChange('companyName', e.target.value)}
            placeholder="ООО «Моя Компания»"
            className="transition-shadow duration-200 focus:shadow-sm focus:shadow-primary/5"
          />
        </div>

        <Separator className="my-2" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="inn" className="text-sm font-medium">
              ИНН
            </Label>
            <Input
              id="inn"
              value={formData.inn}
              onChange={(e) => handleChange('inn', e.target.value)}
              placeholder="7712345678"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kpp" className="text-sm font-medium">
              КПП
            </Label>
            <Input
              id="kpp"
              value={formData.kpp}
              onChange={(e) => handleChange('kpp', e.target.value)}
              placeholder="771201001"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ogrn" className="text-sm font-medium">
            ОГРН
          </Label>
          <Input
            id="ogrn"
            value={formData.ogrn}
            onChange={(e) => handleChange('ogrn', e.target.value)}
            placeholder="1027700132195"
          />
        </div>
      </SectionCard>

      {/* Address & Contacts Section */}
      <SectionCard
        icon={MapPin}
        title="Адрес и контакты"
        description="Юридический адрес и контактная информация"
        accentColor="sky-600"
        onSave={handleSave}
        onReset={handleReset}
        hasChanges={hasChanges}
        isSaving={saveMutation.isPending}
      >
        <div className="space-y-2">
          <Label htmlFor="address" className="text-sm font-medium flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            Юридический адрес
          </Label>
          <Input
            id="address"
            value={formData.address}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="123456, г. Москва, ул. Примерная, д. 1, оф. 100"
          />
        </div>

        <Separator className="my-2" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="info@company.ru"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-sm font-medium flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" />
              Телефон
            </Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="+7 (495) 123-45-67"
            />
          </div>
        </div>
      </SectionCard>

      {/* Bank Details Section */}
      <SectionCard
        icon={Landmark}
        title="Банковские реквизиты"
        description="Расчётный счёт и банковская информация"
        accentColor="violet-600"
        onSave={handleSave}
        onReset={handleReset}
        hasChanges={hasChanges}
        isSaving={saveMutation.isPending}
      >
        <div className="space-y-2">
          <Label htmlFor="bankName" className="text-sm font-medium">
            Наименование банка
          </Label>
          <Input
            id="bankName"
            value={formData.bankName}
            onChange={(e) => handleChange('bankName', e.target.value)}
            placeholder="ПАО «Сбербанк»"
          />
        </div>

        <Separator className="my-2" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bik" className="text-sm font-medium">
              БИК
            </Label>
            <Input
              id="bik"
              value={formData.bik}
              onChange={(e) => handleChange('bik', e.target.value)}
              placeholder="044525225"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankAccount" className="text-sm font-medium">
              Расчётный счёт
            </Label>
            <Input
              id="bankAccount"
              value={formData.bankAccount}
              onChange={(e) => handleChange('bankAccount', e.target.value)}
              placeholder="40702810938000123456"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="korAccount" className="text-sm font-medium">
            Корреспондентский счёт
          </Label>
          <Input
            id="korAccount"
            value={formData.korAccount}
            onChange={(e) => handleChange('korAccount', e.target.value)}
            placeholder="30101810400000000225"
          />
        </div>
      </SectionCard>

      {/* Document Preview Section with Company Data */}
      <SectionCard
        icon={FileText}
        title="Предпросмотр реквизитов"
        description="Как данные компании будут выглядеть в документах"
        accentColor="amber-600"
      >
        <div className="rounded-xl border-2 border-dashed border-primary/20 bg-gradient-to-br from-muted/30 to-muted/10 p-6 space-y-4 shadow-inner">
          {/* Logo + Letterhead */}
          <div className="text-center border-b-2 border-foreground/10 pb-4">
            <div className="flex items-center justify-center gap-3 mb-3">
              {(logoPreview || formData.companyName) && (
                <div className="size-10 rounded-lg border border-primary/20 overflow-hidden flex items-center justify-center bg-background">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Логотип" className="size-full object-contain p-0.5" />
                  ) : (
                    <Building2 className="size-5 text-primary/40" />
                  )}
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold tracking-tight">
                  {formData.companyName || 'Название компании'}
                </h3>
                <div className="flex flex-wrap justify-center gap-2 mt-1 text-xs text-muted-foreground">
                  {formData.inn && (
                    <span className="bg-muted/50 px-2 py-0.5 rounded">ИНН: {formData.inn}</span>
                  )}
                  {formData.kpp && (
                    <span className="bg-muted/50 px-2 py-0.5 rounded">КПП: {formData.kpp}</span>
                  )}
                  {formData.ogrn && (
                    <span className="bg-muted/50 px-2 py-0.5 rounded">ОГРН: {formData.ogrn}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Address */}
          {formData.address && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
              <span>{formData.address}</span>
            </div>
          )}

          {/* Contacts */}
          <div className="flex flex-wrap gap-4 text-sm">
            {formData.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{formData.phone}</span>
              </div>
            )}
            {formData.email && (
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{formData.email}</span>
              </div>
            )}
          </div>

          {/* Bank Info */}
          {formData.bankName && (
            <div className="border-t-2 border-foreground/10 pt-3 space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CreditCard className="h-4 w-4 text-muted-foreground" />
                {formData.bankName}
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground ml-6">
                {formData.bankAccount && <span>Р/с: {formData.bankAccount}</span>}
                {formData.korAccount && <span>К/с: {formData.korAccount}</span>}
                {formData.bik && <span>БИК: {formData.bik}</span>}
              </div>
            </div>
          )}

          {/* Placeholder if empty */}
          {!formData.companyName && !formData.inn && !formData.address && (
            <p className="text-center text-sm text-muted-foreground/60 py-4">
              Заполните данные компании выше, чтобы увидеть предпросмотр
            </p>
          )}
        </div>
      </SectionCard>

      {/* User Preferences Section */}
      <SectionCard
        icon={Languages}
        title="Пользовательские настройки"
        description="Язык, часовой пояс и формат отображения данных"
        accentColor="cyan-600"
        onSave={handleSavePreferences}
        onReset={handleResetPreferences}
        hasChanges={preferencesChanged}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1">
              <Languages className="h-3.5 w-3.5" />
              Язык интерфейса
            </Label>
            <Select value={preferences.language} onValueChange={(v) => handlePreferenceChange('language', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ru">Русский</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Часовой пояс
            </Label>
            <Select value={preferences.timezone} onValueChange={(v) => handlePreferenceChange('timezone', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Europe/Moscow">Москва (UTC+3)</SelectItem>
                <SelectItem value="Europe/Samara">Самара (UTC+4)</SelectItem>
                <SelectItem value="Asia/Yekaterinburg">Екатеринбург (UTC+5)</SelectItem>
                <SelectItem value="Asia/Novosibirsk">Новосибирск (UTC+7)</SelectItem>
                <SelectItem value="Asia/Vladivostok">Владивосток (UTC+10)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator className="my-2" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Формат даты
            </Label>
            <Select value={preferences.dateFormat} onValueChange={(v) => handlePreferenceChange('dateFormat', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DD.MM.YYYY">ДД.ММ.ГГГГ</SelectItem>
                <SelectItem value="YYYY-MM-DD">ГГГГ-ММ-ДД</SelectItem>
                <SelectItem value="DD/MM/YYYY">ДД/ММ/ГГГГ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5" />
              Валюта
            </Label>
            <Select value={preferences.currency} onValueChange={(v) => handlePreferenceChange('currency', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RUB">Российский рубль (₽)</SelectItem>
                <SelectItem value="USD">Доллар США ($)</SelectItem>
                <SelectItem value="EUR">Евро (€)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      {/* Notification Preferences Section */}
      <SectionCard
        icon={Bell}
        title="Уведомления"
        description="Настройте способы получения уведомлений"
        accentColor="amber-600"
        onSave={handleSaveNotifications}
        onReset={handleResetNotifications}
        hasChanges={notificationsChanged}
      >
        <div className="space-y-1">
          {/* Email уведомления */}
          <div className="flex items-center justify-between gap-4 rounded-lg p-3 hover:bg-muted/50 transition-all duration-200">
            <div className="space-y-0.5 min-w-0">
              <Label className="text-sm font-medium cursor-pointer">Email уведомления</Label>
              <p className="text-xs text-muted-foreground">Получать уведомления на email</p>
            </div>
            <Switch
              checked={notifications.email}
              onCheckedChange={() => handleNotificationToggle('email')}
              className="data-[state=checked]:bg-primary"
            />
          </div>

          <Separator />

          {/* Уведомления о низком запасе */}
          <div className="flex items-center justify-between gap-4 rounded-lg p-3 hover:bg-muted/50 transition-all duration-200">
            <div className="space-y-0.5 min-w-0">
              <Label className="text-sm font-medium cursor-pointer">Уведомления о низком запасе</Label>
              <p className="text-xs text-muted-foreground">Предупреждения когда остаток ниже минимума</p>
            </div>
            <Switch
              checked={notifications.lowStock}
              onCheckedChange={() => handleNotificationToggle('lowStock')}
              className="data-[state=checked]:bg-amber-500"
            />
          </div>

          <Separator />

          {/* Уведомления о новых счетах */}
          <div className="flex items-center justify-between gap-4 rounded-lg p-3 hover:bg-muted/50 transition-all duration-200">
            <div className="space-y-0.5 min-w-0">
              <Label className="text-sm font-medium cursor-pointer">Уведомления о новых счетах</Label>
              <p className="text-xs text-muted-foreground">Уведомлять при поступлении новых счетов</p>
            </div>
            <Switch
              checked={notifications.newInvoices}
              onCheckedChange={() => handleNotificationToggle('newInvoices')}
              className="data-[state=checked]:bg-sky-500"
            />
          </div>

          <Separator />

          {/* Уведомления о статусе проектов */}
          <div className="flex items-center justify-between gap-4 rounded-lg p-3 hover:bg-muted/50 transition-all duration-200">
            <div className="space-y-0.5 min-w-0">
              <Label className="text-sm font-medium cursor-pointer">Уведомления о статусе проектов</Label>
              <p className="text-xs text-muted-foreground">Оповещения при изменении статуса проекта</p>
            </div>
            <Switch
              checked={notifications.projectStatus}
              onCheckedChange={() => handleNotificationToggle('projectStatus')}
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>

          <Separator />

          {/* Ежедневная сводка */}
          <div className="flex items-center justify-between gap-4 rounded-lg p-3 hover:bg-muted/50 transition-all duration-200">
            <div className="space-y-0.5 min-w-0">
              <Label className="text-sm font-medium cursor-pointer">Ежедневная сводка</Label>
              <p className="text-xs text-muted-foreground">Краткий отчёт каждый рабочий день</p>
            </div>
            <Switch
              checked={notifications.dailyDigest}
              onCheckedChange={() => handleNotificationToggle('dailyDigest')}
              className="data-[state=checked]:bg-violet-500"
            />
          </div>
        </div>
      </SectionCard>

      {/* Email Templates Section */}
      <SectionCard
        icon={MailOpen}
        title="Шаблоны писем"
        description="Настройте шаблоны email-сообщений для типовых операций"
        accentColor="rose-600"
        onSave={handleSaveTemplate}
        onReset={handleResetTemplate}
        hasChanges={templateChanged}
      >
        <div className="space-y-4">
          {/* Template Selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Выберите шаблон</Label>
            <div className="flex flex-wrap gap-2">
              {EMAIL_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTemplate(t.id); setTemplateChanged(false) }}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${selectedTemplate === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                >
                  <MailOpen className="h-3 w-3" />
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Template Edit */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Тема письма</Label>
              <Input
                value={currentTemplateEdit?.subject ?? currentTemplate.subject}
                onChange={(e) => handleTemplateSubjectChange(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Текст письма</Label>
              <Textarea
                value={currentTemplateEdit?.body ?? currentTemplate.body}
                onChange={(e) => handleTemplateBodyChange(e.target.value)}
                rows={8}
                className="font-mono text-sm resize-y"
              />
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                Доступные переменные: {'{companyName}'}, {'{phone}'}, {'{email}'}, {'{items}'}, {'{invoiceNumber}'}, {'{date}'}, {'{deadline}'}, {'{orderNumber}'}, {'{deliveryDate}'}, {'{totalAmount}'}, {'{itemName}'}, {'{currentQty}'}, {'{minQty}'}, {'{unit}'}
              </p>
            </div>
          </div>

          {/* Template Preview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              Предпросмотр
            </Label>
            <div className="rounded-lg border bg-background p-4 space-y-2 shadow-inner">
              <div className="flex items-center gap-2 text-xs text-muted-foreground border-b pb-2">
                <span>Тема:</span>
                <span className="font-medium text-foreground">
                  {(currentTemplateEdit?.subject ?? currentTemplate.subject)
                    .replace('{companyName}', formData.companyName || 'ПРОМЕБЕЛЬ')
                    .replace('{invoiceNumber}', 'СЧ-2024-001')
                    .replace('{orderNumber}', 'ЗК-2024-001')
                    .replace('{itemName}', 'ДСП 16мм')
                  }
                </span>
              </div>
              <pre className="text-xs whitespace-pre-wrap font-mono text-foreground/80 leading-relaxed">
                {(currentTemplateEdit?.body ?? currentTemplate.body)
                  .replace('{companyName}', formData.companyName || 'ПРОМЕБЕЛЬ')
                  .replace('{phone}', formData.phone || '+7 (495) 123-45-67')
                  .replace('{email}', formData.email || 'info@promebel.ru')
                  .replace('{items}', '1. ДСП 16мм — 100 листов\n2. МДФ 8мм — 50 листов')
                  .replace('{invoiceNumber}', 'СЧ-2024-001')
                  .replace('{date}', '15.01.2024')
                  .replace('{deadline}', '20.01.2024')
                  .replace('{orderNumber}', 'ЗК-2024-001')
                  .replace('{deliveryDate}', '25.01.2024')
                  .replace('{totalAmount}', '150 000')
                  .replace('{currentQty}', '5')
                  .replace('{minQty}', '20')
                  .replace('{unit}', 'листов')
                }
              </pre>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Automation Defaults Section */}
      <SectionCard
        icon={Zap}
        title="Автоматизация по умолчанию"
        description="Настройки автоматического выполнения типовых операций"
        accentColor="orange-600"
        onSave={handleSaveAutomation}
        onReset={handleResetAutomation}
        hasChanges={automationChanged}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Интервал авто-запуска (мин)
              </Label>
              <Select value={automationDefaults.autoRunInterval} onValueChange={(v) => handleAutomationChange('autoRunInterval', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">Каждые 15 минут</SelectItem>
                  <SelectItem value="30">Каждые 30 минут</SelectItem>
                  <SelectItem value="60">Каждый час</SelectItem>
                  <SelectItem value="120">Каждые 2 часа</SelectItem>
                  <SelectItem value="1440">Раз в день</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Порог низкого остатка (%)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={automationDefaults.lowStockThreshold}
                onChange={(e) => handleAutomationChange('lowStockThreshold', e.target.value)}
              />
            </div>
          </div>

          <Separator className="my-2" />

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4 rounded-lg p-3 hover:bg-muted/50 transition-all duration-200">
              <div className="space-y-0.5 min-w-0">
                <Label className="text-sm font-medium cursor-pointer">Авто-создание запросов</Label>
                <p className="text-xs text-muted-foreground">Автоматически создавать запросы для позиций с назначенным поставщиком</p>
              </div>
              <Switch
                checked={automationDefaults.autoCreateRequests}
                onCheckedChange={(v) => handleAutomationChange('autoCreateRequests', v)}
                className="data-[state=checked]:bg-orange-500"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4 rounded-lg p-3 hover:bg-muted/50 transition-all duration-200">
              <div className="space-y-0.5 min-w-0">
                <Label className="text-sm font-medium cursor-pointer">Авто-смена статуса</Label>
                <p className="text-xs text-muted-foreground">Автоматически переводить проекты при выполнении условий</p>
              </div>
              <Switch
                checked={automationDefaults.autoStatusTransition}
                onCheckedChange={(v) => handleAutomationChange('autoStatusTransition', v)}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-4 rounded-lg p-3 hover:bg-muted/50 transition-all duration-200">
              <div className="space-y-0.5 min-w-0">
                <Label className="text-sm font-medium cursor-pointer">Уведомления о авто-действиях</Label>
                <p className="text-xs text-muted-foreground">Показывать уведомления при автоматических операциях</p>
              </div>
              <Switch
                checked={automationDefaults.notifyOnAutoAction}
                onCheckedChange={(v) => handleAutomationChange('notifyOnAutoAction', v)}
                className="data-[state=checked]:bg-sky-500"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* SMTP Email Settings Section */}
      <SectionCard
        icon={Send}
        title="Почтовый клиент — SMTP (Отправка)"
        description="Настройка сервера для отправки писем поставщикам"
        accentColor="sky-600"
        onSave={handleSaveEmail}
        onReset={handleResetEmail}
        hasChanges={emailSettingsChanged}
      >
        <div className="space-y-4">
          {/* Connection status */}
          <div className="flex items-center justify-between">
            <ConnectionStatusBadge
              testResult={emailData?.smtpTestResult}
              lastTestedAt={emailData?.smtpLastTestedAt}
              label={emailData?.smtpTestResult === 'success' ? 'Подключено' : emailData?.smtpTestResult === 'error' ? 'Не подключено' : 'Не проверено'}
            />
          </div>

          {/* Email Preset Quick-Config Buttons */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Быстрая настройка</Label>
            <div className="grid grid-cols-3 gap-3">
              {EMAIL_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handlePresetClick(preset.id)}
                  className={`flex items-center gap-2.5 rounded-lg border-2 px-3 py-2.5 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
                    selectedPreset === preset.id
                      ? `${preset.borderActive} ${preset.bgActive} shadow-sm`
                      : 'border-transparent bg-muted/40 hover:bg-muted/60'
                  }`}
                >
                  <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${preset.color} ${preset.textColor} text-sm font-bold`}>
                    {preset.letter}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">Настроить {preset.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{preset.smtp.host}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* SMTP Status indicator */}
          <div className={`flex items-center gap-2 rounded-lg p-3 ${emailSettings.smtpHost ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-amber-50 dark:bg-amber-950/30'}`}>
            {emailSettings.smtpHost ? (
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <Plug className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <span className="text-sm font-medium">
              {emailSettings.smtpHost ? `Настроен: ${emailSettings.smtpHost}:${emailSettings.smtpPort}` : 'SMTP не настроен — письма не отправляются'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Server className="h-3.5 w-3.5" />
                SMTP сервер
              </Label>
              <Input
                value={emailSettings.smtpHost}
                onChange={(e) => handleEmailChange('smtpHost', e.target.value)}
                placeholder="smtp.yandex.ru"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Порт</Label>
              <Input
                value={emailSettings.smtpPort}
                onChange={(e) => handleEmailChange('smtpPort', e.target.value)}
                placeholder="587"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                Логин (email)
              </Label>
              <Input
                value={emailSettings.smtpUser}
                onChange={(e) => handleEmailChange('smtpUser', e.target.value)}
                placeholder="zakupki@promebel.ru"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Key className="h-3.5 w-3.5" />
                Пароль
              </Label>
              <div className="relative">
                <Input
                  type={showSmtpPassword ? 'text' : 'password'}
                  value={emailSettings.smtpPassword}
                  onChange={(e) => handleEmailChange('smtpPassword', e.target.value)}
                  placeholder="Пароль приложения"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                >
                  {showSmtpPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Шифрование</Label>
              <Select value={emailSettings.smtpEncryption} onValueChange={(v) => handleEmailChange('smtpEncryption', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tls">TLS (порт 587)</SelectItem>
                  <SelectItem value="ssl">SSL (порт 465)</SelectItem>
                  <SelectItem value="none">Без шифрования</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Send className="h-3.5 w-3.5" />
                Email отправителя
              </Label>
              <Input
                type="email"
                value={emailSettings.senderEmail}
                onChange={(e) => handleEmailChange('senderEmail', e.target.value)}
                placeholder="zakupki@promebel.ru"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Имя отправителя</Label>
              <Input
                value={emailSettings.senderName}
                onChange={(e) => handleEmailChange('senderName', e.target.value)}
                placeholder="ПРОМЕБЕЛЬ Закупки"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Подпись в письмах</Label>
              <Input
                value={emailSettings.emailSignature}
                onChange={(e) => handleEmailChange('emailSignature', e.target.value)}
                placeholder="С уважением, отдел закупок ПРОМЕБЕЛЬ"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestSmtp}
              disabled={testingSmtp || !emailSettings.smtpHost}
              className="gap-1.5"
            >
              {testingSmtp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
              Тест SMTP
            </Button>
          </div>

          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              💡 Нажмите кнопку пресета выше для быстрой настройки, или введите данные вручную.
              Для Gmail и Yandex используйте пароль приложения, а не основной пароль.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* IMAP Email Settings Section */}
      <SectionCard
        icon={MailOpen}
        title="Почтовый клиент — IMAP (Получение)"
        description="Настройка сервера для чтения ответов от поставщиков"
        accentColor="teal-600"
        onSave={handleSaveEmail}
        onReset={handleResetEmail}
        hasChanges={emailSettingsChanged}
      >
        <div className="space-y-4">
          {/* Connection status */}
          <div className="flex items-center justify-between">
            <ConnectionStatusBadge
              testResult={emailData?.imapTestResult}
              lastTestedAt={emailData?.imapLastTestedAt}
              label={emailData?.imapTestResult === 'success' ? 'Подключено' : emailData?.imapTestResult === 'error' ? 'Не подключено' : 'Не проверено'}
            />
          </div>

          {/* Enable/Disable IMAP */}
          <div className="flex items-center justify-between gap-4 rounded-lg p-3 hover:bg-muted/50">
            <div className="space-y-0.5 min-w-0">
              <Label className="text-sm font-medium cursor-pointer">Включить проверку почты</Label>
              <p className="text-xs text-muted-foreground">Автоматически проверять входящие письма</p>
            </div>
            <Switch
              checked={emailSettings.imapEnabled}
              onCheckedChange={(v) => handleEmailChange('imapEnabled', v)}
              className="data-[state=checked]:bg-teal-500"
            />
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Server className="h-3.5 w-3.5" />
                IMAP сервер
              </Label>
              <Input
                value={emailSettings.imapHost}
                onChange={(e) => handleEmailChange('imapHost', e.target.value)}
                placeholder="imap.yandex.ru"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Порт</Label>
              <Input
                value={emailSettings.imapPort}
                onChange={(e) => handleEmailChange('imapPort', e.target.value)}
                placeholder="993"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                Логин (email)
              </Label>
              <Input
                value={emailSettings.imapUser}
                onChange={(e) => handleEmailChange('imapUser', e.target.value)}
                placeholder="zakupki@promebel.ru"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Key className="h-3.5 w-3.5" />
                Пароль
              </Label>
              <div className="relative">
                <Input
                  type={showImapPassword ? 'text' : 'password'}
                  value={emailSettings.imapPassword}
                  onChange={(e) => handleEmailChange('imapPassword', e.target.value)}
                  placeholder="Пароль приложения"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowImapPassword(!showImapPassword)}
                >
                  {showImapPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Шифрование</Label>
              <Select value={emailSettings.imapEncryption} onValueChange={(v) => handleEmailChange('imapEncryption', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ssl">SSL (порт 993)</SelectItem>
                  <SelectItem value="tls">STARTTLS</SelectItem>
                  <SelectItem value="none">Без шифрования</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Интервал проверки
              </Label>
              <Select value={emailSettings.imapCheckInterval} onValueChange={(v) => handleEmailChange('imapCheckInterval', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">Каждые 5 минут</SelectItem>
                  <SelectItem value="15">Каждые 15 минут</SelectItem>
                  <SelectItem value="30">Каждые 30 минут</SelectItem>
                  <SelectItem value="60">Каждый час</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestImap}
              disabled={testingImap || !emailSettings.imapHost}
              className="gap-1.5"
            >
              {testingImap ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
              Тест IMAP
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* AI Provider Settings Section */}
      <SectionCard
        icon={Brain}
        title="ИИ-провайдер и модель"
        description="Настройка нейросети для работы агента-ассистента"
        accentColor="violet-600"
        onSave={handleSaveAi}
        onReset={handleResetAi}
        hasChanges={aiSettingsChanged}
      >
        <div className="space-y-4">
          {/* Connection status */}
          <div className="flex items-center justify-between">
            <ConnectionStatusBadge
              testResult={aiData?.testResult}
              lastTestedAt={aiData?.lastTestedAt}
              label={aiData?.testResult === 'success' ? 'Подключено' : aiData?.testResult === 'error' ? 'Не подключено' : 'Не проверено'}
            />
          </div>

          {/* Provider selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Провайдер ИИ</Label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'z-ai', label: 'Z-AI (по умолчанию)', desc: 'Встроенный' },
                { id: 'openai', label: 'OpenAI', desc: 'GPT-4o' },
                { id: 'anthropic', label: 'Anthropic', desc: 'Claude' },
                { id: 'yandex', label: 'Yandex', desc: 'YandexGPT' },
                { id: 'custom', label: 'Другой', desc: 'Custom API' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    handleAiChange('provider', p.id)
                    // Set default model for provider
                    const models: Record<string, string> = {
                      'z-ai': 'glm-4',
                      openai: 'gpt-4o',
                      anthropic: 'claude-3.5-sonnet',
                      yandex: 'yandexgpt-lite',
                      custom: '',
                    }
                    handleAiChange('model', models[p.id] ?? '')
                  }}
                  className={`inline-flex flex-col items-start rounded-lg px-3 py-2 text-left transition-all duration-200 border ${
                    aiSettings.provider === p.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-transparent bg-muted/40 hover:bg-muted/60'
                  }`}
                >
                  <span className="text-sm font-medium">{p.label}</span>
                  <span className="text-[10px] text-muted-foreground">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Модель</Label>
              <Select value={aiSettings.model} onValueChange={(v) => handleAiChange('model', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {aiSettings.provider === 'z-ai' && (
                    <>
                      <SelectItem value="glm-4">GLM-4</SelectItem>
                      <SelectItem value="glm-4-flash">GLM-4 Flash</SelectItem>
                    </>
                  )}
                  {aiSettings.provider === 'openai' && (
                    <>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    </>
                  )}
                  {aiSettings.provider === 'anthropic' && (
                    <>
                      <SelectItem value="claude-3.5-sonnet">Claude 3.5 Sonnet</SelectItem>
                      <SelectItem value="claude-3-haiku">Claude 3 Haiku</SelectItem>
                    </>
                  )}
                  {aiSettings.provider === 'yandex' && (
                    <>
                      <SelectItem value="yandexgpt-lite">YandexGPT Lite</SelectItem>
                      <SelectItem value="yandexgpt">YandexGPT Pro</SelectItem>
                    </>
                  )}
                  {aiSettings.provider === 'custom' && (
                    <SelectItem value="custom">Ввод вручную</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Key className="h-3.5 w-3.5" />
                API ключ
              </Label>
              <div className="relative">
                <Input
                  type={showAiApiKey ? 'text' : 'password'}
                  value={aiSettings.apiKey}
                  onChange={(e) => handleAiChange('apiKey', e.target.value)}
                  placeholder={aiSettings.provider === 'z-ai' ? 'Встроенный (не требуется)' : 'sk-...'}
                  className="pr-10"
                  disabled={aiSettings.provider === 'z-ai'}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  onClick={() => setShowAiApiKey(!showAiApiKey)}
                  disabled={aiSettings.provider === 'z-ai'}
                >
                  {showAiApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
            </div>
          </div>

          {aiSettings.provider === 'custom' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" />
                API Endpoint
              </Label>
              <Input
                value={aiSettings.apiEndpoint}
                onChange={(e) => handleAiChange('apiEndpoint', e.target.value)}
                placeholder="https://api.example.com/v1/chat/completions"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1">
                <Thermometer className="h-3.5 w-3.5" />
                Температура (креативность)
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  type="range"
                  min={0}
                  max={2}
                  step={0.1}
                  value={aiSettings.temperature}
                  onChange={(e) => handleAiChange('temperature', e.target.value)}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-10 text-right">{aiSettings.temperature}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">0 = точно, 1 = сбалансировано, 2 = креативно</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Макс. токенов ответа</Label>
              <Select value={aiSettings.maxTokens} onValueChange={(v) => handleAiChange('maxTokens', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1024">1 024</SelectItem>
                  <SelectItem value="2048">2 048</SelectItem>
                  <SelectItem value="4096">4 096</SelectItem>
                  <SelectItem value="8192">8 192</SelectItem>
                  <SelectItem value="16384">16 384</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              Системный промпт
            </Label>
            <Textarea
              value={aiSettings.systemPrompt}
              onChange={(e) => handleAiChange('systemPrompt', e.target.value)}
              rows={5}
              className="font-mono text-sm resize-y"
              placeholder="Опишите роль и поведение ИИ-ассистента..."
            />
            <p className="text-[10px] text-muted-foreground">Определяет, как ИИ будет отвечать на запросы. Измените под свои нужды.</p>
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestAi}
              disabled={testingAi}
              className="gap-1.5"
            >
              {testingAi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Brain className="h-3.5 w-3.5" />}
              Тест ИИ
            </Button>
          </div>
        </div>
      </SectionCard>

      {/* Telegram Bot Settings Section */}
      <SectionCard
        icon={Bot}
        title="Telegram бот"
        description="Настройка бота для приёма Excel и управления через Telegram"
        accentColor="sky-600"
        onSave={handleSaveTelegram}
        onReset={handleResetTelegram}
        hasChanges={telegramSettingsChanged}
      >
        <div className="space-y-4">
          {/* Status indicator */}
          <div className={`flex items-center gap-2 rounded-lg p-3 ${telegramSettings.botToken ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-amber-50 dark:bg-amber-950/30'}`}>
            {telegramSettings.botToken ? (
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <Bot className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
            )}
            <span className="text-sm font-medium">
              {telegramSettings.botToken ? (telegramSettings.isEnabled ? 'Бот активен' : 'Бот настроен, но выключен') : 'Telegram бот не настроен'}
            </span>
            {telegramSettings.botToken && telegramSettings.isEnabled && (
              <Badge className="ml-auto bg-emerald-600 text-white text-[10px]">Активен</Badge>
            )}
          </div>

          {/* Enable/Disable */}
          {telegramSettings.botToken && (
            <div className="flex items-center justify-between gap-4 rounded-lg p-3 hover:bg-muted/50">
              <div className="space-y-0.5 min-w-0">
                <Label className="text-sm font-medium cursor-pointer">Включить бота</Label>
                <p className="text-xs text-muted-foreground">Бот будет принимать сообщения и файлы</p>
              </div>
              <Switch
                checked={telegramSettings.isEnabled}
                onCheckedChange={(v) => handleTelegramChange('isEnabled', v)}
                className="data-[state=checked]:bg-sky-500"
              />
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1">
              <Key className="h-3.5 w-3.5" />
              Токен бота
            </Label>
            <div className="relative">
              <Input
                type={showBotToken ? 'text' : 'password'}
                value={telegramSettings.botToken}
                onChange={(e) => handleTelegramChange('botToken', e.target.value)}
                placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                onClick={() => setShowBotToken(!showBotToken)}
              >
                {showBotToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Webhook URL (опционально)</Label>
              <Input
                value={telegramSettings.webhookUrl}
                onChange={(e) => handleTelegramChange('webhookUrl', e.target.value)}
                placeholder="https://your-server.com/api/telegram/webhook"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Chat ID (для уведомлений)</Label>
              <Input
                value={telegramSettings.chatId}
                onChange={(e) => handleTelegramChange('chatId', e.target.value)}
                placeholder="123456789"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestTelegram}
              disabled={testingTelegram || !telegramSettings.botToken}
              className="gap-1.5"
            >
              {testingTelegram ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
              Тест бота
            </Button>
          </div>

          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">
              🤖 Создайте бота через @BotFather в Telegram. Получите токен и вставьте выше.
              После настройки отправляйте Excel-файлы боту — он автоматически создаст проект
              и запустит процесс группировки позиций по поставщикам.
            </p>
          </div>
        </div>
      </SectionCard>

      {/* Data Management Section */}
      <SectionCard
        icon={Database}
        title="Управление данными"
        description="Экспорт, импорт и сброс данных системы"
        accentColor="teal-600"
      >
        <div className="space-y-4">
          {/* Export */}
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/50">
                <Download className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Экспорт всех данных</p>
                <p className="text-xs text-muted-foreground">Скачать все данные в формате JSON</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAll}
              disabled={exporting}
              className="gap-1.5"
            >
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Экспорт
            </Button>
          </div>

          {/* Import */}
          <div className="flex items-center justify-between gap-4 rounded-lg border p-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/50">
                <Upload className="h-5 w-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Импорт данных</p>
                <p className="text-xs text-muted-foreground">Загрузить данные из файла JSON или CSV</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={importFileRef}
                type="file"
                accept=".json,.csv"
                className="hidden"
                onChange={handleImportFile}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleImportData}
                disabled={importing}
                className="gap-1.5"
              >
                {importing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Импорт
              </Button>
            </div>
          </div>

          <Separator className="my-2" />

          {/* Reset DB */}
          <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium text-destructive">Сброс базы данных</p>
                <p className="text-xs text-muted-foreground">Удалить все данные и заполнить заново. Это действие нельзя отменить.</p>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setResetDbOpen(true)}
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Сбросить
            </Button>
          </div>
        </div>

        {/* Reset DB Confirmation */}
        <AlertDialog open={resetDbOpen} onOpenChange={setResetDbOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Сбросить базу данных?</AlertDialogTitle>
              <AlertDialogDescription>
                Все данные будут удалены и заменены начальными значениями. Это действие нельзя отменить.
                Рекомендуем сначала экспортировать данные.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetDb} className="bg-destructive text-white hover:bg-destructive/90">
                Сбросить
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SectionCard>

      {/* About Section */}
      <SectionCard
        icon={Info}
        title="О системе"
        description="Информация о версии и обновлениях"
        accentColor="violet-600"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-xl border bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
              <Building2 className="size-7 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold">ПРОМЕБЕЛЬ</h3>
              <p className="text-sm text-muted-foreground">Управление закупками ПРОМЕБЕЛЬ</p>
              <Badge variant="secondary" className="mt-1 gap-1">
                <Star className="h-3 w-3" />
                v3.2.0
              </Badge>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Версия</p>
              <p className="font-medium">3.2.0</p>
            </div>
            <div>
              <p className="text-muted-foreground">Дата сборки</p>
              <p className="font-medium">01.03.2026</p>
            </div>
            <div>
              <p className="text-muted-foreground">Платформа</p>
              <p className="font-medium">Next.js 16</p>
            </div>
            <div>
              <p className="text-muted-foreground">База данных</p>
              <p className="font-medium">SQLite / Prisma</p>
            </div>
          </div>

          <Separator />

          {/* Changelog */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Последние обновления</h4>
            </div>

            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex size-6 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/50">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                  <div className="w-px flex-1 bg-border mt-1" />
                </div>
                <div className="pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">v3.2.0</span>
                    <Badge variant="outline" className="text-[10px] h-4">Текущая</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Расширенные настройки, шаблоны писем, управление данными, улучшенный склад
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex size-6 items-center justify-center rounded-full bg-muted">
                    <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="w-px flex-1 bg-border mt-1" />
                </div>
                <div className="pb-3">
                  <span className="text-xs font-semibold">v3.1.0</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ИИ-ассистент, автоматизация, отслеживание доставок
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex size-6 items-center justify-center rounded-full bg-muted">
                    <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
                <div>
                  <span className="text-xs font-semibold">v3.0.0</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ребрендинг ПРОМЕБЕЛЬ, улучшенные отчёты, сверка счетов
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            <span>© 2024–2026 ПРОМЕБЕЛЬ. Все права защищены.</span>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
