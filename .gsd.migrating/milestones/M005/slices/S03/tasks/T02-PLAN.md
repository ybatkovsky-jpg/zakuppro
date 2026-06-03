---
estimated_steps: 15
estimated_files: 1
skills_used: []
---

# T02: Create Payment Dynamics Chart Component

## Why
Визуализация трендов платежей помогает пользователям понимать динамику оплат во времени.

## Do
1. Создать `src/components/app/payment-dynamics-chart.tsx`
2. Использовать Recharts AreaChart для отображения time-series
3. Fetch через `analyticsApi.getPaymentDynamics({ group_by: 'day' })`
4. X-axis: дата (формат DD.MM)
5. Y-axis: paidAmount (RUB)
6. Tooltip: дата, сумма, количество платежей
7. Добавить select для group_by (day/week/month)
8. Добавить date range presets: 7 дней, 30 дней, 90 дней
9. Empty state: сообщение когда data.length === 0
10. Use ChartContainer из `@/components/ui/chart`

## Done when
Компонент рендерит AreaChart с данными из FastAPI, select переключает group_by

## Inputs

- `src/lib/api/analytics.ts`
- `src/types/fastapi.ts`
- `src/components/ui/chart.tsx`
- `src/components/ui/select.tsx`

## Expected Output

- `src/components/app/payment-dynamics-chart.tsx`

## Verification

1. npm run build без ошибок
2. Визуально: график отображает данные, tooltip показывает корректные значения
3. Select group_by обновляет данные

## Observability Impact

Loading state, error boundary, empty state с call-to-action
