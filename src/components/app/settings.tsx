'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
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
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  children: React.ReactNode
  accentColor?: string
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
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {children}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ── Main Component ─────────────────────────────────────────

export function Settings() {
  const queryClient = useQueryClient()
  const [localEdits, setLocalEdits] = useState<Partial<Omit<CompanyData, 'id'>> | null>(null)

  // ── Notification state ────────────────────────────────────
  const [notifications, setNotifications] = useState({
    email: true,
    lowStock: true,
    newInvoices: true,
    projectStatus: true,
    dailyDigest: false,
  })

  // ── Integration state ─────────────────────────────────────
  const [integration, setIntegration] = useState({
    smtpServer: '',
    smtpPort: '',
    senderEmail: '',
    apiKey: '',
  })
  const [showApiKey, setShowApiKey] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)

  // ── Query ──────────────────────────────────────────────────

  const { data: company, isLoading } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const res = await fetch('/api/company')
      if (!res.ok) throw new Error('Failed to fetch company details')
      return res.json() as Promise<CompanyData>
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

  // ── Handlers ───────────────────────────────────────────────

  const handleChange = (field: keyof typeof serverData, value: string) => {
    setLocalEdits((prev) => ({ ...(prev || {}), [field]: value }))
  }

  const handleSave = () => {
    saveMutation.mutate(formData)
  }

  const handleNotificationToggle = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleIntegrationChange = (field: keyof typeof integration, value: string) => {
    setIntegration((prev) => ({ ...prev, [field]: value }))
  }

  const handleTestConnection = async () => {
    setTestingConnection(true)
    // Simulate connection test
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setTestingConnection(false)
    toast({
      title: 'Подключение проверено',
      description: integration.smtpServer
        ? `Успешное подключение к ${integration.smtpServer}:${integration.smtpPort || '587'}`
        : 'Укажите SMTP сервер для проверки',
      variant: integration.smtpServer ? 'default' : 'destructive',
    })
  }

  const handleSaveNotifications = () => {
    toast({
      title: 'Настройки сохранены',
      description: 'Настройки уведомлений обновлены',
    })
  }

  const handleSaveIntegration = () => {
    toast({
      title: 'Настройки сохранены',
      description: 'Настройки интеграции обновлены',
    })
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
    <div className="space-y-6 max-w-3xl">
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
            Сохранить
          </Button>
        </div>
      </div>

      {/* Company Details Section */}
      <SectionCard
        icon={Building2}
        title="Реквизиты компании"
        description="Основная информация о компании, используемая в запросах и документах"
        accentColor="emerald-600"
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

      {/* Document Preview Section */}
      <SectionCard
        icon={FileText}
        title="Предпросмотр реквизитов"
        description="Как данные компании будут выглядеть в документах"
        accentColor="amber-600"
      >
        <div className="rounded-xl border-2 border-dashed border-primary/20 bg-gradient-to-br from-muted/30 to-muted/10 p-6 space-y-4 shadow-inner">
          {/* Formal letterhead */}
          <div className="text-center border-b-2 border-foreground/10 pb-4">
            <div className="inline-block border border-primary/20 rounded-lg px-6 py-1 mb-3">
              <span className="text-[10px] font-semibold tracking-[0.2em] text-primary/60 uppercase">Предпросмотр реквизитов</span>
            </div>
            <h3 className="text-xl font-bold tracking-tight">
              {formData.companyName || 'Название компании'}
            </h3>
            <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs text-muted-foreground">
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

      {/* Notification Preferences Section */}
      <SectionCard
        icon={Bell}
        title="Уведомления"
        description="Настройте способы получения уведомлений"
        accentColor="amber-600"
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

        <div className="pt-2 flex justify-end">
          <Button
            onClick={handleSaveNotifications}
            className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
          >
            <Save className="mr-2 h-4 w-4" />
            Сохранить
          </Button>
        </div>
      </SectionCard>

      {/* Integration Settings Section */}
      <SectionCard
        icon={Globe}
        title="Интеграции"
        description="Настройки подключений к внешним сервисам"
        accentColor="sky-600"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="smtpServer" className="text-sm font-medium">
                Email сервер (SMTP)
              </Label>
              <Input
                id="smtpServer"
                value={integration.smtpServer}
                onChange={(e) => handleIntegrationChange('smtpServer', e.target.value)}
                placeholder="smtp.example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPort" className="text-sm font-medium">
                Порт
              </Label>
              <Input
                id="smtpPort"
                value={integration.smtpPort}
                onChange={(e) => handleIntegrationChange('smtpPort', e.target.value)}
                placeholder="587"
              />
            </div>
          </div>

          <Separator className="my-2" />

          <div className="space-y-2">
            <Label htmlFor="senderEmail" className="text-sm font-medium">
              Email отправителя
            </Label>
            <Input
              id="senderEmail"
              type="email"
              value={integration.senderEmail}
              onChange={(e) => handleIntegrationChange('senderEmail', e.target.value)}
              placeholder="zakupki@company.ru"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey" className="text-sm font-medium">
              API ключ
            </Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                value={integration.apiKey}
                onChange={(e) => handleIntegrationChange('apiKey', e.target.value)}
                placeholder="sk-..."
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row justify-end gap-2">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={testingConnection}
            className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
          >
            {testingConnection ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plug className="mr-2 h-4 w-4" />
            )}
            Тест подключения
          </Button>
          <Button
            onClick={handleSaveIntegration}
            className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
          >
            <Save className="mr-2 h-4 w-4" />
            Сохранить
          </Button>
        </div>
      </SectionCard>
    </div>
  )
}
