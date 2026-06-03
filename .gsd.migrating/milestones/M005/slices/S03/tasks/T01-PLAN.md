---
estimated_steps: 12
estimated_files: 1
skills_used: []
---

# T01: Create Financial Metrics Card Component

## Why
Пользователям нужна видимость финансовых показателей (оплаченные/неоплаченные счета) на главном дашборде.

## Do
1. Создать `src/components/app/financial-metrics-card.tsx`
2. Использовать `useQuery` из `@tanstack/react-query` для fetching `/api/analytics/dashboard`
3. Отобразить 3 метрики: paid (зелёный), unpaid (красный), pending (янтарный)
4. Показать суммы: totalPaidAmount, totalUnpaidAmount
5. Использовать Card, Skeleton из `@/components/ui/card`
6. Добавить empty state когда все значения 0
7. Форматировать валюту через `Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' })`

## Done when
Компонент рендерится без ошибок TypeScript, показывает метрики из FastAPI response

## Inputs

- `src/lib/api/analytics.ts`
- `src/types/fastapi.ts`
- `src/components/ui/card.tsx`
- `src/components/ui/skeleton.tsx`

## Expected Output

- `src/components/app/financial-metrics-card.tsx`

## Verification

1. npm run build без TypeScript ошибок
2. Визуальная проверка: карточка отображается на dashboard с корректными иконками и цветами

## Observability Impact

Loading state (Skeleton), error state (сообщение об ошибке), empty state (нет данных)
