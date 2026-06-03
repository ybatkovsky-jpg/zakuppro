/**
 * Financial Metrics Card Component
 *
 * Displays key financial metrics from the FastAPI analytics dashboard:
 * - Paid invoices (green)
 * - Unpaid invoices (red)
 * - Pending invoices (amber)
 * - Total paid/unpaid amounts
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getDashboardMetrics } from '@/lib/api/analytics';
import type { DashboardMetricsResponse } from '@/types/fastapi';

const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

// Metric type for consistent rendering
interface MetricItem {
  label: string;
  value: number;
  amount: number | null;
  colorClass: string;
  bgClass: string;
  icon: React.ReactNode;
}

function MetricCard({ metric }: { metric: MetricItem }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className={`p-2 rounded-full ${metric.bgClass}`}>
        {metric.icon}
      </div>
      <div className="flex-1">
        <p className="text-sm text-muted-foreground">{metric.label}</p>
        <p className={`text-lg font-semibold ${metric.colorClass}`}>
          {metric.value}
        </p>
      </div>
      {metric.amount !== null && (
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Сумма</p>
          <p className="text-sm font-medium">{currencyFormatter.format(metric.amount)}</p>
        </div>
      )}
    </div>
  );
}

// Icons for each metric type
const CheckIcon = () => (
  <svg className="h-4 w-4 text-green-600 dark:text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="h-4 w-4 text-red-600 dark:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ClockIcon = () => (
  <svg className="h-4 w-4 text-amber-600 dark:text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export function FinancialMetricsCard() {
  const { data, isLoading, error, isError } = useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => getDashboardMetrics(),
    refetchInterval: 60000, // Refetch every minute
  });

  const metrics = data?.data ? mapToMetrics(data.data) : null;

  // Empty state: all values are 0 or null
  const isEmpty = metrics && metrics.every(m => m.value === 0 && (m.amount === 0 || m.amount === null));

  if (isLoading) {
    return <FinancialMetricsCardSkeleton />;
  }

  if (isError || error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Финансовые метрики</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : 'Не удалось загрузить финансовые метрики'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isEmpty || !metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Финансовые метрики</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Нет данных для отображения</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Финансовые метрики</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </CardContent>
    </Card>
  );
}

function FinancialMetricsCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Skeleton className="h-6 w-40" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-12" />
            </div>
            <div className="text-right space-y-1">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function mapToMetrics(data: DashboardMetricsResponse): MetricItem[] {
  return [
    {
      label: 'Оплачено',
      value: data.paid_invoices_count,
      amount: data.total_paid_amount,
      colorClass: 'text-green-600 dark:text-green-500',
      bgClass: 'bg-green-100 dark:bg-green-900/30',
      icon: <CheckIcon />,
    },
    {
      label: 'Не оплачено',
      value: data.unpaid_invoices_count,
      amount: data.total_unpaid_amount,
      colorClass: 'text-red-600 dark:text-red-500',
      bgClass: 'bg-red-100 dark:bg-red-900/30',
      icon: <XIcon />,
    },
    {
      label: 'Ожидает',
      value: data.pending_invoices_count,
      amount: null,
      colorClass: 'text-amber-600 dark:text-amber-500',
      bgClass: 'bg-amber-100 dark:bg-amber-900/30',
      icon: <ClockIcon />,
    },
  ];
}
