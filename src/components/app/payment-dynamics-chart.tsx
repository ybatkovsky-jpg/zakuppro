/**
 * Payment Dynamics Chart Component
 *
 * Displays payment trends over time using an AreaChart.
 * Features:
 * - Time-series visualization of paid amounts
 * - Group by day/week/month
 * - Date range presets (7/30/90 days)
 * - Tooltip with date, amount, and payment count
 * - Loading, error, and empty states
 */

"use client"

import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { analyticsApi } from '@/lib/api/analytics';
import type { PaymentDynamicsQueryParams, PaymentDynamicsResponse, PaymentDynamicsPoint } from '@/types/fastapi';

// =============================================================================
// Constants
// =============================================================================

const CHART_CONFIG = {
  paidAmount: {
    label: 'Оплачено',
    color: 'hsl(var(--chart-1))',
  } as const,
};

const GROUP_BY_OPTIONS = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
] as const;

const DATE_RANGES = [
  { value: 7, label: '7 дней' },
  { value: 30, label: '30 дней' },
  { value: 90, label: '90 дней' },
] as const;

type GroupByValue = 'day' | 'week' | 'month';

// =============================================================================
// Helpers
// =============================================================================

const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatDate(dateStr: string, groupBy: GroupByValue): string {
  const date = new Date(dateStr);
  switch (groupBy) {
    case 'day':
      return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    case 'week':
      return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
    case 'month':
      return date.toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
    default:
      return dateStr;
  }
}

function getDateRange(days: number): { period_start: string; period_end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return {
    period_start: start.toISOString().split('T')[0],
    period_end: end.toISOString().split('T')[0],
  };
}

// =============================================================================
// Component
// =============================================================================

export function PaymentDynamicsChart() {
  const [groupBy, setGroupBy] = useState<GroupByValue>('day');
  const [dateRange, setDateRange] = useState(30);

  const queryParams = useMemo<PaymentDynamicsQueryParams>(() => ({
    group_by: groupBy,
    ...getDateRange(dateRange),
  }), [groupBy, dateRange]);

  const { data, isLoading, error, isError } = useQuery({
    queryKey: ['analytics', 'payment-dynamics', queryParams],
    queryFn: () => analyticsApi.getPaymentDynamics(queryParams),
    refetchInterval: 60000,
  });

  const chartData = useMemo(() => {
    if (!data?.data) return [];
    return data.data.data.map((point: PaymentDynamicsPoint) => ({
      date: formatDate(point.date, groupBy),
      paidAmount: point.paid_amount,
      paidCount: point.paid_count,
      originalDate: point.date,
    }));
  }, [data, groupBy]);

  const isEmpty = chartData.length === 0;

  if (isLoading) {
    return <PaymentDynamicsChartSkeleton />;
  }

  if (isError || error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Динамика платежей</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : 'Не удалось загрузить данные динамики платежей'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isEmpty) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Динамика платежей</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Нет данных о платежах за выбранный период
            </p>
            <p className="text-xs text-muted-foreground">
              Попробуйте выбрать другой период или группировку
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Динамика платежей</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={String(dateRange)} onValueChange={(v) => setDateRange(Number(v))}>
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map((range) => (
                  <SelectItem key={range.value} value={String(range.value)}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByValue)}>
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_BY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={CHART_CONFIG} className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                className="text-xs"
              />
              <YAxis
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                  return String(value);
                }}
                className="text-xs"
              />
              <ChartTooltip
                content={<ChartTooltipContent />}
                formatter={(value: number, name: string) => [
                  currencyFormatter.format(value),
                  CHART_CONFIG.paidAmount.label,
                ]}
                labelFormatter={(label: string, payload: any) => {
                  const point = payload?.[0]?.payload;
                  if (!point) return label;
                  const date = new Date(point.originalDate).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  });
                  return `${date} • ${point.paidCount} платеж(ей)`;
                }}
              />
              <Area
                type="monotone"
                dataKey="paidAmount"
                stroke="hsl(var(--chart-1))"
                fill="hsl(var(--chart-1))"
                fillOpacity={0.3}
                name={CHART_CONFIG.paidAmount.label}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Skeleton
// =============================================================================

function PaymentDynamicsChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>
            <Skeleton className="h-6 w-40" />
          </CardTitle>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-[100px]" />
            <Skeleton className="h-8 w-[100px]" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  );
}
