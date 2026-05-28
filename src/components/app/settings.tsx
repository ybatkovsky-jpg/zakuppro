'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
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
      <Card className="relative overflow-hidden">
        <div className={`absolute top-0 left-0 right-0 h-[2px] ${colors.line}`} />
        <CardHeader className="pb-4">
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
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        </div>
      </SectionCard>

      {/* Document Preview Section */}
      <SectionCard
        icon={FileText}
        title="Предпросмотр реквизитов"
        description="Как данные компании будут выглядеть в документах"
        accentColor="amber-600"
      >
        <div className="rounded-xl border bg-gradient-to-br from-muted/30 to-muted/10 p-6 space-y-4">
          {/* Company Header */}
          <div className="text-center border-b pb-4">
            <h3 className="text-lg font-bold tracking-tight">
              {formData.companyName || 'Название компании'}
            </h3>
            <div className="flex flex-wrap justify-center gap-4 mt-2 text-xs text-muted-foreground">
              {formData.inn && <span>ИНН: {formData.inn}</span>}
              {formData.kpp && <span>КПП: {formData.kpp}</span>}
              {formData.ogrn && <span>ОГРН: {formData.ogrn}</span>}
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
            <div className="border-t pt-3 space-y-1.5">
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
    </div>
  )
}
