'use client'

import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/hooks/use-toast'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Building2,
  Save,
  Loader2,
  MapPin,
  Mail,
  Phone,
  Landmark,
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">Данные компании для документов и запросов</p>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Сохранить
        </Button>
      </div>

      {/* Company Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Реквизиты компании
          </CardTitle>
          <CardDescription>
            Основная информация о компании, используемая в запросах и документах
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Company Name */}
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

          {/* Tax IDs */}
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

          <Separator />

          {/* Address */}
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

          {/* Contact Info */}
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

          <Separator />

          {/* Bank Details */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
              <Landmark className="h-4 w-4" />
              Банковские реквизиты
            </h3>
            <div className="space-y-4">
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
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
